import difflib
import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.sqlite import SQLiteVersionRepository, SQLitePromptRepository
from app.schemas.versions import VersionCreate, VersionResponse, VersionDiff, DiffHunk

router = APIRouter(prefix="/prompts/{prompt_id}/versions", tags=["versions"])


def _build_diff_hunks(text_a: str, text_b: str) -> List[DiffHunk]:
    """Build structured diff hunks from two text strings (line-level diff)."""
    lines_a = text_a.splitlines(keepends=False)
    lines_b = text_b.splitlines(keepends=False)
    matcher = difflib.SequenceMatcher(None, lines_a, lines_b)
    hunks: List[DiffHunk] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                hunks.append(
                    DiffHunk(
                        line_number_old=i1 + k + 1,
                        line_number_new=j1 + k + 1,
                        operation="equal",
                        old_text=lines_a[i1 + k],
                        new_text=lines_b[j1 + k],
                    )
                )
        elif tag == "insert":
            for k in range(j2 - j1):
                hunks.append(
                    DiffHunk(
                        line_number_old=None,
                        line_number_new=j1 + k + 1,
                        operation="insert",
                        new_text=lines_b[j1 + k],
                    )
                )
        elif tag == "delete":
            for k in range(i2 - i1):
                hunks.append(
                    DiffHunk(
                        line_number_old=i1 + k + 1,
                        line_number_new=None,
                        operation="delete",
                        old_text=lines_a[i1 + k],
                    )
                )
        elif tag == "replace":
            # Emit paired replace hunks
            for k in range(max(i2 - i1, j2 - j1)):
                old_line = lines_a[i1 + k] if (i1 + k) < i2 else None
                new_line = lines_b[j1 + k] if (j1 + k) < j2 else None
                if old_line is not None and new_line is not None:
                    hunks.append(
                        DiffHunk(
                            line_number_old=i1 + k + 1,
                            line_number_new=j1 + k + 1,
                            operation="replace",
                            old_text=old_line,
                            new_text=new_line,
                        )
                    )
                elif old_line is not None:
                    hunks.append(
                        DiffHunk(
                            line_number_old=i1 + k + 1,
                            line_number_new=None,
                            operation="delete",
                            old_text=old_line,
                        )
                    )
                else:
                    hunks.append(
                        DiffHunk(
                            line_number_old=None,
                            line_number_new=j1 + k + 1,
                            operation="insert",
                            new_text=new_line,
                        )
                    )
    return hunks


def _vars_to_text(variables_json: str | None) -> str:
    """Serialize variables dict to a stable text form for diffing."""
    if not variables_json:
        return ""
    try:
        data = json.loads(variables_json)
        if isinstance(data, dict):
            lines = [f"{k}: {v}" for k, v in sorted(data.items())]
            return "\n".join(lines)
    except (json.JSONDecodeError, ValueError):
        pass
    return variables_json or ""


@router.get("/", response_model=List[VersionResponse])
async def list_versions(
    prompt_id: int,
    db: AsyncSession = Depends(get_db),
):
    prompt_repo = SQLitePromptRepository(db)
    prompt = await prompt_repo.get(prompt_id)
    if prompt is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Prompt not found", "code": "PROMPT_NOT_FOUND"},
        )
    version_repo = SQLiteVersionRepository(db)
    versions = await version_repo.list_for_prompt(prompt_id)
    return versions


@router.post("/", response_model=VersionResponse, status_code=201)
async def create_version(
    prompt_id: int,
    body: VersionCreate,
    db: AsyncSession = Depends(get_db),
):
    prompt_repo = SQLitePromptRepository(db)
    prompt = await prompt_repo.get(prompt_id)
    if prompt is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Prompt not found", "code": "PROMPT_NOT_FOUND"},
        )

    version_repo = SQLiteVersionRepository(db)
    next_num = await version_repo.get_next_version_number(prompt_id)

    variables_value = body.variables
    if isinstance(variables_value, dict):
        variables_value = json.dumps(variables_value)

    version = await version_repo.create(
        {
            "prompt_id": prompt_id,
            "version_number": next_num,
            "content": body.content,
            "system_prompt": body.system_prompt,
            "variables": variables_value,
            "commit_message": body.commit_message,
            "author": body.author,
        }
    )

    # Update prompt updated_at
    prompt_repo_upd = SQLitePromptRepository(db)
    from app.repositories.sqlite import utcnow
    await prompt_repo_upd.update(prompt_id, {"updated_at": utcnow()})

    await db.commit()
    return version


@router.get("/diff", response_model=VersionDiff)
async def diff_versions(
    prompt_id: int,
    v1: int = Query(..., description="Version ID 1"),
    v2: int = Query(..., description="Version ID 2"),
    db: AsyncSession = Depends(get_db),
):
    version_repo = SQLiteVersionRepository(db)
    ver1 = await version_repo.get(v1)
    ver2 = await version_repo.get(v2)

    if ver1 is None or ver1.prompt_id != prompt_id:
        raise HTTPException(
            status_code=404,
            detail={"detail": f"Version {v1} not found for prompt {prompt_id}", "code": "VERSION_NOT_FOUND"},
        )
    if ver2 is None or ver2.prompt_id != prompt_id:
        raise HTTPException(
            status_code=404,
            detail={"detail": f"Version {v2} not found for prompt {prompt_id}", "code": "VERSION_NOT_FOUND"},
        )

    content_diff = _build_diff_hunks(ver1.content, ver2.content)
    variables_diff = _build_diff_hunks(
        _vars_to_text(ver1.variables),
        _vars_to_text(ver2.variables),
    )

    return VersionDiff(
        v1=VersionResponse.model_validate(ver1),
        v2=VersionResponse.model_validate(ver2),
        content_diff=content_diff,
        variables_diff=variables_diff,
    )


@router.get("/{version_id}", response_model=VersionResponse)
async def get_version(
    prompt_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
):
    version_repo = SQLiteVersionRepository(db)
    version = await version_repo.get(version_id)
    if version is None or version.prompt_id != prompt_id:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Version not found", "code": "VERSION_NOT_FOUND"},
        )
    return version


@router.post("/{version_id}/restore", response_model=VersionResponse, status_code=201)
async def restore_version(
    prompt_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
):
    version_repo = SQLiteVersionRepository(db)
    source = await version_repo.get(version_id)
    if source is None or source.prompt_id != prompt_id:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Version not found", "code": "VERSION_NOT_FOUND"},
        )

    next_num = await version_repo.get_next_version_number(prompt_id)
    new_version = await version_repo.create(
        {
            "prompt_id": prompt_id,
            "version_number": next_num,
            "content": source.content,
            "system_prompt": source.system_prompt,
            "variables": source.variables,
            "commit_message": f"Restored from version {source.version_number}",
            "author": source.author,
        }
    )

    prompt_repo = SQLitePromptRepository(db)
    from app.repositories.sqlite import utcnow
    await prompt_repo.update(prompt_id, {"updated_at": utcnow()})

    await db.commit()
    return new_version

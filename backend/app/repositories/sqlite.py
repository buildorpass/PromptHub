import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Any

from sqlalchemy import select, func, or_, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import (
    Folder,
    Prompt,
    PromptVersion,
    ModelPricing,
    TestRun,
    RunResult,
    Asset,
    TestCase,
)
from app.repositories.base import (
    AbstractFolderRepository,
    AbstractPromptRepository,
    AbstractVersionRepository,
    AbstractPricingRepository,
    AbstractRunRepository,
    AbstractRunResultRepository,
    AbstractAssetRepository,
    AbstractTestCaseRepository,
)

logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SQLiteFolderRepository(AbstractFolderRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: int) -> Optional[Folder]:
        result = await self.session.get(Folder, id)
        return result

    async def list(self, skip: int = 0, limit: int = 20, **filters) -> List[Folder]:
        stmt = select(Folder)
        parent_id = filters.get("parent_id")
        if parent_id is not None:
            stmt = stmt.where(Folder.parent_id == parent_id)
        elif "parent_id" in filters and filters["parent_id"] is None:
            stmt = stmt.where(Folder.parent_id.is_(None))
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_children(self, parent_id: Optional[int]) -> List[Folder]:
        stmt = select(Folder)
        if parent_id is None:
            stmt = stmt.where(Folder.parent_id.is_(None))
        else:
            stmt = stmt.where(Folder.parent_id == parent_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj: dict) -> Folder:
        now = utcnow()
        folder = Folder(
            name=obj["name"],
            parent_id=obj.get("parent_id"),
            team_shared=obj.get("team_shared", False),
            created_at=now,
        )
        self.session.add(folder)
        await self.session.flush()
        await self.session.refresh(folder)
        return folder

    async def update(self, id: int, obj: dict) -> Optional[Folder]:
        folder = await self.get(id)
        if folder is None:
            return None
        for key, value in obj.items():
            if hasattr(folder, key):
                setattr(folder, key, value)
        await self.session.flush()
        await self.session.refresh(folder)
        return folder

    async def delete(self, id: int) -> bool:
        folder = await self.get(id)
        if folder is None:
            return False
        await self.session.delete(folder)
        await self.session.flush()
        return True

    async def count(self, **filters) -> int:
        stmt = select(func.count()).select_from(Folder)
        parent_id = filters.get("parent_id")
        if parent_id is not None:
            stmt = stmt.where(Folder.parent_id == parent_id)
        result = await self.session.execute(stmt)
        return result.scalar_one()


class SQLitePromptRepository(AbstractPromptRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: int) -> Optional[Prompt]:
        result = await self.session.get(Prompt, id)
        return result

    async def list(self, skip: int = 0, limit: int = 20, **filters) -> List[Prompt]:
        stmt = select(Prompt)
        folder_id = filters.get("folder_id")
        if folder_id is not None:
            stmt = stmt.where(Prompt.folder_id == folder_id)
        stmt = stmt.order_by(Prompt.updated_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self, **filters) -> int:
        stmt = select(func.count()).select_from(Prompt)
        folder_id = filters.get("folder_id")
        if folder_id is not None:
            stmt = stmt.where(Prompt.folder_id == folder_id)
        tags = filters.get("tags")
        if tags:
            for tag in tags:
                stmt = stmt.where(Prompt.tags.contains(tag))
        query = filters.get("query")
        if query:
            stmt = stmt.where(
                or_(
                    Prompt.name.ilike(f"%{query}%"),
                    Prompt.description.ilike(f"%{query}%"),
                )
            )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def search(
        self,
        query: str,
        folder_id: Optional[int],
        tags: Optional[List[str]],
    ) -> List[Prompt]:
        stmt = select(Prompt)
        if query:
            stmt = stmt.where(
                or_(
                    Prompt.name.ilike(f"%{query}%"),
                    Prompt.description.ilike(f"%{query}%"),
                )
            )
        if folder_id is not None:
            stmt = stmt.where(Prompt.folder_id == folder_id)
        if tags:
            for tag in tags:
                stmt = stmt.where(Prompt.tags.contains(tag))
        stmt = stmt.order_by(Prompt.updated_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj: dict) -> Prompt:
        now = utcnow()
        tags_value = obj.get("tags")
        if isinstance(tags_value, list):
            tags_value = json.dumps(tags_value)
        prompt = Prompt(
            name=obj["name"],
            description=obj.get("description"),
            folder_id=obj.get("folder_id"),
            owner=obj.get("owner", "default"),
            tags=tags_value,
            created_at=now,
            updated_at=now,
        )
        self.session.add(prompt)
        await self.session.flush()
        await self.session.refresh(prompt)
        return prompt

    async def update(self, id: int, obj: dict) -> Optional[Prompt]:
        prompt = await self.get(id)
        if prompt is None:
            return None
        allowed = {"name", "description", "folder_id", "tags"}
        for key, value in obj.items():
            if key in allowed:
                if key == "tags" and isinstance(value, list):
                    value = json.dumps(value)
                setattr(prompt, key, value)
        prompt.updated_at = utcnow()
        await self.session.flush()
        await self.session.refresh(prompt)
        return prompt

    async def delete(self, id: int) -> bool:
        prompt = await self.get(id)
        if prompt is None:
            return False
        await self.session.delete(prompt)
        await self.session.flush()
        return True


class SQLiteVersionRepository(AbstractVersionRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: int) -> Optional[PromptVersion]:
        result = await self.session.get(PromptVersion, id)
        return result

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[PromptVersion]:
        stmt = select(PromptVersion).order_by(PromptVersion.version_number.desc())
        prompt_id = filters.get("prompt_id")
        if prompt_id is not None:
            stmt = stmt.where(PromptVersion.prompt_id == prompt_id)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_prompt(self, prompt_id: int) -> List[PromptVersion]:
        stmt = (
            select(PromptVersion)
            .where(PromptVersion.prompt_id == prompt_id)
            .order_by(PromptVersion.version_number.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_latest(self, prompt_id: int) -> Optional[PromptVersion]:
        stmt = (
            select(PromptVersion)
            .where(PromptVersion.prompt_id == prompt_id)
            .order_by(PromptVersion.version_number.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_next_version_number(self, prompt_id: int) -> int:
        stmt = select(func.max(PromptVersion.version_number)).where(
            PromptVersion.prompt_id == prompt_id
        )
        result = await self.session.execute(stmt)
        max_ver = result.scalar_one_or_none()
        return (max_ver or 0) + 1

    async def create(self, obj: dict) -> PromptVersion:
        now = utcnow()
        variables = obj.get("variables")
        if isinstance(variables, dict):
            variables = json.dumps(variables)
        version = PromptVersion(
            prompt_id=obj["prompt_id"],
            version_number=obj["version_number"],
            content=obj["content"],
            system_prompt=obj.get("system_prompt"),
            variables=variables,
            commit_message=obj.get("commit_message", ""),
            author=obj.get("author", "default"),
            created_at=now,
        )
        self.session.add(version)
        await self.session.flush()
        await self.session.refresh(version)
        return version

    async def update(self, id: int, obj: dict) -> Optional[PromptVersion]:
        # PromptVersion rows are IMMUTABLE — raise error
        raise NotImplementedError("PromptVersion rows are immutable. Create a new version instead.")

    async def delete(self, id: int) -> bool:
        version = await self.get(id)
        if version is None:
            return False
        await self.session.delete(version)
        await self.session.flush()
        return True

    async def count(self, **filters) -> int:
        stmt = select(func.count()).select_from(PromptVersion)
        prompt_id = filters.get("prompt_id")
        if prompt_id is not None:
            stmt = stmt.where(PromptVersion.prompt_id == prompt_id)
        result = await self.session.execute(stmt)
        return result.scalar_one()


class SQLitePricingRepository(AbstractPricingRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: int) -> Optional[ModelPricing]:
        return await self.session.get(ModelPricing, id)

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[ModelPricing]:
        stmt = select(ModelPricing).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_model(self, model_name: str) -> Optional[ModelPricing]:
        stmt = select(ModelPricing).where(ModelPricing.model_name == model_name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, obj: dict) -> ModelPricing:
        now = utcnow()
        pricing = ModelPricing(
            provider=obj["provider"],
            model_name=obj["model_name"],
            input_rate=obj["input_rate"],
            output_rate=obj["output_rate"],
            currency=obj.get("currency", "USD"),
            updated_at=now,
        )
        self.session.add(pricing)
        await self.session.flush()
        await self.session.refresh(pricing)
        return pricing

    async def update(self, id: int, obj: dict) -> Optional[ModelPricing]:
        pricing = await self.get(id)
        if pricing is None:
            return None
        allowed = {"provider", "model_name", "input_rate", "output_rate", "currency"}
        for key, value in obj.items():
            if key in allowed:
                setattr(pricing, key, value)
        pricing.updated_at = utcnow()
        await self.session.flush()
        await self.session.refresh(pricing)
        return pricing

    async def delete(self, id: int) -> bool:
        pricing = await self.get(id)
        if pricing is None:
            return False
        await self.session.delete(pricing)
        await self.session.flush()
        return True

    async def count(self, **filters) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(ModelPricing)
        )
        return result.scalar_one()


class SQLiteRunRepository(AbstractRunRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: int) -> Optional[TestRun]:
        return await self.session.get(TestRun, id)

    async def list(self, skip: int = 0, limit: int = 20, **filters) -> List[TestRun]:
        stmt = select(TestRun).order_by(TestRun.created_at.desc())
        version_id = filters.get("prompt_version_id")
        if version_id is not None:
            stmt = stmt.where(TestRun.prompt_version_id == version_id)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_version(self, prompt_version_id: int) -> List[TestRun]:
        stmt = (
            select(TestRun)
            .where(TestRun.prompt_version_id == prompt_version_id)
            .order_by(TestRun.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj: dict) -> TestRun:
        now = utcnow()
        run = TestRun(
            prompt_version_id=obj["prompt_version_id"],
            status=obj.get("status", "pending"),
            created_at=now,
        )
        self.session.add(run)
        await self.session.flush()
        await self.session.refresh(run)
        return run

    async def update(self, id: int, obj: dict) -> Optional[TestRun]:
        run = await self.get(id)
        if run is None:
            return None
        for key, value in obj.items():
            if hasattr(run, key):
                setattr(run, key, value)
        await self.session.flush()
        await self.session.refresh(run)
        return run

    async def delete(self, id: int) -> bool:
        run = await self.get(id)
        if run is None:
            return False
        await self.session.delete(run)
        await self.session.flush()
        return True

    async def count(self, **filters) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(TestRun)
        )
        return result.scalar_one()


class SQLiteRunResultRepository(AbstractRunResultRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: int) -> Optional[RunResult]:
        return await self.session.get(RunResult, id)

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[RunResult]:
        stmt = select(RunResult)
        run_id = filters.get("test_run_id")
        if run_id is not None:
            stmt = stmt.where(RunResult.test_run_id == run_id)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_run(self, test_run_id: int) -> List[RunResult]:
        stmt = (
            select(RunResult)
            .where(RunResult.test_run_id == test_run_id)
            .order_by(RunResult.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj: dict) -> RunResult:
        now = utcnow()
        rr = RunResult(
            test_run_id=obj["test_run_id"],
            model_name=obj["model_name"],
            output_text=obj.get("output_text"),
            input_tokens=obj.get("input_tokens"),
            output_tokens=obj.get("output_tokens"),
            cost=obj.get("cost"),
            latency_ms=obj.get("latency_ms"),
            error=obj.get("error"),
            rating=obj.get("rating"),
            rating_tag=obj.get("rating_tag"),
            passed=obj.get("passed"),
            created_at=now,
        )
        self.session.add(rr)
        await self.session.flush()
        await self.session.refresh(rr)
        return rr

    async def update(self, id: int, obj: dict) -> Optional[RunResult]:
        rr = await self.get(id)
        if rr is None:
            return None
        for key, value in obj.items():
            if hasattr(rr, key):
                setattr(rr, key, value)
        await self.session.flush()
        await self.session.refresh(rr)
        return rr

    async def update_rating(self, id: int, rating: int, tag: Optional[str]) -> Optional[RunResult]:
        rr = await self.get(id)
        if rr is None:
            return None
        rr.rating = rating
        rr.rating_tag = tag
        await self.session.flush()
        await self.session.refresh(rr)
        return rr

    async def delete(self, id: int) -> bool:
        rr = await self.get(id)
        if rr is None:
            return False
        await self.session.delete(rr)
        await self.session.flush()
        return True

    async def count(self, **filters) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(RunResult)
        )
        return result.scalar_one()


class SQLiteAssetRepository(AbstractAssetRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: int) -> Optional[Asset]:
        return await self.session.get(Asset, id)

    async def get_by_name(self, name: str) -> Optional[Asset]:
        stmt = select(Asset).where(Asset.name == name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list(self, skip: int = 0, limit: int = 20, **filters) -> List[Asset]:
        stmt = select(Asset)
        asset_type = filters.get("type")
        if asset_type:
            stmt = stmt.where(Asset.type == asset_type)
        owner = filters.get("owner")
        if owner:
            stmt = stmt.where(
                or_(Asset.owner == owner, Asset.team_shared.is_(True))
            )
        stmt = stmt.order_by(Asset.updated_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def search(self, query: str, asset_type: Optional[str]) -> List[Asset]:
        stmt = select(Asset)
        if query:
            stmt = stmt.where(
                or_(
                    Asset.name.ilike(f"%{query}%"),
                    Asset.content.ilike(f"%{query}%"),
                )
            )
        if asset_type:
            stmt = stmt.where(Asset.type == asset_type)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj: dict) -> Asset:
        now = utcnow()
        asset = Asset(
            name=obj["name"],
            content=obj["content"],
            type=obj.get("type", "snippet"),
            team_shared=obj.get("team_shared", False),
            owner=obj.get("owner", "default"),
            created_at=now,
            updated_at=now,
        )
        self.session.add(asset)
        await self.session.flush()
        await self.session.refresh(asset)
        return asset

    async def update(self, id: int, obj: dict) -> Optional[Asset]:
        asset = await self.get(id)
        if asset is None:
            return None
        allowed = {"name", "content", "type", "team_shared"}
        for key, value in obj.items():
            if key in allowed:
                setattr(asset, key, value)
        asset.updated_at = utcnow()
        await self.session.flush()
        await self.session.refresh(asset)
        return asset

    async def delete(self, id: int) -> bool:
        asset = await self.get(id)
        if asset is None:
            return False
        await self.session.delete(asset)
        await self.session.flush()
        return True

    async def count(self, **filters) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(Asset)
        )
        return result.scalar_one()


class SQLiteTestCaseRepository(AbstractTestCaseRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: int) -> Optional[TestCase]:
        return await self.session.get(TestCase, id)

    async def list(self, skip: int = 0, limit: int = 20, **filters) -> List[TestCase]:
        stmt = select(TestCase)
        version_id = filters.get("prompt_version_id")
        if version_id is not None:
            stmt = stmt.where(TestCase.prompt_version_id == version_id)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_version(self, prompt_version_id: int) -> List[TestCase]:
        stmt = (
            select(TestCase)
            .where(TestCase.prompt_version_id == prompt_version_id)
            .order_by(TestCase.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj: dict) -> TestCase:
        now = utcnow()
        variable_inputs = obj.get("variable_inputs")
        if isinstance(variable_inputs, dict):
            variable_inputs = json.dumps(variable_inputs)
        tc = TestCase(
            name=obj["name"],
            prompt_version_id=obj["prompt_version_id"],
            variable_inputs=variable_inputs,
            assertion_type=obj.get("assertion_type"),
            assertion_value=obj.get("assertion_value"),
            created_at=now,
        )
        self.session.add(tc)
        await self.session.flush()
        await self.session.refresh(tc)
        return tc

    async def update(self, id: int, obj: dict) -> Optional[TestCase]:
        tc = await self.get(id)
        if tc is None:
            return None
        allowed = {"name", "variable_inputs", "assertion_type", "assertion_value"}
        for key, value in obj.items():
            if key in allowed:
                if key == "variable_inputs" and isinstance(value, dict):
                    value = json.dumps(value)
                setattr(tc, key, value)
        await self.session.flush()
        await self.session.refresh(tc)
        return tc

    async def delete(self, id: int) -> bool:
        tc = await self.get(id)
        if tc is None:
            return False
        await self.session.delete(tc)
        await self.session.flush()
        return True

    async def count(self, **filters) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(TestCase)
        )
        return result.scalar_one()

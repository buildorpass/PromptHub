from datetime import datetime
from typing import Optional, List

from sqlalchemy import ForeignKey, String, Text, Boolean, Float, Integer, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("folders.id"), nullable=True
    )
    team_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    parent: Mapped[Optional["Folder"]] = relationship(
        "Folder", remote_side="Folder.id", back_populates="children"
    )
    children: Mapped[List["Folder"]] = relationship(
        "Folder", back_populates="parent"
    )
    prompts: Mapped[List["Prompt"]] = relationship(
        "Prompt", back_populates="folder"
    )


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    folder_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("folders.id"), nullable=True
    )
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list as string
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    folder: Mapped[Optional["Folder"]] = relationship("Folder", back_populates="prompts")
    versions: Mapped[List["PromptVersion"]] = relationship(
        "PromptVersion", back_populates="prompt", order_by="PromptVersion.version_number"
    )


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    prompt_id: Mapped[int] = mapped_column(ForeignKey("prompts.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    variables: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: {"var_name": "description"}
    commit_message: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # IMMUTABLE — never update rows

    prompt: Mapped["Prompt"] = relationship("Prompt", back_populates="versions")
    test_runs: Mapped[List["TestRun"]] = relationship(
        "TestRun", back_populates="prompt_version"
    )
    test_cases: Mapped[List["TestCase"]] = relationship(
        "TestCase", back_populates="prompt_version"
    )


class ModelPricing(Base):
    __tablename__ = "model_pricing"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    input_rate: Mapped[float] = mapped_column(Float, nullable=False)   # $ per 1K input tokens
    output_rate: Mapped[float] = mapped_column(Float, nullable=False)  # $ per 1K output tokens
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    prompt_version_id: Mapped[int] = mapped_column(
        ForeignKey("prompt_versions.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # pending, running, completed, failed
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    prompt_version: Mapped["PromptVersion"] = relationship(
        "PromptVersion", back_populates="test_runs"
    )
    results: Mapped[List["RunResult"]] = relationship(
        "RunResult", back_populates="test_run"
    )


class RunResult(Base):
    __tablename__ = "run_results"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    test_run_id: Mapped[int] = mapped_column(ForeignKey("test_runs.id"), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    output_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    input_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5
    rating_tag: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    passed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    test_run: Mapped["TestRun"] = relationship("TestRun", back_populates="results")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)  # snippet, system_prompt, format_spec, etc.
    team_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_version_id: Mapped[int] = mapped_column(
        ForeignKey("prompt_versions.id"), nullable=False
    )
    variable_inputs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    assertion_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # exact, contains, regex, manual
    assertion_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    prompt_version: Mapped["PromptVersion"] = relationship(
        "PromptVersion", back_populates="test_cases"
    )

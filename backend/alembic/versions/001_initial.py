"""Initial schema — all tables

Revision ID: 001
Revises:
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # folders
    op.create_table(
        "folders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("team_shared", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["folders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # prompts
    op.create_table(
        "prompts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("folder_id", sa.Integer(), nullable=True),
        sa.Column("owner", sa.String(length=255), nullable=False),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["folder_id"], ["folders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # prompt_versions
    op.create_table(
        "prompt_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("prompt_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("variables", sa.Text(), nullable=True),
        sa.Column("commit_message", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["prompt_id"], ["prompts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_prompt_versions_prompt_id",
        "prompt_versions",
        ["prompt_id"],
    )

    # model_pricing
    op.create_table(
        "model_pricing",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("provider", sa.String(length=100), nullable=False),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("input_rate", sa.Float(), nullable=False),
        sa.Column("output_rate", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_model_pricing_model_name",
        "model_pricing",
        ["model_name"],
        unique=True,
    )

    # test_runs
    op.create_table(
        "test_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("prompt_version_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["prompt_version_id"], ["prompt_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # run_results
    op.create_table(
        "run_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("test_run_id", sa.Integer(), nullable=False),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("output_text", sa.Text(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("rating_tag", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["test_run_id"], ["test_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # assets
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("team_shared", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("owner", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_assets_name",
        "assets",
        ["name"],
        unique=True,
    )

    # test_cases
    op.create_table(
        "test_cases",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("prompt_version_id", sa.Integer(), nullable=False),
        sa.Column("variable_inputs", sa.Text(), nullable=True),
        sa.Column("assertion_type", sa.String(length=50), nullable=True),
        sa.Column("assertion_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["prompt_version_id"], ["prompt_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("test_cases")
    op.drop_index("ix_assets_name", table_name="assets")
    op.drop_table("assets")
    op.drop_table("run_results")
    op.drop_table("test_runs")
    op.drop_index("ix_model_pricing_model_name", table_name="model_pricing")
    op.drop_table("model_pricing")
    op.drop_index("ix_prompt_versions_prompt_id", table_name="prompt_versions")
    op.drop_table("prompt_versions")
    op.drop_table("prompts")
    op.drop_table("folders")

"""add message generation_seconds

Revision ID: e2f4a6b8c0d2
Revises: d1f3a2b4c5e6
Create Date: 2026-11-25 11:25:00.000000
"""

from typing import Sequence, Union
from alembic import op, context
import sqlalchemy as sa

revision: str = "e2f4a6b8c0d2"
down_revision: Union[str, None] = "d1f3a2b4c5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set:
    if context.is_offline_mode():
        return set()
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    if "generation_seconds" not in _columns("messages"):
        op.add_column(
            "messages",
            sa.Column("generation_seconds", sa.Float(), nullable=True),
        )


def downgrade() -> None:
    if "generation_seconds" in _columns("messages"):
        op.drop_column("messages", "generation_seconds")

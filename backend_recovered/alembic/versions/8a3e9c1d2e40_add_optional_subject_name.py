"""add optional_subject_name to profiles

Revision ID: 8a3e9c1d2e40
Revises: 7f2d4e1b8c30
Create Date: 2026-10-26 21:25:00.000000

"""

from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a3e9c1d2e40"
down_revision: Union[str, None] = "7f2d4e1b8c30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if context.is_offline_mode():
        op.add_column("profiles", sa.Column("optional_subject_name", sa.String(length=80), nullable=True))
        return
    bind = op.get_bind()
    columns = {c["name"] for c in sa.inspect(bind).get_columns("profiles")}
    if "optional_subject_name" not in columns:
        op.add_column("profiles", sa.Column("optional_subject_name", sa.String(length=80), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("profiles") as batch:
        batch.drop_column("optional_subject_name")

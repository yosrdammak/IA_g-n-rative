"""candidate constraints and program characteristics

Revision ID: 7f2d4e1b8c30
Revises: 5b1e7a3c9d20
Create Date: 2026-10-26 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f2d4e1b8c30"
down_revision: Union[str, None] = "5b1e7a3c9d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PROFILE_COLUMNS = (
    ("max_budget", sa.Float()),
    ("study_duration", sa.Integer()),
    ("city", sa.String(length=80)),
    ("learning_style", sa.String(length=40)),
)
PROGRAM_COLUMNS = (
    ("annual_tuition", sa.Float()),
    ("duration_years", sa.Integer()),
    ("city", sa.String(length=80)),
    ("learning_style", sa.String(length=40)),
)


def _existing(table):
    if context.is_offline_mode():
        return set()
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    for table, columns in (("profiles", PROFILE_COLUMNS), ("programs", PROGRAM_COLUMNS)):
        existing = _existing(table)
        for name, type_ in columns:
            if name not in existing:
                op.add_column(table, sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    for table, columns in (("profiles", PROFILE_COLUMNS), ("programs", PROGRAM_COLUMNS)):
        with op.batch_alter_table(table) as batch:
            for name, _ in reversed(columns):
                batch.drop_column(name)

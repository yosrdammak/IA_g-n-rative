"""academic profile (bac, grades) and program selection criteria

Revision ID: 5b1e7a3c9d20
Revises: c04e8bf0b0ad
Create Date: 2026-10-25 21:00:00.000000

"""

from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5b1e7a3c9d20"
down_revision: Union[str, None] = "c04e8bf0b0ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PROFILE_COLUMNS = (
    ("bac_section", sa.String(length=40)),
    ("bac_year", sa.Integer()),
    ("bac_average", sa.Float()),
    ("subject_grades", sa.JSON()),
)
PROGRAM_COLUMNS = (
    ("accepted_bac_sections", sa.JSON()),
    ("min_average", sa.Float()),
    ("key_subjects", sa.JSON()),
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

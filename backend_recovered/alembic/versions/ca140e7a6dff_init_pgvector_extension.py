"""init_pgvector_extension

Revision ID: ca140e7a6dff
Revises:
Create Date: 2026-10-11 01:12:09.740383

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ca140e7a6dff"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Compatibility with the original PostgreSQL setup; unused by lexical matching.
    if op.get_context().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")


def downgrade() -> None:
    pass

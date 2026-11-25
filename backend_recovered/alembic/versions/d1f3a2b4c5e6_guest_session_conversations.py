"""guest session conversations (SA-25/26/29)

Revision ID: d1f3a2b4c5e6
Revises: 8a3e9c1d2e40
Create Date: 2026-11-18 10:00:00.000000

Rend conversations.user_id nullable pour les visiteurs sans compte,
et ajoute session_token (UUID) pour identifier les sessions anonymes.
SA-29 : claimed_by_user_id permet de rattacher une conversation invitée
à un compte candidat après inscription/connexion.
"""

from typing import Sequence, Union
from alembic import op, context
import sqlalchemy as sa

revision: str = "d1f3a2b4c5e6"
down_revision: Union[str, None] = "8a3e9c1d2e40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set:
    if context.is_offline_mode():
        return set()
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    existing = _columns("conversations")

    # 1. Rendre user_id nullable (visiteurs sans compte)
    with op.batch_alter_table("conversations") as batch:
        batch.alter_column(
            "user_id",
            existing_type=sa.Integer(),
            nullable=True,
        )

    # 2. Ajouter session_token pour identifier la session visiteur
    if "session_token" not in existing:
        op.add_column(
            "conversations",
            sa.Column("session_token", sa.String(length=64), nullable=True, index=True),
        )

    # 3. Ajouter expires_at pour expirer les sessions anonymes après 24 h
    if "expires_at" not in existing:
        op.add_column(
            "conversations",
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    with op.batch_alter_table("conversations") as batch:
        batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
        batch.drop_column("expires_at")
        batch.drop_column("session_token")

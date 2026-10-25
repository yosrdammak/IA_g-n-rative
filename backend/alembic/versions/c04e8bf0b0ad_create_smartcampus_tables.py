"""create smartcampus tables

Revision ID: c04e8bf0b0ad
Revises: ca140e7a6dff
Create Date: 2026-10-25 18:45:41.006816

"""

from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c04e8bf0b0ad"
down_revision: Union[str, None] = "ca140e7a6dff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing_tables = (
        set()
        if context.is_offline_mode()
        else set(sa.inspect(op.get_bind()).get_table_names())
    )
    if "programs" not in existing_tables:
        op.create_table(
            "programs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("institution", sa.String(length=10), nullable=False),
            sa.Column("category", sa.String(length=80), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("prerequisites", sa.Text(), nullable=True),
            sa.Column("outcomes", sa.Text(), nullable=True),
            sa.Column("published", sa.Boolean(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("full_name", sa.String(length=150), nullable=False),
            sa.Column("role", sa.String(length=35), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    if "users" not in existing_tables or "ix_users_email" not in {
        i["name"] for i in sa.inspect(op.get_bind()).get_indexes("users")
    }:
        op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    if "applications" not in existing_tables:
        op.create_table(
            "applications",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("program_id", sa.Integer(), nullable=False),
            sa.Column("phone", sa.String(length=30), nullable=False),
            sa.Column("consent", sa.Boolean(), nullable=False),
            sa.Column("status", sa.String(length=45), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(
                ["program_id"],
                ["programs.id"],
            ),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id", "program_id", name="uq_application_user_program"
            ),
        )
    if "conversations" not in existing_tables:
        op.create_table(
            "conversations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    if "profiles" not in existing_tables:
        op.create_table(
            "profiles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("academic_level", sa.String(length=120), nullable=True),
            sa.Column("interests", sa.Text(), nullable=True),
            sa.Column("goals", sa.Text(), nullable=True),
            sa.Column("preferred_language", sa.String(length=30), nullable=True),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id"),
        )
    if "appointments" not in existing_tables:
        op.create_table(
            "appointments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.Integer(), nullable=False),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(length=35), nullable=True),
            sa.ForeignKeyConstraint(
                ["application_id"],
                ["applications.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("application_id"),
        )
    if "messages" not in existing_tables:
        op.create_table(
            "messages",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("conversation_id", sa.Integer(), nullable=False),
            sa.Column("sender", sa.String(length=15), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(
                ["conversation_id"],
                ["conversations.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    if "quizzes" not in existing_tables:
        op.create_table(
            "quizzes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.Integer(), nullable=False),
            sa.Column("questions", sa.JSON(), nullable=False),
            sa.Column("answers", sa.JSON(), nullable=True),
            sa.Column("score", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(
                ["application_id"],
                ["applications.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("application_id"),
        )
    if "applications" in existing_tables:
        # Original prototype created tables with create_all, without migrations.
        # Adopt that schema without discarding users, profiles or applications.
        constraints = sa.inspect(op.get_bind()).get_unique_constraints("applications")
        if not any(
            set(c["column_names"]) == {"user_id", "program_id"} for c in constraints
        ):
            duplicates = (
                op.get_bind()
                .execute(
                    sa.text(
                        "SELECT user_id, program_id FROM applications GROUP BY user_id, program_id HAVING COUNT(*) > 1"
                    )
                )
                .first()
            )
            if duplicates:
                raise RuntimeError(
                    "Anciennes candidatures en double : résoudre les doublons user_id/program_id avant la migration. Aucune candidature supprimée automatiquement."
                )
            with op.batch_alter_table("applications") as batch:
                batch.create_unique_constraint(
                    "uq_application_user_program", ["user_id", "program_id"]
                )


def downgrade() -> None:
    op.drop_table("quizzes")
    op.drop_table("messages")
    op.drop_table("appointments")
    op.drop_table("profiles")
    op.drop_table("conversations")
    op.drop_table("applications")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_table("programs")

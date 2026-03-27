"""Initial OpenRAG schema with pgvector.

Revision ID: 20250324120000
Revises:
Create Date: 2025-03-24

"""

from typing import Sequence, Union

from alembic import op

from app.db import models  # noqa: F401
from app.db.base import Base

revision: str = "20250324120000"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    bind = op.get_bind()
    Base.metadata.create_all(bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind)
    op.execute("DROP EXTENSION IF EXISTS vector CASCADE")

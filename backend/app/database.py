from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.exc import IntegrityError, ProgrammingError
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

settings = get_settings()

engine_kwargs = {
    "echo": False,
}

if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update(
        {
            "pool_size": 20,
            "max_overflow": 10,
            "pool_pre_ping": True,
        }
    )

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables and migrate schema.
    create_all only creates NEW tables — it won't add columns to existing ones.
    We handle column migrations manually for production deployments.
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except (IntegrityError, ProgrammingError) as e:
        if "already exists" in str(e):
            logger.warning("DB schema race condition (safe to ignore): %s", e.orig)
        else:
            raise

    # Add missing columns to existing tables
    await _migrate_columns()


async def _migrate_columns():
    """Safely add new columns to existing tables."""
    from sqlalchemy import text

    migrations = [
        ("tasks", "priority", "VARCHAR(20) DEFAULT 'medium' NOT NULL"),
        ("tasks", "due_date", "DATE"),
    ]

    async with engine.begin() as conn:
        for table, column, col_type in migrations:
            try:
                if settings.DATABASE_URL.startswith("sqlite"):
                    # SQLite: no IF NOT EXISTS for columns, use try/except
                    await conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                    )
                    logger.info("Added column %s.%s", table, column)
                else:
                    # PostgreSQL: check information_schema first
                    result = await conn.execute(text(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_name = :table AND column_name = :column"
                    ), {"table": table, "column": column})
                    if not result.fetchone():
                        await conn.execute(
                            text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                        )
                        logger.info("Added column %s.%s", table, column)
            except Exception as e:
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                    pass  # Column already exists, safe to ignore
                else:
                    logger.warning("Migration warning for %s.%s: %s", table, column, e)


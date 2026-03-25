import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
from app.routers import auth, workspaces, tasks, activity
from app.websocket.handlers import router as ws_router

# Import models so they register with Base.metadata
from app.models import user, workspace, task, activity as activity_model  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 Starting SyncBoard API...")
    await init_db()
    logger.info("✅ Database tables created/verified")
    yield
    logger.info("👋 SyncBoard API shutting down")


app = FastAPI(
    title="SyncBoard Collab API",
    description="Real-time collaborative workspace & task management",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.BACKEND_CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST Routers
app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(tasks.router)
app.include_router(activity.router)

# WebSocket Router
app.include_router(ws_router)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "SyncBoard Collab API"}

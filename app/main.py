"""OpenRAG FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    activity,
    chat,
    documents,
    flashcards,
    health,
    highlights,
    notes,
    quizzes,
    search,
    users,
)
from app.core.config import cors_origins_list, get_settings
from app.core.logging import setup_logging


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    get_settings().upload_dir_path.mkdir(parents=True, exist_ok=True)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        debug=settings.debug,
    )

    # CORS first (before routes) so preflight OPTIONS always gets headers when origin matches.
    origins = cors_origins_list()
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.get("/healthz", tags=["health"])
    async def healthz() -> dict[str, str]:
        """Liveness probe for platforms (e.g. Render). No DB, no API key — use as Health Check Path."""
        return {"status": "live"}

    p = settings.api_prefix
    app.include_router(health.router, prefix=p)
    app.include_router(users.router, prefix=p)
    app.include_router(documents.router, prefix=p)
    app.include_router(chat.router, prefix=p)
    app.include_router(search.router, prefix=p)
    app.include_router(quizzes.router, prefix=p)
    app.include_router(flashcards.router, prefix=p)
    app.include_router(notes.router, prefix=p)
    app.include_router(highlights.router, prefix=p)
    app.include_router(activity.router, prefix=p)
    return app


app = create_app()

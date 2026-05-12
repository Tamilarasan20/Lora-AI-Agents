"""FastAPI app entrypoint."""

from __future__ import annotations

import logging

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routers import agents, health, llm


def _configure_logging() -> None:
    logging.basicConfig(level=settings.log_level.upper())
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO),
        ),
        cache_logger_on_first_use=True,
    )


def create_app() -> FastAPI:
    _configure_logging()
    app = FastAPI(
        title="Loraloop API",
        version="0.1.0",
        description="Autonomous AI marketing team — FastAPI backend",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["health"])
    app.include_router(llm.router, prefix="/llm", tags=["llm"])
    app.include_router(agents.router, prefix="/agents", tags=["agents"])

    return app


app = create_app()

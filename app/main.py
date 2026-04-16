"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from urllib.parse import unquote

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_compare, routes_conversations, routes_passage, routes_query
from app.config import get_settings
from app.db.database import engine

logger = structlog.get_logger(__name__)


def _setup_otel(app: FastAPI, settings) -> bool:
    """Configure OpenTelemetry. Returns True if successfully set up."""
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import (
        BatchSpanProcessor,
        ConsoleSpanExporter,
        SimpleSpanProcessor,
    )

    # Parse "Key=Value,Key2=Value2" — URL-decode so Grafana Cloud %20 tokens work
    headers: dict[str, str] = {}
    for pair in settings.otel_exporter_otlp_headers.split(","):
        if "=" in pair:
            k, v = pair.split("=", 1)
            headers[k.strip()] = unquote(v.strip())

    resource = Resource.create({"service.name": settings.otel_service_name})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(
        endpoint=settings.otel_exporter_otlp_endpoint,
        headers=headers,
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    if settings.environment != "production":
        provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
    SQLAlchemyInstrumentor().instrument(
        engine=engine.sync_engine,
        tracer_provider=provider,
    )

    logger.info(
        "otel configured",
        endpoint=settings.otel_exporter_otlp_endpoint,
        headers_keys=list(headers.keys()),
    )
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("starting gospel-rag api", environment=settings.environment)

    otel_active = False
    if settings.otel_exporter_otlp_endpoint:
        try:
            otel_active = _setup_otel(app, settings)
        except Exception as exc:
            logger.error("otel setup failed — tracing disabled", error=str(exc))

    yield

    await engine.dispose()

    if otel_active:
        from opentelemetry import trace

        tp = trace.get_tracer_provider()
        if hasattr(tp, "force_flush"):
            tp.force_flush(timeout_millis=5000)
        if hasattr(tp, "shutdown"):
            tp.shutdown()

    logger.info("gospel-rag api shut down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Gospel RAG API",
        description="RAG system for the four Gospels with streaming chat",
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_query.router)
    app.include_router(routes_compare.router)
    app.include_router(routes_passage.router)
    app.include_router(routes_conversations.router)

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "gospel-rag"}

    return app


app = create_app()

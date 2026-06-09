"""
BrewTrade AI - FastAPI application entry point.
"""
import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from database import Base, engine, SessionLocal
from models import Customer  # noqa: F401  (ensure models are imported for create_all)

logger = logging.getLogger("brewtrade.scheduler")

# Routers
from routers import (
    auth,
    customers,
    products,
    merchandise,
    orders,
    promotions,
    documents,
    inventory,
    ai,
    simulation,
    analytics,
)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="BrewTrade AI - International Product Ordering & Approval Intelligence Platform",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
os.makedirs(settings.STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")


# Routers
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(products.router)
app.include_router(merchandise.router)
app.include_router(orders.router)
app.include_router(promotions.router)
app.include_router(documents.router)
app.include_router(inventory.router)
app.include_router(ai.router)
app.include_router(simulation.router)
app.include_router(analytics.router)


# ---------------------------------------------------------------------------
# Background scheduler (APScheduler) - drives the simulation auto-tick.
# ---------------------------------------------------------------------------
scheduler: BackgroundScheduler = BackgroundScheduler(daemon=True)


def _scheduled_auto_tick() -> None:
    """
    Job body for the APScheduler interval trigger. Opens its own DB
    session because the FastAPI request scope is not available here.
    Any exception is caught and logged so a single bad tick doesn't
    kill the scheduler.
    """
    from services.simulation_engine import SimulationEngine

    db = SessionLocal()
    try:
        result = SimulationEngine().simulate_auto_tick(db)
        affected = len(result.get("affected_entities", []))
        if affected:
            logger.info("auto-tick advanced %d order(s)", affected)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("auto-tick failed: %s", exc)
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    """Create tables, seed initial data, and start the background scheduler."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        from models import Customer as CustomerModel
        if db.query(CustomerModel).count() == 0:
            try:
                from services.seed_data import seed_all
                seed_all(db)
            except Exception as e:
                print(f"[startup] Seeding skipped/failed: {e}")
    finally:
        db.close()

    # Start the simulation auto-tick. Guard against duplicate registration
    # if the startup hook is somehow invoked twice (e.g. reloader).
    if not scheduler.running:
        scheduler.add_job(
            _scheduled_auto_tick,
            trigger="interval",
            seconds=60,
            id="simulation_auto_tick",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        try:
            scheduler.start()
            logger.info("BackgroundScheduler started (simulation_auto_tick @ 60s)")
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Failed to start scheduler: %s", exc)


@app.on_event("shutdown")
def on_shutdown():
    """Stop the background scheduler cleanly on app shutdown."""
    try:
        if scheduler.running:
            scheduler.shutdown(wait=False)
            logger.info("BackgroundScheduler stopped")
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Error during scheduler shutdown: %s", exc)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }

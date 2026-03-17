"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Import and register routers
from app.api import jobs, job_profiles, roles, students, matching, reports, graph, companies, resumes

app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(job_profiles.router, prefix="/api/job-profiles", tags=["job-profiles"])
app.include_router(roles.router, prefix="/api/roles", tags=["roles"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(matching.router, prefix="/api/matching", tags=["matching"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(companies.router, prefix="/api", tags=["companies"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

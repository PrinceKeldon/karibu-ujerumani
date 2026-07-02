from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, listings, community, checklist, messages, bookings, ai, support, geography
from .seed import run_seed

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Karibu Ujerumani API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(community.router)
app.include_router(checklist.router)
app.include_router(messages.router)
app.include_router(bookings.router)
app.include_router(ai.router)
app.include_router(support.router)
app.include_router(geography.router)


@app.on_event("startup")
def startup() -> None:
    run_seed()


@app.get("/health")
def health():
    return {"status": "ok", "service": "Karibu Ujerumani API v1"}

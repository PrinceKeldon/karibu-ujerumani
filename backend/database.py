from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from .config import settings


def database_url_and_connect_args(database_url: str) -> tuple[str, dict]:
    parsed = urlsplit(database_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.pop("pgbouncer", None)

    is_supabase = parsed.hostname and "supabase.com" in parsed.hostname
    connect_args = {}
    if is_supabase and "sslmode" not in query:
        connect_args["sslmode"] = "require"

    normalized_url = urlunsplit(parsed._replace(query=urlencode(query)))
    return normalized_url, connect_args


database_url, connect_args = database_url_and_connect_args(settings.database_url)
# NullPool: let pgbouncer (Supabase Transaction Pooler) handle connection pooling
engine = create_engine(database_url, connect_args=connect_args, poolclass=NullPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

"""Launch the article acceptance fixtures on loopback only."""

from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import main


def run_preview() -> None:
    fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "articles"
    main.ARTICLES_FILE = fixtures / "catalog.json"
    main.ARTICLES_PREVIEW = True
    preview = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    preview.mount("/static/article-preview", StaticFiles(directory=fixtures / "covers"))
    preview.mount("/", main.app)
    uvicorn.run(preview, host="127.0.0.1", port=8791)


if __name__ == "__main__":
    run_preview()

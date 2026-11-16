"""FastAPI entry point for the personal blog and read-only notes."""

from __future__ import annotations

from datetime import date
from html import escape
from pathlib import Path
import re

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

from app.articles import IMAGE_TYPES, image_path, list_articles, read_article, render_article
from app.notes import current_note, monthly_notes


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "app" / "static"
NOTES_DIR = BASE_DIR / "notes"
SIGNATURE_FILE = BASE_DIR / "signature.txt"
ARTICLES_DIR = BASE_DIR / "articles"
templates = Environment(loader=FileSystemLoader(BASE_DIR / "app" / "templates"), autoescape=select_autoescape(["html"]))
MONTH_PATTERN = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")

app = FastAPI(title="EVARA'S BLOG", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def read_signature() -> str:
    try:
        signature = SIGNATURE_FILE.read_text(encoding="utf-8-sig").strip()
    except (OSError, UnicodeError):
        signature = ""
    return signature


def render_page(filename: str) -> HTMLResponse:
    signature = read_signature()
    footer = ""
    if signature:
        footer_class = "site-footer home-footer" if filename == "index.html" else "site-footer"
        footer = f'<footer class="{footer_class}"><p class="site-signature">{escape(signature)}</p></footer>'
    page = (STATIC_DIR / filename).read_text(encoding="utf-8-sig")
    return HTMLResponse(page.replace("<!-- SITE_FOOTER -->", footer), headers={"Cache-Control": "no-store"})


@app.get("/", include_in_schema=False)
def home() -> HTMLResponse:
    return article_page("home.html", articles=list_articles(ARTICLES_DIR)[:8], current="home")


def article_page(template: str, **context) -> HTMLResponse:
    page = templates.get_template(template).render(signature=read_signature(), **context)
    return HTMLResponse(page, headers={"Cache-Control": "no-store"})


@app.get("/articles", include_in_schema=False)
def articles() -> HTMLResponse:
    return article_page("articles.html", articles=list_articles(ARTICLES_DIR), current="articles")


@app.get("/articles/{slug}/assets/{name:path}", include_in_schema=False)
def article_image(slug: str, name: str) -> FileResponse:
    path = image_path(ARTICLES_DIR, slug, name)
    if path is None:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type=IMAGE_TYPES[path.suffix.lower()], headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"})


@app.get("/articles/{slug}", include_in_schema=False)
def article_detail(slug: str) -> HTMLResponse:
    article = read_article(ARTICLES_DIR, slug)
    if article is None:
        raise HTTPException(status_code=404, detail="Not found")
    html, toc = render_article(article)
    return article_page("article.html", article=article, content=Markup(html), toc=toc, current="articles")


@app.get("/now", include_in_schema=False)
def now() -> HTMLResponse:
    return render_page("now.html")


@app.get("/me", include_in_schema=False)
def me() -> HTMLResponse:
    return render_page("me.html")


@app.get("/api/current")
def get_current() -> dict:
    today = date.today()
    return {"today": today.isoformat(), "note": current_note(NOTES_DIR, today)}


@app.get("/api/notes")
def get_notes(month: str = Query(description="Month in YYYY-MM format")) -> dict:
    match = MONTH_PATTERN.fullmatch(month)
    if match is None:
        raise HTTPException(status_code=422, detail="month must be YYYY-MM")
    year, month_number = int(match.group(1)), int(match.group(2))
    if year < 1:
        raise HTTPException(status_code=422, detail="invalid year")
    return {"month": month, "notes": monthly_notes(NOTES_DIR, year, month_number)}

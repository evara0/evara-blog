"""FastAPI entry point for the personal blog and read-only notes."""

from __future__ import annotations

from datetime import date
from html import escape
from pathlib import Path
import re

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

from app.articles import load_articles, render_article, render_directory
from app.markdown_articles import IMAGE_TYPES, image_path, list_articles, read_article, render_article as render_markdown
from app.notes import current_note, monthly_notes
from app.technical_blog import load_technical_articles, render_technical_blog


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "app" / "static"
NOTES_DIR = BASE_DIR / "notes"
SIGNATURE_FILE = BASE_DIR / "signature.txt"
ARTICLES_FILE = BASE_DIR / "app" / "articles.json"
MARKDOWN_ARTICLES_DIR = BASE_DIR / "articles"
TECHNICAL_ARTICLES_FILE = BASE_DIR / "app" / "technical_articles.json"
TEMPLATES_DIR = STATIC_DIR.parent / "templates"
templates = Environment(loader=FileSystemLoader(TEMPLATES_DIR), autoescape=select_autoescape(["html"]))
ARTICLES_PREVIEW = False
MONTH_PATTERN = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")

app = FastAPI(title="EVARA'S BLOG", docs_url=None, redoc_url=None)
@app.get("/static/me.html", include_in_schema=False)
def old_personal_page() -> RedirectResponse:
    return RedirectResponse("/me", status_code=307, headers={"Cache-Control": "no-store"})


@app.get("/static/record-notes.html", include_in_schema=False)
@app.get("/records/notes", include_in_schema=False)
def record_notes() -> RedirectResponse:
    return RedirectResponse("/articles", status_code=308)


@app.get("/static/blog.html", include_in_schema=False)
def old_technical_blog() -> RedirectResponse:
    return RedirectResponse("/blog", status_code=308)


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def read_signature() -> str:
    try:
        return SIGNATURE_FILE.read_text(encoding="utf-8-sig").strip()
    except (OSError, UnicodeError):
        return ""


def render_page(filename: str, *, directory: Path = STATIC_DIR, **fragments: str) -> HTMLResponse:
    signature = read_signature()
    footer = ""
    if signature:
        footer_class = "site-footer home-footer" if filename == "index.html" else "site-footer"
        footer = f'<footer class="{footer_class}"><p class="site-signature">{escape(signature)}</p></footer>'
    page = (directory / filename).read_text(encoding="utf-8-sig")
    fragments["SITE_FOOTER"] = footer
    page = re.sub(r"<!-- ([A-Z_]+) -->", lambda match: fragments.get(match[1], match[0]), page)
    return HTMLResponse(page, headers={"Cache-Control": "no-store"})


@app.get("/", include_in_schema=False)
def home() -> HTMLResponse:
    latest = list_articles(MARKDOWN_ARTICLES_DIR)[:8]
    return render_page("index.html", HOME_ARTICLES=templates.get_template("home.html").render(articles=latest))


@app.get("/now", include_in_schema=False)
def now() -> HTMLResponse:
    return render_page("now.html")


@app.get("/me", include_in_schema=False)
def me() -> HTMLResponse:
    return render_page("me.html")


@app.get("/projects", include_in_schema=False)
def projects() -> HTMLResponse:
    return render_page("projects.html")


@app.get("/blog", include_in_schema=False)
def blog() -> HTMLResponse:
    return render_page(
        "blog.html",
        directory=TEMPLATES_DIR,
        MARKDOWN_ARTICLES=templates.get_template("_article_list.html").render(
            articles=list_articles(MARKDOWN_ARTICLES_DIR),
        ),
        TECHNICAL_BLOG_CONTENT=render_technical_blog(load_technical_articles(TECHNICAL_ARTICLES_FILE)),
    )


@app.get("/blog/{slug}/assets/{name:path}", include_in_schema=False)
def markdown_image(slug: str, name: str) -> FileResponse:
    path = image_path(MARKDOWN_ARTICLES_DIR, slug, name)
    if path is None:
        raise HTTPException(status_code=404, detail="找不到图片")
    return FileResponse(path, media_type=IMAGE_TYPES[path.suffix.lower()], headers={
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
    })


@app.get("/blog/{slug}", include_in_schema=False)
def markdown_article(slug: str) -> HTMLResponse:
    article = read_article(MARKDOWN_ARTICLES_DIR, slug)
    if article is None:
        raise HTTPException(status_code=404, detail="找不到这篇技术文章")
    html, toc = render_markdown(article)
    page = templates.get_template("article.html").render(
        article=article, content=Markup(html), toc=toc, signature=read_signature(),
    )
    return HTMLResponse(page, headers={"Cache-Control": "no-store"})


@app.get("/records", include_in_schema=False)
def records() -> HTMLResponse:
    return render_page("records.html")


@app.get("/articles", include_in_schema=False)
def articles() -> HTMLResponse:
    catalog = load_articles(ARTICLES_FILE)
    return render_page(
        "articles.html",
        directory=STATIC_DIR.parent / "templates",
        ARTICLE_TITLE="文章",
        ARTICLE_SCRIPT='<script src="/static/articles/carousel.js" defer></script>' if catalog else "",
        ARTICLE_CONTENT=render_directory(catalog, ARTICLES_PREVIEW),
    )


@app.get("/articles/{slug}", include_in_schema=False)
def article(slug: str) -> HTMLResponse:
    for entry in load_articles(ARTICLES_FILE):
        if entry.slug == slug:
            return render_page(
                "articles.html",
                directory=STATIC_DIR.parent / "templates",
                ARTICLE_TITLE=escape(entry.title),
                ARTICLE_SCRIPT="",
                ARTICLE_CONTENT=render_article(entry, ARTICLES_PREVIEW),
            )
    raise HTTPException(status_code=404, detail="找不到这篇文章")


@app.get("/records/media", include_in_schema=False)
def record_media() -> HTMLResponse:
    return render_page("record-media.html")


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

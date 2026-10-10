"""FastAPI entry point for the personal blog and read-only notes."""

from __future__ import annotations

from datetime import date
from html import escape
from pathlib import Path
import re

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.notes import current_note, monthly_notes


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "app" / "static"
NOTES_DIR = BASE_DIR / "notes"
SIGNATURE_FILE = BASE_DIR / "signature.txt"
MONTH_PATTERN = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")

app = FastAPI(title="EVARA'S BLOG", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def render_page(filename: str) -> HTMLResponse:
    try:
        signature = SIGNATURE_FILE.read_text(encoding="utf-8-sig").strip()
    except (OSError, UnicodeError):
        signature = ""
    footer = ""
    if signature:
        footer_class = "site-footer home-footer" if filename == "index.html" else "site-footer"
        footer = f'<footer class="{footer_class}"><p class="site-signature">{escape(signature)}</p></footer>'
    page = (STATIC_DIR / filename).read_text(encoding="utf-8-sig")
    return HTMLResponse(page.replace("<!-- SITE_FOOTER -->", footer), headers={"Cache-Control": "no-store"})


@app.get("/", include_in_schema=False)
def home() -> HTMLResponse:
    return render_page("index.html")


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

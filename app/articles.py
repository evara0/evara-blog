"""Read the public article catalog and render its directory and reading views."""

import json
from html import escape
from pathlib import Path

from fastapi import HTTPException
from pydantic import BaseModel, Field


class Article(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    cover: str = Field(pattern=r"^/static/(?:[a-zA-Z0-9_-]+/)*[a-zA-Z0-9_.-]+\.(?:avif|gif|jpe?g|png|svg|webp)$")
    cover_alt: str = Field(min_length=1)
    paragraphs: list[str] = Field(min_length=1)

    @property
    def url(self) -> str:
        return f"/articles/{self.slug}"


def load_articles(path: Path) -> list[Article]:
    try:
        records = json.loads(path.read_text(encoding="utf-8-sig"))
        if not isinstance(records, list):
            raise ValueError("expected an array")
        articles = [Article.model_validate(record) for record in records]
        if len({article.slug for article in articles}) != len(articles):
            raise ValueError("article slugs must be unique")
        return articles
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=503, detail="文章目录暂时无法读取") from error


def cover_image(article: Article) -> str:
    return f'<img src="{escape(article.cover)}" alt="{escape(article.cover_alt)}" width="960" height="720">'


def render_directory(articles: list[Article], preview: bool) -> str:
    label = '<p class="articles-preview">本机验收样例</p>' if preview else ""
    heading = f'<header class="articles-heading"><h1>文章</h1>{label}</header>'
    if not articles:
        return heading + """
          <div class="articles-empty">
            <div class="articles-empty-orbit" aria-hidden="true"></div>
            <p>还没有发布文章。</p>
          </div>"""

    radial = len(articles) <= 8
    index = "\n".join(index_item(article, i, len(articles)) for i, article in enumerate(articles))
    cards = "\n".join(
        f'<article class="article-card" inert>'
        f'<div class="article-card-heading"><span class="article-card-number" aria-hidden="true">{i:02d}</span>'
        f'<h2>{escape(article.title)}</h2></div>'
        f'<div class="article-card-excerpt"><p>{escape(article.summary)}</p>'
        f'<a class="article-read" href="{article.url}">阅读文章 <span aria-hidden="true">↗</span></a></div>'
        f'<figure class="article-cover">{cover_image(article)}</figure></article>'
        for i, article in enumerate(articles, 1)
    )
    fallback = "\n".join(
        f'<li><a href="{article.url}">{escape(article.title)}</a><p>{escape(article.summary)}</p></li>'
        for article in articles
    )
    controls = """
            <div class="articles-controls" aria-label="转盘控制">
              <button type="button" data-step="-1" aria-label="上一篇">←</button>
              <button type="button" data-step="1" aria-label="下一篇">→</button>
            </div>""" if len(articles) > 1 else ""
    return heading + f"""
          <ul class="articles-fallback">{fallback}</ul>
          <section class="articles-carousel" aria-label="文章转盘" hidden>
            <div class="articles-index{' is-radial' if radial else ''}">
              <div class="articles-index-hub">
                <h2>目录</h2>
                <p class="articles-count" aria-hidden="true"></p>
              </div>
              <ol>{index}</ol>
            </div>
            <div class="articles-visual">
              <div class="articles-track">{cards}</div>
              {controls}
            </div>
            <p class="articles-status" role="status"></p>
          </section>"""


def index_item(article: Article, position: int, total: int) -> str:
    angle = 360 * position / total - 25
    label_direction = " is-flipped" if 90 < angle < 270 else ""
    return (
        f'<li class="articles-spoke{label_direction}" style="--spoke-angle:{angle:g}deg">'
        f'<button type="button" aria-pressed="false" title="{escape(article.title)}">'
        f'<span class="articles-index-label"><span aria-hidden="true">{position + 1:02d}</span>'
        f'<span class="articles-index-title">{escape(article.title)}</span></span></button></li>'
    )


def render_article(article: Article, preview: bool) -> str:
    label = '<p class="articles-preview">本机验收样例</p>' if preview else ""
    paragraphs = "\n".join(f"<p>{escape(paragraph)}</p>" for paragraph in article.paragraphs)
    return f"""
          <article class="article-reading">
            <a class="article-back" href="/articles">← 返回文章目录</a>
            <header>{label}<h1>{escape(article.title)}</h1><p>{escape(article.summary)}</p></header>
            <figure>{cover_image(article)}</figure>
            <div class="article-prose">{paragraphs}</div>
          </article>"""

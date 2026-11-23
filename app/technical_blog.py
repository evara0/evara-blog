"""Load technical articles and render the journal's index and reading view."""

from html import escape
from pathlib import Path
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field, TypeAdapter


class TechnicalArticle(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    paragraphs: list[str] = Field(min_length=1)
    appearance: Literal["default", "data"] = "default"


TECHNICAL_ARTICLES = TypeAdapter(list[TechnicalArticle])


def load_technical_articles(path: Path) -> list[TechnicalArticle]:
    try:
        articles = TECHNICAL_ARTICLES.validate_json(path.read_text(encoding="utf-8-sig"))
        ids = {"main-content", "article-index", "article-index-title"}
        for article in articles:
            article_ids = {article.slug, f"{article.slug}-title"}
            if ids & article_ids:
                raise ValueError("technical article anchors must be unique")
            ids.update(article_ids)
        return articles
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=503, detail="技术博客暂时无法读取") from error


def render_technical_blog(articles: list[TechnicalArticle]) -> str:
    if not articles:
        return '<p class="journal-index">还没有发布技术文章。</p>'

    entries = []
    bodies = []
    for article in articles:
        slug = article.slug
        title = escape(article.title)
        summary = escape(article.summary)
        paragraphs = "\n".join(f"<p>{escape(paragraph)}</p>" for paragraph in article.paragraphs)
        variant = " journal-entry--data" if article.appearance == "data" else ""
        entries.append(f"""
            <li class="journal-entry{variant}">
              <a href="#{slug}">
                <h3>{title}</h3>
                <p>{summary}</p>
                <span class="journal-entry-arrow" aria-hidden="true">↘</span>
              </a>
            </li>""")
        bodies.append(f"""
          <article class="journal-article" id="{slug}" aria-labelledby="{slug}-title" tabindex="-1">
            <h2 id="{slug}-title">{title}</h2>
            {paragraphs}
            <a class="journal-back" href="#article-index">↑ 返回目录</a>
          </article>""")

    return f"""
          <section class="journal-index" id="article-index" aria-labelledby="article-index-title" tabindex="-1">
            <h2 id="article-index-title">文章目录</h2>
            <ul class="journal-grid">{"".join(entries)}
            </ul>
          </section>

          <div class="journal-reading">{"".join(bodies)}
          </div>"""

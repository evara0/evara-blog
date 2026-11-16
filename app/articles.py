"""Read and render locally maintained, published articles."""

from dataclasses import dataclass
from datetime import date, datetime
import logging
from pathlib import Path
import re
from urllib.parse import quote, unquote, urlsplit

from markdown_it import MarkdownIt
import yaml

LOG = logging.getLogger(__name__)
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
IMAGE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif"}


@dataclass(frozen=True)
class Article:
    slug: str
    title: str
    date: date
    summary: str
    tags: list[str]
    body: str


def read_article(root: Path, slug: str, today: date | None = None, *, include_body: bool = True) -> Article | None:
    if not SLUG.fullmatch(slug):
        return None
    folder = root / slug
    path = folder / "index.md"
    try:
        if folder.is_symlink() or path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            return None
        with path.open(encoding="utf-8-sig") as source:
            if source.readline().strip() != "---":
                raise ValueError("missing front matter")
            lines = []
            for line in source:
                if line.strip() == "---":
                    break
                lines.append(line)
            else:
                raise ValueError("unclosed front matter")
            metadata = yaml.safe_load("".join(lines))
            body = source.read() if include_body else ""
        if not isinstance(metadata, dict):
            raise ValueError("front matter must be a mapping")
        title, summary, tags = (metadata.get(key) for key in ("title", "summary", "tags"))
        published = metadata.get("date")
        draft = metadata.get("draft", False)
        if not all(isinstance(v, str) and v.strip() for v in (title, summary)):
            raise ValueError("title and summary must be nonempty strings")
        if not isinstance(tags, list) or not all(isinstance(tag, str) and tag.strip() for tag in tags):
            raise ValueError("tags must be a list of nonempty strings")
        if isinstance(published, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", published):
            published = date.fromisoformat(published)
        if not isinstance(published, date) or isinstance(published, datetime) or not isinstance(draft, bool):
            raise ValueError("invalid date or draft")
        if draft or published > (today or date.today()):
            return None
        return Article(slug, title.strip(), published, summary.strip(), [tag.strip() for tag in tags], body)
    except FileNotFoundError:
        return None
    except (OSError, UnicodeError, ValueError, yaml.YAMLError) as exc:
        LOG.warning("Skipping invalid article %s: %s", slug, exc)
        return None


def list_articles(root: Path) -> list[Article]:
    try:
        entries = list(root.iterdir())
    except (FileNotFoundError, NotADirectoryError):
        return []
    except OSError as exc:
        LOG.warning("Cannot read article directory: %s", exc)
        return []
    articles = [article for entry in entries if (article := read_article(root, entry.name, include_body=False))]
    return sorted(articles, key=lambda article: (-article.date.toordinal(), article.slug))


def image_path(root: Path, slug: str, name: str) -> Path | None:
    if not read_article(root, slug, include_body=False):
        return None
    parts = name.split("/")
    if not parts or any(not part or part in (".", "..") or "\\" in part or ":" in part or part.startswith(".") for part in parts):
        return None
    folder = root / slug
    path = folder
    try:
        for part in parts:
            path = path / part
            if path.is_symlink():
                return None
        if path.suffix.lower() not in IMAGE_TYPES or not path.resolve().is_relative_to(folder.resolve()) or not path.is_file():
            return None
    except OSError:
        return None
    return path


def render_article(article: Article) -> tuple[str, list[dict]]:
    md = MarkdownIt("js-default", {"html": False})
    tokens = md.parse(article.body)
    toc = []
    used = set()
    for index, token in enumerate(tokens):
        if token.type == "heading_open":
            inline = tokens[index + 1]
            label = "".join(child.content for child in inline.children or [] if child.type in ("text", "code_inline", "image"))
            base = re.sub(r"[^\w-]+", "-", label.lower(), flags=re.UNICODE).strip("-_") or "section"
            anchor, suffix = base, 2
            while anchor in used:
                anchor, suffix = f"{base}-{suffix}", suffix + 1
            used.add(anchor)
            token.attrSet("id", anchor)
            toc.append({"id": anchor, "label": label, "level": int(token.tag[1])})
        if token.type == "inline":
            for child in token.children or []:
                if child.type != "image":
                    continue
                src = child.attrGet("src") or ""
                parsed = urlsplit(src)
                if not parsed.scheme and not parsed.netloc:
                    name = unquote(parsed.path)
                    parts = name.split("/")
                    while parts and parts[0] == ".":
                        parts.pop(0)
                    if not parts or any(not part or part in (".", "..") or "\\" in part or ":" in part or part.startswith(".") for part in parts):
                        child.attrSet("src", "")
                    else:
                        child.attrSet("src", f"/articles/{article.slug}/assets/" + "/".join(quote(part, safe="") for part in parts))
    return md.renderer.render(tokens, md.options, {}), toc

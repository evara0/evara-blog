import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


FIXTURES = Path(__file__).parent / "fixtures" / "articles"


class ArticleTests(TestCase):
    def test_public_default_and_legacy_routes(self):
        with TestClient(app) as client:
            response = client.get("/articles")
            self.assertEqual(response.status_code, 200)
            self.assertIn("还没有发布文章", response.text)
            self.assertNotIn("本机验收样例", response.text)
            self.assertEqual(client.get("/articles/morning-streets").status_code, 404)
            self.assertEqual(client.get("/static/article-preview/morning-streets.webp").status_code, 404)
            for legacy in ("/records/notes", "/static/record-notes.html"):
                with self.subTest(legacy=legacy):
                    redirect = client.get(legacy, follow_redirects=False)
                    self.assertEqual(redirect.status_code, 308)
                    self.assertEqual(redirect.headers["location"], "/articles")
                    self.assertEqual(client.get(legacy).url.path, "/articles")

    def test_populated_directory_and_reading_pages(self):
        catalog = FIXTURES / "catalog.json"
        with patch("app.main.ARTICLES_FILE", catalog), patch("app.main.ARTICLES_PREVIEW", True), TestClient(app) as client:
            directory = client.get("/articles")
            self.assertEqual(directory.status_code, 200)
            self.assertIn("本机验收样例", directory.text)
            self.assertIn("/static/articles/carousel.js", directory.text)
            self.assertIn("上一篇", directory.text)
            for entry in json.loads(catalog.read_text(encoding="utf-8")):
                url = f"/articles/{entry['slug']}"
                with self.subTest(url=url):
                    self.assertIn(f'href="{url}"', directory.text)
                    self.assertIn(entry["summary"], directory.text)
                    reading = client.get(url)
                    self.assertEqual(reading.status_code, 200)
                    self.assertIn(f"<h1>{entry['title']}</h1>", reading.text)
                    self.assertIn(entry["paragraphs"][0], reading.text)
                    self.assertIn("本机验收样例", reading.text)
                    self.assertIn('href="/articles" aria-current="page"', reading.text)
                    self.assertNotIn("/static/articles/carousel.js", reading.text)

    def test_public_content_refresh_and_html_escaping(self):
        with TemporaryDirectory() as folder, TestClient(app) as client:
            catalog = Path(folder) / "catalog.json"
            payload = {
                "slug": "first-article",
                "title": '<b>样例</b>',
                "summary": "摘要",
                "cover": "/static/projects/home.webp",
                "cover_alt": '包含"引号',
                "paragraphs": ["<img src=x>", "第二段"],
            }
            with patch("app.main.ARTICLES_FILE", catalog):
                catalog.write_text(json.dumps([payload]), encoding="utf-8")
                directory = client.get("/articles")
                self.assertIn("&lt;b&gt;样例&lt;/b&gt;", directory.text)
                self.assertIn('alt="包含&quot;引号"', directory.text)
                self.assertNotIn("上一篇", directory.text)
                self.assertNotIn("本机验收样例", directory.text)
                reading = client.get("/articles/first-article")
                self.assertIn("<p>&lt;img src=x&gt;</p>", reading.text)
                self.assertNotIn("<b>样例</b>", reading.text)
                catalog.write_text("[]", encoding="utf-8")
                self.assertIn("还没有发布文章", client.get("/articles").text)
                self.assertEqual(client.get("/articles/first-article").status_code, 404)

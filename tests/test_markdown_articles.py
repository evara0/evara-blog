from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import unittest

from fastapi.testclient import TestClient

from app.markdown_articles import image_path, read_article, render_article
from app.main import app


class ArticleTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.patcher = patch("app.main.MARKDOWN_ARTICLES_DIR", self.root)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def write(self, slug, metadata=None, body="正文"):
        folder = self.root / slug
        folder.mkdir(exist_ok=True)
        (folder / "index.md").write_text("---\n" + (metadata or 'title: 文章\ndate: 2020-01-02\nsummary: 摘要\ntags: [Python, 测试]\n') + "---\n" + body, encoding="utf-8")
        return folder

    def test_empty_refresh_order_and_home_limit(self):
        self.assertIn("暂无 Markdown 技术文章", self.client.get("/").text)
        self.assertIn("暂无 Markdown 技术文章", self.client.get("/blog").text)
        for n in range(10):
            self.write(f"post-{n}", f"title: 第{n}篇\ndate: 2020-01-{n+1:02}\nsummary: 摘要\ntags: []\n")
        home = self.client.get("/").text
        listing = self.client.get("/blog").text
        self.assertEqual(home.count('class="article-row"'), 8)
        for n in range(2, 10):
            self.assertIn(f'href="/blog/post-{n}"', home)
        self.assertNotIn('href="/blog/post-0"', home)
        self.assertNotIn('href="/blog/post-1"', home)
        self.assertLess(home.index("第9篇"), home.index("第2篇"))
        self.assertIn('href="#ai-coding-workflow"', listing)
        self.assertIn('href="/articles"', self.client.get("/blog/post-9").text)
        self.assertIn('href="/blog" aria-current="page"', self.client.get("/blog/post-9").text)
        self.assertLess(listing.index("第9篇"), listing.index("第0篇"))
        self.write("post-9", "title: 修改后\ndate: 2020-01-10\nsummary: 摘要\ntags: []\n")
        self.assertIn("修改后", self.client.get("/").text)

    def test_invalid_unpublished_and_missing(self):
        self.write("valid")
        self.write("draft", "title: 草稿\ndate: 2020-01-01\nsummary: 摘要\ntags: []\ndraft: true\n")
        future = (date.today() + timedelta(days=1)).isoformat()
        self.write("future", f"title: 未来\ndate: {future}\nsummary: 摘要\ntags: []\n")
        self.write("invalid", "title: 错误\ndate: bad\nsummary: 摘要\ntags: []\n")
        self.write("bad-draft", "title: 错误\ndate: 2020-01-01\nsummary: 摘要\ntags: []\ndraft: perhaps\n")
        for slug in ("draft", "future", "invalid", "bad-draft", "missing"):
            self.assertEqual(self.client.get(f"/blog/{slug}").status_code, 404)
            self.assertEqual(self.client.get(f"/blog/{slug}/assets/pic.png").status_code, 404)
        self.assertEqual(self.client.get("/blog/valid").status_code, 200)
        for path in ("/", "/blog"):
            for slug in ("draft", "future", "invalid", "bad-draft"):
                self.assertNotIn(f'href="/blog/{slug}"', self.client.get(path).text)

    def test_markdown_and_safe_images(self):
        folder = self.write("demo", body="# 重复\n\n## 重复\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```python\nprint(1)\n```\n\n![图](./pic.png)\n\n<script>alert(1)</script>")
        (folder / "pic.png").write_bytes(b"png data")
        (folder / "private.txt").write_text("secret", encoding="utf-8")
        response = self.client.get("/blog/demo")
        self.assertEqual(response.status_code, 200)
        for expected in ('id="重复"', 'id="重复-2"', 'href="#重复-2"', '<table>', '<code class="language-python">', '/blog/demo/assets/pic.png', '&lt;script&gt;'):
            self.assertIn(expected, response.text)
        self.assertNotIn('<script>alert', response.text)
        image = self.client.get("/blog/demo/assets/pic.png")
        self.assertEqual(image.content, b"png data")
        self.assertEqual(image.headers["content-type"], "image/png")
        for path in ("private.txt", "index.md", "../private.png", ".hidden.png", "missing.png"):
            self.assertIsNone(image_path(self.root, "demo", path))
        self.assertIsNone(read_article(self.root, "../demo"))
        article = read_article(self.root, "demo")
        self.assertIsNotNone(article)
        html, _ = render_article(article)
        self.assertNotIn('<script>', html)

    def test_metadata_is_escaped(self):
        self.write("escape", 'title: "<script>bad</script>"\ndate: 2020-01-01\nsummary: "<b>bad</b>"\ntags: ["<tag>"]\n')
        for path in ("/", "/blog", "/blog/escape"):
            response = self.client.get(path)
            self.assertNotIn("<script>bad", response.text)
            self.assertIn("&lt;script&gt;", response.text)

    def test_resource_traversal_and_symlink_escape(self):
        folder = self.write("demo", body="![bad](../secret.png)\n\n![good](./nested/pic.png)")
        (folder / "nested").mkdir()
        (folder / "nested" / "pic.png").write_bytes(b"image")
        (self.root / "secret.png").write_bytes(b"secret")
        self.assertEqual(self.client.get("/blog/demo/assets/nested/pic.png").content, b"image")
        self.assertEqual(self.client.get("/blog/demo/assets/%2e%2e/secret.png").status_code, 404)
        self.assertNotIn("secret.png", self.client.get("/blog/demo").text)
        try:
            (folder / "link.png").symlink_to(self.root / "secret.png")
        except OSError:
            return  # Windows may not grant permission to create symbolic links.
        self.assertEqual(self.client.get("/blog/demo/assets/link.png").status_code, 404)


if __name__ == "__main__":
    unittest.main()

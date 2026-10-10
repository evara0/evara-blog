from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.notes import current_note, monthly_notes, note_files


class PageElements(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links = []
        self.scripts = []
        self.ids = set()
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "a":
            self.links.append(attributes)
        if tag == "script":
            self.scripts.append(attributes.get("src"))
        if "id" in attributes:
            self.ids.add(attributes["id"])


class BlogPageTests(unittest.TestCase):
    def test_signature_updates_on_refresh_and_is_plain_text(self):
        with TemporaryDirectory() as directory:
            signature = Path(directory) / "signature.txt"
            with patch("app.main.SIGNATURE_FILE", signature), TestClient(app) as client:
                signature.write_text("第一行\n第二行", encoding="utf-8-sig")
                for path in ("/", "/now", "/me"):
                    response = client.get(path)
                    self.assertIn("第一行\n第二行", response.text)
                    self.assertEqual(response.headers["cache-control"], "no-store")
                    self.assertIn('class="site-signature"', response.text)
                signature.write_text('<script>alert("hello")</script> & 新签名', encoding="utf-8")
                for path in ("/", "/now", "/me"):
                    response = client.get(path)
                    self.assertNotIn("第一行", response.text)
                    self.assertIn("&lt;script&gt;", response.text)
                    self.assertIn("&amp; 新签名", response.text)
                    self.assertNotIn("<script>alert", response.text)

    def test_unavailable_signature_does_not_break_pages(self):
        with TemporaryDirectory() as directory:
            signature = Path(directory) / "signature.txt"
            with patch("app.main.SIGNATURE_FILE", signature), TestClient(app) as client:
                for content in (None, b" \n\t", b"\xff"):
                    if content is not None:
                        signature.write_bytes(content)
                    for path in ("/", "/now", "/me"):
                        response = client.get(path)
                        self.assertEqual(response.status_code, 200)
                        self.assertNotIn('<footer', response.text)
                signature.unlink()
                signature.mkdir()
                self.assertNotIn('<footer', client.get("/").text)

    def test_page_routes_navigation_and_script_isolation(self):
        with TestClient(app) as client:
            for path, title, required_id in (
                ("/", "<title>EVARA'S BLOG</title>", "now-heading"),
                ("/now", "<title>正在做 · EVARA'S BLOG</title>", "calendar"),
                ("/me", "<title>个人 · EVARA'S BLOG</title>", "personal-heading"),
            ):
                with self.subTest(path=path):
                    response = client.get(path)
                    self.assertEqual(response.status_code, 200)
                    self.assertIn("text/html", response.headers["content-type"])
                    self.assertIn(title, response.text)
                    document = PageElements(response.text)
                    self.assertIn(required_id, document.ids)
                    page_links = {link["href"] for link in document.links if not link["href"].startswith("#")}
                    self.assertEqual(page_links, {"/", "/now", "/me"})
                    current_links = [link for link in document.links if link.get("aria-current") == "page"]
                    self.assertEqual(len(current_links), 1)
                    self.assertEqual(current_links[0]["href"], path)
                    if path == "/":
                        self.assertEqual(document.scripts, [])
                        self.assertNotIn("calendar", document.ids)
                        self.assertNotIn("current-content", document.ids)
                    elif path == "/now":
                        self.assertEqual(document.scripts, ["/static/app.js"])
                        self.assertTrue({"current-content", "entries", "jump-current"}.issubset(document.ids))
                    else:
                        self.assertEqual(document.scripts, ["/static/me-scene.js", "/static/me.js"])
                        self.assertNotIn('/static/style.css', response.text)
                        self.assertNotIn("calendar", document.ids)
            for resource in ("/static/style.css", "/static/app.js", "/static/me.css", "/static/me.js", "/static/me-scene.js"):
                self.assertEqual(client.get(resource).status_code, 200)

    def test_home_does_not_read_notes(self):
        with patch("app.main.current_note", side_effect=OSError("notes unavailable")), TestClient(app) as client:
            home = client.get("/")
            self.assertEqual(home.status_code, 200)
            self.assertIn("正在做", home.text)
            self.assertIn('href="/now"', home.text)

    def test_personal_page_does_not_read_notes(self):
        with patch("app.main.current_note", side_effect=OSError("notes unavailable")), TestClient(app) as client:
            response = client.get("/me")
            self.assertEqual(response.status_code, 200)
            self.assertIn("EVARA", response.text)
            self.assertIn("保持好奇", response.text)


class NoteReadingTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.notes = Path(self.temp.name)

    def write(self, name: str, content: str):
        (self.notes / name).write_text(content, encoding="utf-8")

    def test_missing_and_empty_directory(self):
        self.assertIsNone(current_note(self.notes, date(2026, 9, 23)))
        self.assertEqual(monthly_notes(self.notes, 2026, 9), [])
        self.assertEqual(note_files(self.notes / "missing"), [])

    def test_latest_note_persists_across_blank_days_and_ignores_future(self):
        self.write("2026-09-20.txt", "第一件事\n下一行")
        self.write("2026-09-24.txt", "将来")
        self.assertEqual(
            current_note(self.notes, date(2026, 9, 23)),
            {"date": "2026-09-20", "content": "第一件事\n下一行"},
        )
        self.assertEqual(current_note(self.notes, date(2026, 9, 19)), None)
        self.assertEqual(current_note(self.notes, date(2026, 9, 24))["date"], "2026-09-24")

    def test_month_is_sorted_and_bad_names_are_ignored(self):
        self.write("2026-09-01.txt", "一")
        self.write("2026-09-23.txt", "二")
        self.write("2026-10-01.txt", "三")
        self.write("2026-02-30.txt", "无效日期")
        self.write("today.txt", "无效名字")
        self.write("2026-9-3.txt", "无效格式")
        self.assertEqual(
            [note["date"] for note in monthly_notes(self.notes, 2026, 9)],
            ["2026-09-23", "2026-09-01"],
        )

    def test_api_and_static_home(self):
        self.write("2026-09-20.txt", "<script>只是文字</script>")
        with patch("app.main.NOTES_DIR", self.notes), patch("app.main.date") as fake_date:
            fake_date.today.return_value = date(2026, 9, 23)
            with TestClient(app) as client:
                home = client.get("/")
                self.assertEqual(home.status_code, 200)
                self.assertIn("正在做", home.text)
                self.assertEqual(client.get("/static/app.js").status_code, 200)
                self.assertEqual(
                    client.get("/api/current").json(),
                    {"today": "2026-09-23", "note": {"date": "2026-09-20", "content": "<script>只是文字</script>"}},
                )
                self.assertEqual(
                    client.get("/api/notes?month=2026-09").json()["notes"][0]["date"],
                    "2026-09-20",
                )
                self.assertEqual(client.get("/api/notes?month=2026-13").status_code, 422)


if __name__ == "__main__":
    unittest.main()

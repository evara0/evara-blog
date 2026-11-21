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
        paths = ["/", "/now", "/projects", "/blog", "/records", "/me"]
        page_scripts = {
            "/now": ["/static/app.js"],
            "/me": ["/static/vendor/leaflet/leaflet.js", "/static/footprints/footprints.js"],
        }
        with TestClient(app) as client:
            for path, title, active in [
                ("/", "EVARA'S BLOG", "/"), ("/now", "正在做", "/now"),
                ("/projects", "个人项目", "/projects"), ("/blog", "技术博客", "/blog"),
                ("/records", "记录", "/records"), ("/me", "个人", "/me"),
                ("/records/notes", "随手记", "/records"), ("/records/media", "书影音", "/records"),
            ]:
                with self.subTest(path=path):
                    response = client.get(path)
                    self.assertEqual(response.status_code, 200)
                    self.assertIn(title, response.text)
                    document = PageElements(response.text)
                    nav = [link for link in document.links if link.get("href") in paths]
                    # The brand and content links are outside the primary navigation.
                    nav_html = response.text.split('<nav class="site-nav"', 1)[1].split('</nav>', 1)[0]
                    nav = PageElements(nav_html).links
                    self.assertEqual([link["href"] for link in nav], paths)
                    self.assertEqual([link["href"] for link in nav if link.get("aria-current") == "page"], [active])
                    self.assertEqual(document.scripts, page_scripts.get(path, []))
                    self.assertNotIn("宇宙探索", response.text)
            records = client.get("/records").text
            self.assertIn('href="/records/notes"', records)
            self.assertIn('href="/records/media"', records)
            for path in ("/projects", "/blog", "/records/notes", "/records/media", "/me"):
                self.assertIn("还", client.get(path).text)
            self.assertIn("个人足迹", client.get("/me").text)
            old = client.get("/static/me.html", follow_redirects=False)
            self.assertEqual(old.status_code, 307)
            self.assertEqual(old.headers["location"], "/me")
            self.assertIn("个人足迹", client.get("/static/me.html").text)
            for resource in ("/static/style.css", "/static/app.js", "/static/me.css", "/static/me.js", "/static/me-scene.js"):
                self.assertEqual(client.get(resource).status_code, 200)
            for resource in (*page_scripts["/me"], "/static/vendor/leaflet/leaflet.css", "/static/footprints/footprints.css"):
                self.assertEqual(client.get(resource).status_code, 200)
            map_config = client.get("/static/footprints/map.json").json()
            self.assertEqual(map_config["image"]["src"], "/static/footprints/atlas.svg")
            atlas = client.get(map_config["image"]["src"])
            self.assertEqual(atlas.status_code, 200)
            self.assertIn("image/svg+xml", atlas.headers["content-type"])
            province_ids = {province["id"] for province in map_config["provinces"]}
            self.assertIn("sc", province_ids)
            self.assertTrue(all(city["province"] in province_ids for city in map_config["cities"]))

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

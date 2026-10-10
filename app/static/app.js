const currentDate = document.querySelector("#current-date");
const currentContent = document.querySelector("#current-content");
const jumpCurrent = document.querySelector("#jump-current");
const monthLabel = document.querySelector("#month-label");
const calendar = document.querySelector("#calendar");
const entries = document.querySelector("#entries");
const entryCount = document.querySelector("#entry-count");
const pagination = document.querySelector("#note-pagination");
const previousNote = document.querySelector("#previous-note");
const nextNote = document.querySelector("#next-note");
const notePage = document.querySelector("#note-page");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let today = "";
let visibleYear = 0;
let visibleMonth = 0;
let latestNote = null;
let monthRequest = 0;
let monthNotes = [];
let pageIndex = 0;
let turning = false;
let turnVersion = 0;
let pageAnimation = null;

function updatePagination() {
  pagination.hidden = monthNotes.length === 0;
  previousNote.disabled = turning || pageIndex === 0;
  nextNote.disabled = turning || pageIndex >= monthNotes.length - 1;
  notePage.textContent = monthNotes.length ? `${pageIndex + 1} / ${monthNotes.length}` : "";
  calendar.querySelectorAll("button[data-date]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.date === monthNotes[pageIndex]?.date));
  });
}

function cancelTurn() {
  turnVersion += 1;
  pageAnimation?.cancel();
  pageAnimation = null;
  turning = false;
  entries.style.minHeight = "";
  entries.setAttribute("aria-busy", "false");
}

function renderPage() {
  const note = monthNotes[pageIndex];
  const card = document.createElement("article");
  card.className = "entry";
  card.id = `entry-${note.date}`;
  const date = document.createElement("time");
  date.dateTime = note.date;
  date.textContent = note.date;
  const content = document.createElement("p");
  content.className = "note-text";
  content.textContent = note.content || "（这张便签是空的）";
  card.append(date, content);
  entries.replaceChildren(card);
  updatePagination();
}

async function showPage(index, scroll = false) {
  if (turning || index < 0 || index >= monthNotes.length) return;
  if (index !== pageIndex) {
    const direction = index > pageIndex ? 1 : -1;
    const version = ++turnVersion;
    if (!reducedMotion.matches && entries.firstElementChild.animate) {
      turning = true;
      entries.setAttribute("aria-busy", "true");
      entries.style.minHeight = `${entries.getBoundingClientRect().height}px`;
      updatePagination();
      const origin = direction > 0 ? "left center" : "right center";
      let completed = false;
      try {
        pageAnimation = entries.firstElementChild.animate([
          { transform: "rotateY(0deg)", opacity: 1, transformOrigin: origin },
          { transform: `rotateY(${-direction * 80}deg)`, opacity: 0.2, transformOrigin: origin },
        ], { duration: 170, easing: "ease-in", fill: "forwards" });
        await pageAnimation.finished;
        if (version !== turnVersion) return;
        pageAnimation.cancel();
        pageIndex = index;
        renderPage();
        pageAnimation = entries.firstElementChild.animate([
          { transform: `rotateY(${direction * 80}deg)`, opacity: 0.2, transformOrigin: origin },
          { transform: "rotateY(0deg)", opacity: 1, transformOrigin: origin },
        ], { duration: 220, easing: "ease-out", fill: "forwards" });
        await pageAnimation.finished;
        completed = version === turnVersion;
      } catch {
        // A month change cancels the old paper before loading the new one.
      } finally {
        if (version === turnVersion) {
          cancelTurn();
          updatePagination();
        }
      }
      if (!completed) return;
    } else {
      pageIndex = index;
      renderPage();
    }
  }
  if (scroll) entries.firstElementChild?.scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "center" });
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function emptyMessage(text) {
  const paragraph = document.createElement("p");
  paragraph.className = "empty-message";
  paragraph.textContent = text;
  return paragraph;
}

function renderCurrent(note) {
  latestNote = note;
  if (!note) {
    currentDate.textContent = "";
    currentContent.textContent = "还没有便签。在 notes 文件夹中新建一份以日期命名的 txt 文件，就可以从这里开始。";
    jumpCurrent.hidden = true;
    return;
  }
  currentDate.dateTime = note.date;
  currentDate.textContent = note.date;
  currentContent.textContent = note.content || "（这张便签是空的）";
  jumpCurrent.hidden = false;
}

function renderCalendar(notes) {
  const noteDates = new Set(notes.map((note) => note.date));
  const firstWeekday = (new Date(visibleYear, visibleMonth - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(visibleYear, visibleMonth, 0).getDate();
  const cells = [];

  for (let offset = 0; offset < firstWeekday; offset += 1) {
    const blank = document.createElement("span");
    blank.className = "calendar-blank";
    blank.setAttribute("aria-hidden", "true");
    cells.push(blank);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateString = `${visibleYear}-${String(visibleMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasNote = noteDates.has(dateString);
    const cell = document.createElement(hasNote ? "button" : "span");
    cell.className = "calendar-day";
    cell.textContent = String(day);
    if (dateString === today) cell.classList.add("today");
    if (hasNote) {
      cell.type = "button";
      cell.setAttribute("aria-label", `${dateString}，有便签`);
      cell.dataset.date = dateString;
      cell.addEventListener("click", () => {
        showPage(monthNotes.findIndex((note) => note.date === dateString), true);
      });
    }
    cells.push(cell);
  }
  calendar.replaceChildren(...cells);
}

function renderEntries(notes) {
  monthNotes = notes;
  pageIndex = 0;
  entryCount.textContent = String(notes.length).padStart(2, "0");
  updatePagination();
  if (notes.length === 0) {
    entries.replaceChildren(emptyMessage("这个月还没有便签。"));
    return;
  }
  renderPage();
}

async function showMonth(year, month) {
  cancelTurn();
  monthNotes = [];
  pageIndex = 0;
  updatePagination();
  visibleYear = year;
  visibleMonth = month;
  monthLabel.textContent = `${year} / ${String(month).padStart(2, "0")}`;
  entries.replaceChildren(emptyMessage("正在读取…"));
  entryCount.textContent = "—";
  calendar.replaceChildren();
  const request = ++monthRequest;
  try {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const data = await getJson(`/api/notes?month=${key}`);
    if (request !== monthRequest) return false;
    renderCalendar(data.notes);
    renderEntries(data.notes);
    return true;
  } catch {
    if (request !== monthRequest) return false;
    entries.replaceChildren(emptyMessage("读取便签失败，请刷新页面重试。"));
    return false;
  }
}

function moveMonth(offset) {
  let year = visibleYear;
  let month = visibleMonth + offset;
  if (month < 1) { year -= 1; month = 12; }
  if (month > 12) { year += 1; month = 1; }
  if (year >= 1 && year <= 9999) showMonth(year, month);
}

document.querySelector("#previous-month").addEventListener("click", () => moveMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => moveMonth(1));
previousNote.addEventListener("click", () => showPage(pageIndex - 1));
nextNote.addEventListener("click", () => showPage(pageIndex + 1));
jumpCurrent.addEventListener("click", async () => {
  if (!latestNote) return;
  const [year, month] = latestNote.date.split("-").map(Number);
  if (await showMonth(year, month)) {
    await showPage(monthNotes.findIndex((note) => note.date === latestNote.date), true);
  }
});

async function initialize() {
  const browserToday = new Date();
  today = `${browserToday.getFullYear()}-${String(browserToday.getMonth() + 1).padStart(2, "0")}-${String(browserToday.getDate()).padStart(2, "0")}`;
  try {
    const data = await getJson("/api/current");
    today = data.today;
    renderCurrent(data.note);
  } catch {
    currentContent.textContent = "读取最新便签失败，请刷新页面重试。";
  }
  const [year, month] = today.split("-").map(Number);
  await showMonth(year, month);
}

initialize();

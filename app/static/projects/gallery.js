const gallery = document.querySelector(".project-gallery");
const strip = document.querySelector(".project-strip");
const controls = document.querySelector(".project-controls");
const [previous, next] = controls.querySelectorAll("button");
const cards = strip.querySelectorAll(".project-card");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function updateControls() {
  previous.setAttribute("aria-disabled", strip.scrollLeft <= 1);
  next.setAttribute("aria-disabled", strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1);
}

function browse(direction) {
  const stride = cards[1].offsetLeft - cards[0].offsetLeft;
  strip.scrollBy({ left: direction * stride, behavior: reducedMotion.matches ? "instant" : "smooth" });
}

function scrollWithWheel(event) {
  if (event.ctrlKey || event.shiftKey || !event.cancelable) return;

  const mode = event.deltaMode;
  if (!event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

  const limit = strip.scrollWidth - strip.clientWidth;
  const position = strip.scrollLeft;
  if (limit <= 1 || (event.deltaY < 0 ? position <= 1 : position >= limit - 1)) return;

  const unit = mode === 1 ? 16 : mode === 2 ? strip.clientWidth : 1;
  event.preventDefault();
  strip.scrollLeft = Math.min(limit, Math.max(0, position + event.deltaY * unit));
}

previous.addEventListener("click", () => {
  if (previous.getAttribute("aria-disabled") === "false") browse(-1);
});
next.addEventListener("click", () => {
  if (next.getAttribute("aria-disabled") === "false") browse(1);
});
strip.addEventListener("scroll", updateControls, { passive: true });
strip.addEventListener("wheel", scrollWithWheel, { passive: false });
new ResizeObserver(updateControls).observe(strip);

for (const poster of strip.querySelectorAll(".project-poster")) {
  let hovered = false;
  const setExpanded = expanded => poster.setAttribute("aria-expanded", expanded);

  poster.addEventListener("pointerenter", event => {
    if (event.pointerType !== "mouse") return;
    hovered = true;
    setExpanded(true);
  });
  poster.addEventListener("pointerleave", () => {
    if (!hovered) return;
    hovered = false;
    if (!poster.matches(":focus-visible")) setExpanded(false);
  });
  poster.addEventListener("focus", () => {
    if (poster.matches(":focus-visible")) setExpanded(true);
  });
  poster.addEventListener("blur", () => {
    if (!hovered) setExpanded(false);
  });
  poster.addEventListener("click", () => {
    setExpanded(poster.getAttribute("aria-expanded") === "false");
  });
  poster.addEventListener("keydown", event => {
    if (event.key === "Escape") setExpanded(false);
  });
  poster.disabled = false;
}

gallery.setAttribute("data-interactive", "");
controls.hidden = false;
updateControls();

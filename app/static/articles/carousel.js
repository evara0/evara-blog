const carousel = document.querySelector(".articles-carousel");

if (carousel) {
  const track = carousel.querySelector(".articles-track");
  const cards = [...track.querySelectorAll(".article-card")];
  const index = [...carousel.querySelectorAll(".articles-index button")];
  const indexList = carousel.querySelector(".articles-index ol");
  const counter = carousel.querySelector(".articles-count");
  const status = carousel.querySelector(".articles-status");
  const wide = matchMedia("(min-width: 901px)");
  const previousOffsets = [];
  const total = cards.length;
  let selected = 0;

  function sizeTrack() {
    track.style.setProperty("--active-height", `${cards[selected].offsetHeight}px`);
  }

  const resize = new ResizeObserver(sizeTrack);

  function select(requested, announce = true) {
    const next = (requested + total) % total;
    const direction = Math.sign(requested - selected);
    const readingLinkFocused = cards[selected].contains(document.activeElement);
    if (next !== selected) resize.unobserve(cards[selected]);
    selected = next;

    cards.forEach((card, position) => {
      let offset = (position - selected + total) % total;
      if (offset > total / 2 || (offset === total / 2 && direction < 0)) {
        offset -= total;
      }

      const current = offset === 0;
      const angle = Math.max(-2, Math.min(2, offset)) * 20;
      const previousOffset = previousOffsets[position];
      // A card crossing the unseen side of the orbit re-enters from the other edge.
      const wraps = previousOffset * offset < 0 && Math.abs(previousOffset - offset) > 1;
      card.classList.toggle("is-jumping", wraps);
      card.style.setProperty("--wheel-angle", `${angle}deg`);
      card.classList.toggle("is-near", Math.abs(offset) === 1);
      card.classList.toggle("is-selected", current);
      card.inert = !current;
      index[position].setAttribute("aria-pressed", String(current));
      previousOffsets[position] = offset;
    });

    resize.observe(cards[selected]);
    sizeTrack();
    counter.textContent = `${String(selected + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    if (readingLinkFocused) cards[selected].querySelector(".article-read").focus({ preventScroll: true });
    if (!announce) return;

    if (!wide.matches || total > 8) {
      const selectedButton = index[selected].getBoundingClientRect();
      const list = indexList.getBoundingClientRect();
      if (selectedButton.bottom > list.bottom) {
        indexList.scrollTop += selectedButton.bottom - list.bottom;
      } else if (selectedButton.top < list.top) {
        indexList.scrollTop -= list.top - selectedButton.top;
      }
    }
    status.textContent = `第 ${selected + 1} 篇，共 ${total} 篇 · ${cards[selected].querySelector("h2").textContent}`;
  }

  index.forEach((button, position) => {
    button.addEventListener("click", () => select(position));
  });

  for (const button of carousel.querySelectorAll("[data-step]")) {
    button.addEventListener("click", () => select(selected + Number(button.dataset.step)));
  }

  if (total > 1) {
    carousel.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (step !== -1 && step !== 1) return;

      event.preventDefault();
      const fromIndex = index.includes(event.target);
      select(selected + step);
      if (fromIndex) index[selected].focus();
    });

    let wheelDistance = 0;
    let lastWheelTime = -Infinity;
    let lastWheelTurn = -Infinity;
    track.addEventListener("wheel", (event) => {
      if (!wide.matches || event.ctrlKey || !event.cancelable) return;

      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;

      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelTime > 160 || Math.sign(wheelDistance) !== Math.sign(delta)) {
        wheelDistance = 0;
      }
      lastWheelTime = now;
      if (now - lastWheelTurn < 380) return;

      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientHeight : 1;
      wheelDistance += delta * unit;
      if (Math.abs(wheelDistance) < 44) return;

      select(selected + Math.sign(wheelDistance));
      lastWheelTurn = now;
      wheelDistance = 0;
    }, { passive: false });

    let touch;
    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" || !event.isPrimary || event.target.closest("a")) return;

      touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener("pointerup", (event) => {
      if (touch?.id !== event.pointerId) return;

      const horizontal = event.clientX - touch.x;
      const vertical = event.clientY - touch.y;
      touch = undefined;
      if (Math.abs(horizontal) >= 38 && Math.abs(horizontal) > 1.4 * Math.abs(vertical)) {
        select(selected + (horizontal < 0 ? 1 : -1));
      }
    });
    track.addEventListener("lostpointercapture", () => { touch = undefined; });
  }

  carousel.hidden = false;
  select(0, false);
  document.querySelector(".articles-fallback").hidden = true;
}

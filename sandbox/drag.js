export function enablePlayerDragging(root, onDrop) {
  let pending = null;
  let preview = null;
  let suppressClickUntil = 0;

  function finish() {
    preview?.remove();
    preview = null;
    root.querySelector(".pitch")?.classList.remove("dragging");
    root.querySelector(".drag-source")?.classList.remove("drag-source");
    root.querySelector(".drag-over")?.classList.remove("drag-over");
    pending = null;
  }

  root.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest("[data-remove], [data-edit], [data-delete]")) return;
    const source = event.target.closest("[data-player]");
    if (!source) return;
    if (event.pointerType !== "mouse" && source.matches(".player-row") && !event.target.closest("[data-drag-handle]")) return;
    pending = { id: source.dataset.player, source, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });

  root.addEventListener("pointermove", event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (!preview && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 6) return;
    event.preventDefault();
    if (!preview) {
      if (event.isTrusted) pending.source.setPointerCapture(event.pointerId);
      preview = pending.source.cloneNode(true);
      preview.removeAttribute("id");
      preview.classList.add("drag-preview");
      preview.style.width = `${pending.source.getBoundingClientRect().width}px`;
      root.ownerDocument.body.append(preview);
      pending.source.classList.add("drag-source");
      root.querySelector(".pitch")?.classList.add("dragging");
    }
    preview.style.left = `${event.clientX}px`;
    preview.style.top = `${event.clientY}px`;
    root.querySelector(".drag-over")?.classList.remove("drag-over");
    const slot = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest("[data-slot]");
    if (slot && root.contains(slot)) slot.classList.add("drag-over");
  }, { passive: false });

  root.addEventListener("pointerup", event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    const id = pending.id;
    const dragging = Boolean(preview);
    const slot = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest("[data-slot]");
    finish();
    if (!dragging) return;
    event.preventDefault();
    suppressClickUntil = Date.now() + 300;
    if (slot && root.contains(slot)) onDrop(id, slot.dataset.slot);
  });

  root.addEventListener("pointercancel", finish);
  root.addEventListener("lostpointercapture", () => { if (pending) finish(); });
  root.addEventListener("click", event => {
    if (Date.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  root.addEventListener("dragstart", event => {
    if (event.target.closest("[data-player]")) event.preventDefault();
  });
}

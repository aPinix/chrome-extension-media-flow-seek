/** Consume the complete outside gesture so dismissing cannot activate the player. */
export function dismissPopoverOutside(
  doc: Document,
  isOpen: () => boolean,
  contains: (path: EventTarget[]) => boolean,
  close: () => void
): () => void {
  let dismissing = false;
  const handle = (event: Event) => {
    if (event.type === 'pointerdown') dismissing = false;
    if (isOpen() && !contains(event.composedPath())) {
      dismissing = true;
      close();
    }
    if (!dismissing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'click') dismissing = false;
  };
  const types = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  for (const type of types) doc.addEventListener(type, handle, true);
  return () => {
    for (const type of types) doc.removeEventListener(type, handle, true);
  };
}

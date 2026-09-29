export const PAGE_DIALOG_SELECTOR =
  'dialog[open], [role="dialog" i], [role="alertdialog" i], [aria-modal="true" i], [popover]';

export function visiblePageDialogs(doc: Document): HTMLElement[] {
  const win = doc.defaultView ?? window;
  return Array.from(doc.querySelectorAll<HTMLElement>(PAGE_DIALOG_SELECTOR)).filter((dialog) => {
    if (dialog.closest('.scrub-wrapper, .mfs-player-tools, [hidden], [aria-hidden="true"], [inert]')) return false;
    if (dialog.hasAttribute('popover')) {
      try {
        if (!dialog.matches(':popover-open')) return false;
      } catch {
        if (!dialog.hasAttribute('open')) return false;
      }
    }
    const rect = dialog.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= win.innerWidth || rect.top >= win.innerHeight) return false;
    for (let element: HTMLElement | null = dialog; element; element = element.parentElement) {
      const style = win.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    }
    return win.getComputedStyle(dialog).pointerEvents !== 'none';
  });
}

export function isVideoBlockedByDialog(video: HTMLVideoElement): boolean {
  // A dialog containing the player is a viewing surface, not an obstruction.
  return visiblePageDialogs(video.ownerDocument).some((dialog) => !dialog.contains(video));
}

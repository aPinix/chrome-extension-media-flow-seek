export type PipRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
export type PipDisplay = { bounds: PipRect; workArea: PipRect };
export const PIP_SCREEN_GAP = 10;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

export function pipDisplayForRect(
  rect: PipRect,
  displays: PipDisplay[]
): PipDisplay {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  let best = displays[0];
  let distance = Infinity;
  for (const display of displays) {
    const bounds = display.bounds;
    const dx = x - clamp(x, bounds.left, bounds.left + bounds.width);
    const dy = y - clamp(y, bounds.top, bounds.top + bounds.height);
    const next = dx * dx + dy * dy;
    if (next < distance) {
      best = display;
      distance = next;
    }
  }
  if (!best) throw new Error('No display is available for Picture-in-Picture.');
  return best;
}

export function fitPipRect(
  rect: PipRect,
  workArea: PipRect,
  aspect: number,
  frameWidth = 0,
  frameHeight = 0
): PipRect {
  const availableWidth = Math.max(
    1,
    workArea.width - 2 * PIP_SCREEN_GAP - frameWidth
  );
  const availableHeight = Math.max(
    1,
    workArea.height - 2 * PIP_SCREEN_GAP - frameHeight
  );
  const maxWidth = Math.min(availableWidth, availableHeight * aspect);
  const videoWidth = clamp(
    rect.width - frameWidth,
    Math.min(240, maxWidth),
    maxWidth
  );
  const width = Math.round(videoWidth + frameWidth);
  const height = Math.round(videoWidth / aspect + frameHeight);
  return {
    left: Math.round(
      clamp(
        rect.left,
        workArea.left + PIP_SCREEN_GAP,
        workArea.left + workArea.width - width - PIP_SCREEN_GAP
      )
    ),
    top: Math.round(
      clamp(
        rect.top,
        workArea.top + PIP_SCREEN_GAP,
        workArea.top + workArea.height - height - PIP_SCREEN_GAP
      )
    ),
    width,
    height,
  };
}

// Keep a dragged window mostly visible, while allowing the temporary edge
// overshoot shown in native PiP. Release always returns to the 10px work area.
export function limitPipDrag(rect: PipRect, bounds: PipRect): PipRect {
  return {
    ...rect,
    left: Math.round(
      clamp(
        rect.left,
        bounds.left - rect.width / 4,
        bounds.left + bounds.width - (rect.width * 3) / 4
      )
    ),
    top: Math.round(
      clamp(
        rect.top,
        bounds.top,
        bounds.top + bounds.height - (rect.height * 3) / 4
      )
    ),
  };
}

export function pipFlickCorner(
  rect: PipRect,
  workArea: PipRect,
  vx: number,
  vy: number
): PipRect {
  const horizontal =
    Math.abs(vx) > Math.abs(vy) * 0.25
      ? vx > 0
      : rect.left + rect.width / 2 >= workArea.left + workArea.width / 2;
  const vertical =
    Math.abs(vy) > Math.abs(vx) * 0.25
      ? vy > 0
      : rect.top + rect.height / 2 >= workArea.top + workArea.height / 2;
  return {
    ...rect,
    left: horizontal
      ? workArea.left + workArea.width - rect.width - PIP_SCREEN_GAP
      : workArea.left + PIP_SCREEN_GAP,
    top: vertical
      ? workArea.top + workArea.height - rect.height - PIP_SCREEN_GAP
      : workArea.top + PIP_SCREEN_GAP,
  };
}

export function pipEaseOutProgress(elapsedMs: number): number {
  const progress = clamp(elapsedMs / 320, 0, 1);
  return 1 - (1 - progress) ** 3;
}

export function interpolatePipRect(
  from: PipRect,
  to: PipRect,
  progress: number
): PipRect {
  return {
    left: Math.round(from.left + (to.left - from.left) * progress),
    top: Math.round(from.top + (to.top - from.top) * progress),
    width: Math.round(from.width + (to.width - from.width) * progress),
    height: Math.round(from.height + (to.height - from.height) * progress),
  };
}

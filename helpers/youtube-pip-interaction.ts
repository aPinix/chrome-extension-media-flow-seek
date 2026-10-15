import type { PipRect } from './pip-window-geometry';
import { animateYouTubePipRect } from './youtube-pip-animation';
import {
  type PipWindowRequest,
  YOUTUBE_PIP_POSITION_KEY,
  YOUTUBE_PIP_WINDOW_MESSAGE,
} from './youtube-pip-window';

type Patch = Omit<PipWindowRequest, 'type' | 'windowId'>;
type Sample = { x: number; y: number; time: number };

export function controlYouTubePipWindow(
  pip: Window,
  surface: HTMLElement,
  video: HTMLVideoElement,
  report: (message: string) => void
): () => void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage)
    return () => {};
  let disposed = false;
  let windowId: number | undefined;
  let queued: Patch | null = null;
  let running: Promise<void> | null = null;
  let resizeTimer = 0;
  let animation = 0;
  let settling = false;
  let lastSize = { width: pip.outerWidth, height: pip.outerHeight };
  let drag: {
    start: Sample;
    base: PipRect;
    desired: PipRect;
    direction: string;
    pointerId: number;
    samples: Sample[];
  } | null = null;
  const frame = () => ({
    frameWidth: Math.max(0, pip.outerWidth - pip.innerWidth),
    frameHeight: Math.max(0, pip.outerHeight - pip.innerHeight),
    aspect:
      video.videoWidth > 0 && video.videoHeight > 0
        ? video.videoWidth / video.videoHeight
        : 16 / 9,
  });
  const nativeRect = (): PipRect => ({
    left: pip.screenX,
    top: pip.screenY,
    width: pip.outerWidth,
    height: pip.outerHeight,
  });
  const send = async (patch: Patch) => {
    if (disposed) return;
    const result = await chrome.runtime.sendMessage({
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      windowId,
      ...frame(),
      ...patch,
    });
    if (result?.error) throw new Error(result.error);
    return result as
      | { windowId: number; rect: PipRect; from?: PipRect }
      | undefined;
  };
  const ready = send({ action: 'register' }).then((result) => {
    windowId = result?.windowId;
  });
  const failed = (error: unknown) => {
    if (!disposed)
      report(
        error instanceof Error
          ? error.message
          : 'Could not move Picture-in-Picture.'
      );
  };
  void ready.catch(failed);
  const savePosition = (rect?: PipRect) => {
    void chrome.storage.local
      .set({
        [YOUTUBE_PIP_POSITION_KEY]: {
          x: rect?.left ?? pip.screenX,
          y: rect?.top ?? pip.screenY,
        },
      })
      .catch(failed);
  };
  const flush = (): Promise<void> => {
    if (running) return running;
    running = (async () => {
      await ready;
      while (queued && !disposed) {
        const patch = queued;
        queued = null;
        await send(patch);
      }
    })().finally(() => {
      running = null;
    });
    return running;
  };
  const root = surface.getRootNode() as ShadowRoot;
  const style = pip.document.createElement('style');
  style.textContent = `
    .mfs-pip-resize { position:fixed; z-index:2147483647; padding:0; border:0; background:transparent!important; box-shadow:none!important; pointer-events:auto; touch-action:none; }
    .mfs-pip-resize:focus-visible { outline:2px solid #fff; outline-offset:-2px; }
    .mfs-pip-resize[data-edge=n],.mfs-pip-resize[data-edge=s] { left:14px; right:14px; height:7px; cursor:ns-resize; }
    .mfs-pip-resize[data-edge=n] { top:0; } .mfs-pip-resize[data-edge=s] { bottom:0; }
    .mfs-pip-resize[data-edge=e],.mfs-pip-resize[data-edge=w] { top:14px; bottom:14px; width:7px; cursor:ew-resize; }
    .mfs-pip-resize[data-edge=e] { right:0; } .mfs-pip-resize[data-edge=w] { left:0; }
    .mfs-pip-resize[data-edge=ne],.mfs-pip-resize[data-edge=nw],.mfs-pip-resize[data-edge=se],.mfs-pip-resize[data-edge=sw] { width:14px; height:14px; }
    .mfs-pip-resize[data-edge=ne],.mfs-pip-resize[data-edge=sw] { cursor:nesw-resize; }
    .mfs-pip-resize[data-edge=nw],.mfs-pip-resize[data-edge=se] { cursor:nwse-resize; }
    .mfs-pip-resize[data-edge=ne] { top:0; right:0; } .mfs-pip-resize[data-edge=nw] { top:0; left:0; }
    .mfs-pip-resize[data-edge=se] { bottom:0; right:0; } .mfs-pip-resize[data-edge=sw] { bottom:0; left:0; }
    [data-mfs-pip-dragging=true] { cursor:grabbing !important; }
  `;
  root.append(style);
  const edgeNames: Record<string, string> = {
    n: 'top edge',
    s: 'bottom edge',
    e: 'right edge',
    w: 'left edge',
    ne: 'top right corner',
    nw: 'top left corner',
    se: 'bottom right corner',
    sw: 'bottom left corner',
  };
  const handles = Object.entries(edgeNames).map(([edge, label]) => {
    const handle = pip.document.createElement('button');
    handle.type = 'button';
    handle.className = 'mfs-pip-resize';
    handle.dataset.edge = edge;
    handle.setAttribute(
      'aria-label',
      `Resize Picture-in-Picture from ${label}`
    );
    root.append(handle);
    return handle;
  });
  const sample = (event: PointerEvent): Sample => ({
    x: event.screenX,
    y: event.screenY,
    time: event.timeStamp,
  });
  const down = (event: PointerEvent) => {
    if (!event.isTrusted || event.button !== 0 || windowId === undefined)
      return;
    const path = event.composedPath();
    const handle = path.find((node) =>
      handles.includes(node as HTMLButtonElement)
    ) as HTMLButtonElement | undefined;
    if (
      !handle &&
      path.some(
        (node) =>
          (node as Element).nodeType === 1 &&
          (node as Element).matches('button,input,select,a')
      )
    )
      return;
    event.preventDefault();
    animation += 1;
    settling = false;
    const start = sample(event);
    drag = {
      start,
      base: nativeRect(),
      desired: nativeRect(),
      direction: handle?.dataset.edge ?? '',
      pointerId: event.pointerId,
      samples: [start],
    };
    surface.dataset.mfsPipDragging = 'true';
    surface.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const next = sample(event);
    drag.samples = [
      ...drag.samples.filter((point) => next.time - point.time <= 100),
      next,
    ];
    const dx = next.x - drag.start.x;
    const dy = next.y - drag.start.y;
    let desired = {
      ...drag.base,
      left: drag.base.left + dx,
      top: drag.base.top + dy,
    };
    if (drag.direction) {
      const { aspect, frameWidth, frameHeight } = frame();
      const horizontal = drag.direction.includes('e') ? dx : -dx;
      const vertical = (drag.direction.includes('s') ? dy : -dy) * aspect;
      const delta =
        drag.direction.length === 1
          ? /[ew]/.test(drag.direction)
            ? horizontal
            : vertical
          : Math.abs(horizontal) > Math.abs(vertical)
            ? horizontal
            : vertical;
      const width =
        Math.max(240, drag.base.width - frameWidth + delta) + frameWidth;
      const height = Math.round((width - frameWidth) / aspect + frameHeight);
      desired = {
        width: Math.round(width),
        height,
        left: drag.direction.includes('w')
          ? drag.base.left + drag.base.width - width
          : drag.base.left,
        top: drag.direction.includes('n')
          ? drag.base.top + drag.base.height - height
          : drag.base.top,
      };
    }
    drag.desired = desired;
    queued = {
      action: drag.direction ? 'resize' : 'move',
      x: desired.left,
      y: desired.top,
      width: desired.width,
      height: desired.height,
    };
    void flush().catch(failed);
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const completed = drag;
    drag = null;
    delete surface.dataset.mfsPipDragging;
    if (surface.hasPointerCapture(event.pointerId))
      surface.releasePointerCapture(event.pointerId);
    const first = completed.samples[0] as Sample;
    const last = completed.samples.at(-1) as Sample;
    const duration = Math.max(1, last.time - first.time);
    const vx = (last.x - first.x) / duration;
    const vy = (last.y - first.y) / duration;
    const flick =
      event.type === 'pointerup' &&
      !completed.direction &&
      event.timeStamp - last.time < 120 &&
      Math.hypot(vx, vy) > 0.75 &&
      Math.hypot(last.x - completed.start.x, last.y - completed.start.y) > 28;
    const generation = ++animation;
    settling = true;
    const cancelled = () => disposed || generation !== animation;
    const reducedMotion = pip.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const geometry = frame();
    void flush()
      .then(async () => {
        if (cancelled()) return;
        const result = await send({
          action: 'settle',
          x: completed.desired.left,
          y: completed.desired.top,
          vx,
          vy,
          flick,
          reducedMotion,
          prepareAnimation: !reducedMotion,
          ...geometry,
        });
        if (cancelled() || !result) return;
        if (result.from && !reducedMotion) {
          const completed = await animateYouTubePipRect(
            pip,
            result.from,
            result.rect,
            (rect) =>
              send({
                action: 'animate',
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
                ...geometry,
              }),
            { cancelled }
          );
          if (!completed) return;
          return send({ action: 'settle', reducedMotion: true, ...geometry });
        }
        return result;
      })
      .then((result) => {
        if (!cancelled() && result) savePosition(result.rect);
      })
      .finally(() => {
        if (generation === animation) settling = false;
      })
      .catch(failed);
  };
  const keydown = (event: KeyboardEvent) => {
    const target = event.composedPath()[0];
    if (target !== surface && !handles.includes(target as HTMLButtonElement))
      return;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    animation += 1;
    settling = false;
    const step = event.shiftKey ? 1 : 10;
    const rect = nativeRect();
    const handle = handles.includes(target as HTMLButtonElement);
    queued = handle
      ? {
          action: 'resize',
          width: rect.width + (delta[0] || delta[1]) * step,
          height: rect.height,
          x: rect.left,
          y: rect.top,
        }
      : {
          action: 'move',
          x: rect.left + delta[0] * step,
          y: rect.top + delta[1] * step,
        };
    void flush()
      .then(() => send({ action: 'settle', reducedMotion: true }))
      .then((result) => savePosition(result?.rect))
      .catch(failed);
  };
  const resized = () => {
    pip.clearTimeout(resizeTimer);
    resizeTimer = pip.setTimeout(() => {
      if (disposed || drag || queued || running || settling) return;
      const rect = nativeRect();
      const { aspect, frameWidth, frameHeight } = frame();
      const heightChanged =
        Math.abs(rect.height - lastSize.height) >
        Math.abs(rect.width - lastSize.width);
      lastSize = { width: rect.width, height: rect.height };
      const width = heightChanged
        ? Math.round((rect.height - frameHeight) * aspect + frameWidth)
        : rect.width;
      const height = Math.round((width - frameWidth) / aspect + frameHeight);
      void ready
        .then(async () => {
          if (
            Math.abs(rect.height - height) > 1 ||
            Math.abs(rect.width - width) > 1
          )
            await send({ action: 'resize', width, height });
          const result = await send({
            action: 'settle',
            reducedMotion: pip.matchMedia('(prefers-reduced-motion: reduce)')
              .matches,
          });
          if (!disposed) savePosition(result?.rect);
        })
        .catch(failed);
    }, 180);
  };
  pip.document.addEventListener('pointerdown', down, true);
  pip.document.addEventListener('pointermove', move, true);
  pip.document.addEventListener('pointerup', up, true);
  pip.document.addEventListener('pointercancel', up, true);
  root.addEventListener('keydown', keydown as EventListener);
  pip.addEventListener('resize', resized);
  video.addEventListener('resize', resized);
  return () => {
    savePosition();
    disposed = true;
    animation += 1;
    pip.clearTimeout(resizeTimer);
    pip.document.removeEventListener('pointerdown', down, true);
    pip.document.removeEventListener('pointermove', move, true);
    pip.document.removeEventListener('pointerup', up, true);
    pip.document.removeEventListener('pointercancel', up, true);
    root.removeEventListener('keydown', keydown as EventListener);
    pip.removeEventListener('resize', resized);
    video.removeEventListener('resize', resized);
    style.remove();
    for (const handle of handles) handle.remove();
    delete surface.dataset.mfsPipDragging;
  };
}

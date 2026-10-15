import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  handleYouTubePipWindowRequest,
  normalizeYouTubePipPosition,
  YOUTUBE_PIP_POSITION_KEY,
  YOUTUBE_PIP_WINDOW_MESSAGE,
} from './youtube-pip-window';

const update = vi.fn(async (id: number, rect: chrome.windows.UpdateInfo) => {
  const win = windows.find((candidate) => candidate.id === id);
  Object.assign(win ?? {}, rect);
  return win;
});
let windows: chrome.windows.Window[];
const sender = {
  frameId: 0,
  url: 'https://www.youtube.com/watch?v=test',
  tab: { id: 10, windowId: 1 },
} as chrome.runtime.MessageSender;
beforeEach(() => {
  update.mockReset();
  windows = [
    {
      id: 1,
      left: 100,
      top: 50,
      width: 1200,
      height: 800,
      alwaysOnTop: false,
      focused: true,
      incognito: false,
      tabs: [{ id: 10, url: sender.url }],
    },
    {
      id: 2,
      left: 100,
      top: 100,
      width: 360,
      height: 203,
      alwaysOnTop: true,
      focused: false,
      incognito: false,
      tabs: [{ id: 11, url: 'about:blank', openerTabId: 10 }],
    },
    {
      id: 3,
      alwaysOnTop: true,
      focused: false,
      incognito: false,
      tabs: [{ id: 12, url: 'about:blank', openerTabId: 20 }],
    },
  ] as chrome.windows.Window[];
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async () => ({ [YOUTUBE_PIP_POSITION_KEY]: { x: -1200, y: 300 } }),
      },
    },
    windows: {
      getAll: async () => windows,
      get: async (id: number) => windows.find((win) => win.id === id),
      update,
    },
    tabs: { getZoom: async () => 1 },
    system: {
      display: {
        getInfo: async () => [
          {
            isEnabled: true,
            bounds: { left: -1920, top: 0, width: 1920, height: 1080 },
            workArea: { left: -1920, top: 25, width: 1920, height: 995 },
          },
          {
            isEnabled: true,
            bounds: { left: 0, top: 0, width: 1920, height: 1080 },
            workArea: { left: 0, top: 25, width: 1920, height: 995 },
          },
        ],
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
it('restores saved multi-monitor coordinates only on the requesting tab’s PiP', async () => {
  expect(
    await handleYouTubePipWindowRequest(
      { type: YOUTUBE_PIP_WINDOW_MESSAGE, action: 'register' },
      sender
    )
  ).toEqual({
    windowId: 2,
    rect: { left: -1200, top: 300, width: 360, height: 203 },
  });
  expect(update).toHaveBeenCalledWith(2, {
    left: -1200,
    top: 300,
    width: 360,
    height: 203,
  });
});
it('moves and resizes an owned PiP window', async () => {
  await handleYouTubePipWindowRequest(
    {
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      action: 'move',
      windowId: 2,
      x: 640,
      y: 280,
    },
    sender
  );
  await handleYouTubePipWindowRequest(
    {
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      action: 'resize',
      windowId: 2,
      width: 480,
      height: 304,
    },
    sender
  );
  expect(update).toHaveBeenCalledWith(2, {
    left: 640,
    top: 280,
    width: 360,
    height: 203,
  });
  expect(update).toHaveBeenCalledWith(2, {
    left: 640,
    top: 280,
    width: 480,
    height: 270,
  });
});
it.each([1, 3, 999])(
  'rejects unrelated or missing windows: %s',
  async (windowId) => {
    await expect(
      handleYouTubePipWindowRequest(
        {
          type: YOUTUBE_PIP_WINDOW_MESSAGE,
          action: 'move',
          windowId,
          x: 100,
          y: 100,
        },
        sender
      )
    ).rejects.toThrow('unavailable');
    expect(update).not.toHaveBeenCalled();
  }
);
it.each([
  { ...sender, frameId: 1 },
  { ...sender, url: 'https://youtube.com.evil.example/watch' },
  { ...sender, url: 'https://example.com' },
])('rejects messages outside the top-level YouTube opener', async (source) => {
  await expect(
    handleYouTubePipWindowRequest(
      { type: YOUTUBE_PIP_WINDOW_MESSAGE, action: 'register' },
      source
    )
  ).rejects.toThrow('Invalid PiP opener');
});
it('recovers a saved position after its monitor is disconnected', async () => {
  chrome.system.display.getInfo = vi.fn(async () => [
    {
      isEnabled: true,
      bounds: { left: 0, top: 0, width: 1920, height: 1080 },
      workArea: { left: 0, top: 25, width: 1920, height: 995 },
    },
  ]) as unknown as typeof chrome.system.display.getInfo;
  expect(
    await handleYouTubePipWindowRequest(
      { type: YOUTUBE_PIP_WINDOW_MESSAGE, action: 'register' },
      sender
    )
  ).toEqual({
    windowId: 2,
    rect: { left: 10, top: 300, width: 360, height: 203 },
  });
});
it('allows temporary edge overshoot but lands 10px inside the usable screen on release', async () => {
  await handleYouTubePipWindowRequest(
    {
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      action: 'move',
      windowId: 2,
      x: 1900,
      y: 1100,
    },
    sender
  );
  expect(update).toHaveBeenLastCalledWith(2, {
    left: 1650,
    top: 928,
    width: 360,
    height: 203,
  });
  await handleYouTubePipWindowRequest(
    {
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      action: 'settle',
      windowId: 2,
      x: 1900,
      y: 1100,
      reducedMotion: true,
    },
    sender
  );
  expect(update).toHaveBeenLastCalledWith(2, {
    left: 1550,
    top: 807,
    width: 360,
    height: 203,
  });
});
it('sends a directional flick to a corner and includes browser frame height', async () => {
  await handleYouTubePipWindowRequest(
    {
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      action: 'settle',
      windowId: 2,
      vx: -2,
      vy: 1,
      flick: true,
      frameHeight: 34,
      reducedMotion: true,
    },
    sender
  );
  expect(update).toHaveBeenLastCalledWith(2, {
    left: 10,
    top: 773,
    width: 360,
    height: 237,
  });
});
it('rejects corrupt geometry and preserves negative screen coordinates', () => {
  expect(normalizeYouTubePipPosition({ x: Number.NaN, y: 0 })).toBeNull();
  expect(normalizeYouTubePipPosition({ x: -1200, y: 300.2 })).toEqual({
    x: -1200,
    y: 300,
  });
});
it('prepares a flick without blocking on worker timers, then accepts immediate animation frames', async () => {
  const prepared = await handleYouTubePipWindowRequest(
    {
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      action: 'settle',
      windowId: 2,
      vx: 2,
      vy: 1,
      flick: true,
      frameHeight: 34,
      prepareAnimation: true,
    },
    sender
  );
  expect(prepared.from).toEqual({
    left: 100,
    top: 100,
    width: 360,
    height: 203,
  });
  expect(prepared.rect).toEqual({
    left: 1550,
    top: 773,
    width: 360,
    height: 237,
  });
  expect(update).not.toHaveBeenCalled();
  await handleYouTubePipWindowRequest(
    {
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      action: 'animate',
      windowId: 2,
      x: 800,
      y: 600,
      width: 360,
      height: 237,
      frameHeight: 34,
    },
    sender
  );
  expect(update).toHaveBeenLastCalledWith(2, {
    left: 800,
    top: 600,
    width: 360,
    height: 237,
  });
});
it('uses the prepared display snapshot for frames and still rejects another opener', async () => {
  const get = vi.spyOn(chrome.windows, 'get');
  const display = vi.spyOn(chrome.system.display, 'getInfo');
  await handleYouTubePipWindowRequest(
    {
      type: YOUTUBE_PIP_WINDOW_MESSAGE,
      action: 'settle',
      windowId: 2,
      prepareAnimation: true,
    },
    sender
  );
  get.mockClear();
  display.mockClear();
  const frame = {
    type: YOUTUBE_PIP_WINDOW_MESSAGE,
    action: 'animate',
    windowId: 2,
    x: 800,
    y: 500,
    width: 360,
    height: 203,
  } as const;
  await handleYouTubePipWindowRequest(frame, sender);
  await handleYouTubePipWindowRequest({ ...frame, x: 900 }, sender);
  expect(get).not.toHaveBeenCalled();
  expect(display).not.toHaveBeenCalled();
  await expect(
    handleYouTubePipWindowRequest(frame, {
      ...sender,
      tab: { id: 20, windowId: 1 } as chrome.tabs.Tab,
    })
  ).rejects.toThrow('unavailable');
});
it.each([1, 2])(
  'returns to the source player at browser zoom %s, accounting for the PiP header',
  async (zoom) => {
    chrome.tabs.getZoom = vi.fn(async () => zoom) as typeof chrome.tabs.getZoom;
    const result = await handleYouTubePipWindowRequest(
      {
        type: YOUTUBE_PIP_WINDOW_MESSAGE,
        action: 'return',
        aspect: 16 / 9,
        frameHeight: 34,
        reducedMotion: true,
        destination: {
          left: 100 / zoom,
          top: 150 / zoom,
          width: 640 / zoom,
          height: 360 / zoom,
          viewportWidth: 1200 / zoom,
          viewportHeight: 700 / zoom,
        },
      },
      sender
    );
    expect(result.rect).toEqual({
      left: 200,
      top: 266,
      width: 640,
      height: 394,
    });
    expect(result.from).toEqual({
      left: 100,
      top: 100,
      width: 360,
      height: 203,
    });
    expect(update).not.toHaveBeenCalled();
    await handleYouTubePipWindowRequest(
      {
        type: YOUTUBE_PIP_WINDOW_MESSAGE,
        action: 'return',
        windowId: 2,
        x: result.rect.left,
        y: result.rect.top,
        width: result.rect.width,
        height: result.rect.height,
        frameHeight: 34,
      },
      sender
    );
    expect(update).toHaveBeenLastCalledWith(2, result.rect);
  }
);
it('rejects a corrupt return destination without moving an unrelated window', async () => {
  await expect(
    handleYouTubePipWindowRequest(
      {
        type: YOUTUBE_PIP_WINDOW_MESSAGE,
        action: 'return',
        destination: {
          left: Number.NaN,
          top: 100,
          width: 640,
          height: 360,
          viewportWidth: 1200,
          viewportHeight: 700,
        },
      },
      sender
    )
  ).rejects.toThrow('Invalid PiP return destination');
  expect(update).not.toHaveBeenCalled();
});

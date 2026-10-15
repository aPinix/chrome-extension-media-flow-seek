// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MINI_PLAYER_GEOMETRY_KEY } from './mini-player-settings';
import { FloatingPlayer } from './player-floating';
import {
  DEFAULT_PLAYER_TOOLS,
  type PlayerToolsSettings,
} from './player-tools-settings';
import { YOUTUBE_PIP_SIZE_KEY } from './youtube-pip';

let floating: FloatingPlayer;
let video: HTMLVideoElement;
let root: ShadowRoot;
let pip: Window;
let settings: PlayerToolsSettings;
let paused: boolean;
let requestWindow: ReturnType<typeof vi.fn>;
const save = vi.fn(async (_data: Record<string, unknown>) => {});
beforeEach(async () => {
  window.history.replaceState(null, '', '/watch?v=test');
  settings = {
    ...DEFAULT_PLAYER_TOOLS,
    miniPlayer: false,
    youtubePipOverride: true,
  };
  paused = false;
  save.mockReset();
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async () => ({
          [YOUTUBE_PIP_SIZE_KEY]: { width: 480, height: 270 },
        }),
        set: save,
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  document.body.innerHTML =
    '<div id="movie_player"><video style="filter:brightness(120%);width:640px"></video></div><div id="tools"></div><iframe></iframe>';
  video = document.querySelector('video') as HTMLVideoElement;
  root = (document.querySelector('#tools') as HTMLElement).attachShadow({
    mode: 'open',
  });
  pip = (document.querySelector('iframe') as HTMLIFrameElement)
    .contentWindow as Window;
  Object.defineProperties(pip, {
    innerWidth: { configurable: true, value: 480 },
    innerHeight: { configurable: true, value: 270 },
  });
  vi.spyOn(pip, 'close').mockImplementation(() =>
    pip.dispatchEvent(new Event('pagehide'))
  );
  Object.defineProperties(video, {
    paused: { configurable: true, get: () => paused },
    duration: { configurable: true, value: 120 },
  });
  video.currentTime = 30;
  vi.spyOn(video, 'play').mockImplementation(async () => {
    paused = false;
    video.dispatchEvent(new Event('play'));
  });
  vi.spyOn(video, 'pause').mockImplementation(() => {
    paused = true;
    video.dispatchEvent(new Event('pause'));
  });
  requestWindow = vi.fn(async () => pip);
  vi.stubGlobal('documentPictureInPicture', { requestWindow });
  floating = new FloatingPlayer(
    video,
    root,
    () => settings,
    true,
    vi.fn(),
    vi.fn(),
    () => ({ range: null, enabled: false })
  );
  await vi.waitFor(() => expect(video.dataset.mfsPipOverride).toBe('true'));
});
afterEach(() => {
  floating.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
const control = (label: string) => {
  const shadow = pip.document.body.firstElementChild?.shadowRoot;
  const node = shadow?.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!node) throw new Error(`Missing PiP control: ${label}`);
  return node;
};
it('uses Mini Player controls and saved size with scrolling Mini Player disabled', async () => {
  await floating.openPip();
  expect(requestWindow).toHaveBeenCalledWith({
    width: 480,
    height: 270,
    preferInitialWindowPlacement: false,
  });
  expect(video.ownerDocument).toBe(pip.document);
  expect(video.style.height).toBe('100vh');
  expect(video.style.filter).toBe('brightness(120%)');
  expect(floating.inMini).toBe(false);
  control('Seek backward 5 seconds').click();
  expect(video.currentTime).toBe(25);
  control('Pause').click();
  expect(paused).toBe(true);
  control('Play').click();
  expect(paused).toBe(false);
  control('Mute').click();
  expect(video.muted).toBe(true);
  expect(
    pip.document.body.firstElementChild?.shadowRoot?.querySelector(
      '.pip-controls'
    )
  ).toBeNull();
});
it('uses headerless Chrome video PiP and lets the source button restore playback', async () => {
  settings.youtubePipMode = 'chrome-video';
  let active = false;
  Object.defineProperties(document, {
    pictureInPictureEnabled: { configurable: true, value: true },
    pictureInPictureElement: {
      configurable: true,
      get: () => (active ? video : null),
    },
  });
  const nativeRequest = vi.fn(async () => {
    active = true;
    video.dispatchEvent(new Event('enterpictureinpicture'));
    return { width: 480, height: 270 };
  });
  Object.defineProperty(video, 'requestPictureInPicture', {
    configurable: true,
    value: nativeRequest,
  });
  const exit = vi.fn(async () => {
    active = false;
    video.dispatchEvent(new Event('leavepictureinpicture'));
  });
  Object.defineProperty(document, 'exitPictureInPicture', {
    configurable: true,
    value: exit,
  });
  floating.update();
  await floating.openPip();
  expect(nativeRequest).toHaveBeenCalledOnce();
  expect(requestWindow).not.toHaveBeenCalled();
  expect(floating.inPip).toBe(true);
  expect(video.parentElement?.id).toBe('movie_player');
  (
    document.querySelector('.mfs-pip-return-button') as HTMLButtonElement
  ).click();
  await vi.waitFor(() => expect(floating.inPip).toBe(false));
  expect(exit).toHaveBeenCalledOnce();
  expect(document.querySelector('.mfs-pip-return-area')).toBeNull();
  expect(paused).toBe(false);
});
it('saves resized PiP without changing in-page Mini Player geometry and restores nodes on close', async () => {
  const original = video.getAttribute('style');
  await floating.openPip();
  Object.defineProperties(pip, {
    innerWidth: { value: 600 },
    innerHeight: { value: 338 },
  });
  pip.dispatchEvent(new Event('resize'));
  expect(
    control('Mini player playback controls').style.getPropertyValue(
      '--mini-scale'
    )
  ).toBe('1');
  await vi.waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      [YOUTUBE_PIP_SIZE_KEY]: { width: 600, height: 338 },
    })
  );
  control('Close Picture-in-Picture').click();
  expect(floating.inPip).toBe(false);
  expect(video.parentElement?.id).toBe('movie_player');
  expect(video.getAttribute('style')).toBe(original);
  expect(root.querySelector('.mini-controls')).toBeTruthy();
  expect(
    save.mock.calls.some(([data]) => MINI_PLAYER_GEOMETRY_KEY in data)
  ).toBe(false);
  await floating.openPip();
  expect(requestWindow).toHaveBeenLastCalledWith({
    width: 600,
    height: 338,
    preferInitialWindowPlacement: false,
  });
});
it('keeps controls at the same size as a larger PiP repositions them', async () => {
  await floating.openPip();
  const controls = control('Mini player playback controls');
  expect(controls.style.getPropertyValue('--mini-scale')).toBe('1');
  Object.defineProperties(pip, {
    innerWidth: { value: 960 },
    innerHeight: { value: 540 },
  });
  pip.dispatchEvent(new Event('resize'));
  expect(controls.style.width).toBe('960px');
  expect(controls.style.height).toBe('540px');
  expect(controls.style.getPropertyValue('--mini-scale')).toBe('1');
});
it('animates the return without saving the destination as the next PiP size', async () => {
  const completeReturn: Array<() => void> = [];
  const sendMessage = vi.fn(async (message: { action: string }) => {
    if (message.action === 'return')
      await new Promise<void>((resolve) => completeReturn.push(resolve));
    return {
      windowId: 2,
      rect: { left: 100, top: 100, width: 480, height: 304 },
    };
  });
  Object.assign(chrome, { runtime: { sendMessage } });
  vi.spyOn(window, 'focus').mockImplementation(() => {});
  Object.defineProperty(pip, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  });
  const player = document.querySelector('#movie_player') as HTMLElement;
  vi.spyOn(player, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 100,
    right: 640,
    bottom: 460,
    width: 640,
    height: 360,
  } as DOMRect);
  await floating.openPip();
  const button = document.querySelector<HTMLButtonElement>(
    '.mfs-pip-return-button'
  ) as HTMLButtonElement;
  button.click();
  await vi.waitFor(() =>
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'return' })
    )
  );
  expect(pip.close).not.toHaveBeenCalled();
  expect(button.disabled).toBe(true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  Object.defineProperties(pip, {
    innerWidth: { value: 640 },
    innerHeight: { value: 360 },
  });
  pip.dispatchEvent(new Event('resize'));
  completeReturn[0]?.();
  await vi.waitFor(() => expect(pip.close).toHaveBeenCalledOnce());
  expect(video.parentElement?.id).toBe('movie_player');
  expect(paused).toBe(false);
  expect(
    save.mock.calls.some(
      ([data]) =>
        (data[YOUTUBE_PIP_SIZE_KEY] as { width?: number })?.width === 640
    )
  ).toBe(false);
  expect(save).toHaveBeenCalledWith({
    [YOUTUBE_PIP_SIZE_KEY]: { width: 480, height: 270 },
  });
});
it('closes and restores the source when the override is disabled live', async () => {
  await floating.openPip();
  settings.youtubePipOverride = false;
  floating.update();
  expect(pip.close).toHaveBeenCalledOnce();
  expect(floating.inPip).toBe(false);
  expect(video.ownerDocument).toBe(document);
  expect(video.dataset.mfsPipOverride).toBe('false');
});
it('uses the empty source player to bring PiP back and removes the return area', async () => {
  await floating.openPip();
  const button = document.querySelector<HTMLButtonElement>(
    '[aria-label="Bring video back to this page"]'
  );
  expect(button?.textContent).toBe('Bring video back');
  expect(
    document.querySelector('#movie_player .mfs-pip-return-area')
  ).not.toBeNull();
  button?.click();
  expect(pip.close).toHaveBeenCalledOnce();
  expect(floating.inPip).toBe(false);
  expect(video.parentElement?.id).toBe('movie_player');
  expect(document.querySelector('.mfs-pip-return-area')).toBeNull();
  expect(paused).toBe(false);
});
it('cancels pending overridden PiP when navigating away', async () => {
  let resolve: (pip: Window) => void = () => {};
  requestWindow.mockImplementationOnce(
    () =>
      new Promise<Window>((done) => {
        resolve = done;
      })
  );
  const pending = floating.openPip();
  floating.reset();
  resolve(pip);
  await pending;
  expect(pip.close).toHaveBeenCalledOnce();
  expect(video.ownerDocument).toBe(document);
  expect(root.querySelector('.mini-controls')).toBeTruthy();
});

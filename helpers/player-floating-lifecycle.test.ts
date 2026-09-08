// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingPlayer } from './player-floating';
import { DEFAULT_PLAYER_TOOLS } from './player-tools-settings';

let floating: FloatingPlayer;
let video: HTMLVideoElement;
let report: (text: string) => void;
beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => {} } },
  });
  document.body.innerHTML =
    '<div id="player"><video style="filter:brightness(120%);width:640px"></video></div><div id="tools"></div>';
  video = document.querySelector('video') as HTMLVideoElement;
  const root = (document.querySelector('#tools') as HTMLElement).attachShadow({
    mode: 'open',
  });
  report = vi.fn();
  floating = new FloatingPlayer(
    video,
    root,
    () => DEFAULT_PLAYER_TOOLS,
    false,
    report,
    () => {},
    () => ({ range: null, enabled: false })
  );
});
afterEach(() => {
  floating.cleanup();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
describe('floating player lifecycle', () => {
  it('sizes the YouTube video container while floating and restores its styles', () => {
    floating.cleanup();
    const player = video.parentElement as HTMLElement;
    player.id = 'movie_player';
    const container = document.createElement('div');
    container.className = 'html5-video-container';
    container.style.height = '0px';
    player.append(container);
    container.append(video);
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
      top: -400,
      bottom: -40,
      width: 640,
      height: 360,
    } as DOMRect);
    Object.defineProperty(video, 'paused', {
      configurable: true,
      value: false,
    });
    floating = new FloatingPlayer(
      video,
      (document.querySelector('#tools') as HTMLElement)
        .shadowRoot as ShadowRoot,
      () => ({ ...DEFAULT_PLAYER_TOOLS, miniPlayer: true }),
      true,
      report,
      () => {},
      () => ({ range: null, enabled: false })
    );
    floating.update();
    expect(container.style.height).toBe('100%');
    expect(video.style.height).toBe('100%');
    expect(player.style.position).toBe('fixed');
    floating.reset();
    expect(container.style.height).toBe('0px');
    expect(video.style.width).toBe('640px');
    expect(video.style.height).toBe('');
    expect(player.style.position).toBe('');
  });
  it('closes a pending Document PiP window when disabled before the request resolves', async () => {
    let resolve: (win: Window) => void = () => {};
    const close = vi.fn();
    vi.stubGlobal('documentPictureInPicture', {
      requestWindow: () =>
        new Promise<Window>((done) => {
          resolve = done;
        }),
    });
    const pending = floating.openPip();
    floating.cleanup();
    resolve({ close } as unknown as Window);
    await pending;
    expect(close).toHaveBeenCalledOnce();
    expect(video.parentElement?.id).toBe('player');
  });
  it('cancels an in-flight PiP request when the source changes', async () => {
    let resolve: (win: Window) => void = () => {};
    const close = vi.fn();
    vi.stubGlobal('documentPictureInPicture', {
      requestWindow: () =>
        new Promise<Window>((done) => {
          resolve = done;
        }),
    });
    const pending = floating.openPip();
    floating.reset();
    resolve({ close } as unknown as Window);
    await pending;
    expect(close).toHaveBeenCalledOnce();
    expect(video.hasAttribute('data-mfs-pip')).toBe(false);
  });
  it('restores the same video and its original styles after PiP closes', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const pip = frame.contentWindow as Window;
    vi.stubGlobal('documentPictureInPicture', {
      requestWindow: async () => pip,
    });
    const style = video.getAttribute('style');
    await floating.openPip();
    expect(video.ownerDocument).toBe(pip.document);
    expect(video.dataset.mfsPip).toBe('true');
    expect(video.style.filter).toBe('brightness(120%)');
    pip.dispatchEvent(new Event('pagehide'));
    expect(video.parentElement?.id).toBe('player');
    expect(video.ownerDocument).toBe(document);
    expect(video.getAttribute('style')).toBe(style);
    expect(video.dataset.mfsPip).toBeUndefined();
  });
});

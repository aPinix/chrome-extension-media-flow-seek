// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.youtube.com/watch?v=screenshot-test"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerTools } from './player-tools';
import { DEFAULT_FILTERS, DEFAULT_PLAYER_TOOLS } from './player-tools-settings';

const capture = vi.hoisted(() => vi.fn());
const boost = vi.hoisted(() => vi.fn());
vi.mock('./player-actions', async (original) => ({
  ...(await original<typeof import('./player-actions')>()),
  screenshotVideo: capture,
  boostVideo: boost,
}));

let tools: PlayerTools;
let video: HTMLVideoElement;
let screenshot: HTMLButtonElement;
const changed = { addListener: vi.fn(), removeListener: vi.fn() };
const getPreferences = vi.fn(async () => ({
  playerTools: DEFAULT_PLAYER_TOOLS,
}));
const filtersRoot = () => {
  const root = document.querySelector('.mfs-youtube-filters-popup')?.shadowRoot;
  if (!root) throw new Error('Filter popup missing');
  return root;
};
const filterInput = (name: string) => {
  const input = filtersRoot().querySelector<HTMLInputElement>(
    `input[aria-label="${name}"]`
  );
  if (!input) throw new Error(`Filter missing: ${name}`);
  return input;
};
const filtersButton = () =>
  document.querySelector('.mfs-filters-button') as HTMLButtonElement;
const filterAction = (name: string) => {
  const button = [...filtersRoot().querySelectorAll('button')].find(
    (node) => node.textContent === name
  );
  if (!button) throw new Error(`Action missing: ${name}`);
  return button;
};
const preferencesChanged = (patch: Partial<typeof DEFAULT_PLAYER_TOOLS>) => {
  const listener = changed.addListener.mock.calls.at(-1)?.[0];
  listener(
    { playerTools: { newValue: { ...DEFAULT_PLAYER_TOOLS, ...patch } } },
    'sync'
  );
};

beforeEach(async () => {
  vi.useFakeTimers();
  capture.mockReset().mockResolvedValue(undefined);
  boost.mockReset().mockResolvedValue(undefined);
  changed.addListener.mockClear();
  getPreferences
    .mockReset()
    .mockResolvedValue({ playerTools: DEFAULT_PLAYER_TOOLS });
  vi.stubGlobal('chrome', {
    storage: {
      sync: {
        get: getPreferences,
        set: vi.fn(async () => {}),
      },
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
      onChanged: changed,
    },
    runtime: {
      sendMessage: vi.fn(async () => ({ library: { version: 1, items: [] } })),
    },
  });
  document.body.innerHTML =
    '<div id="movie_player"><video class="html5-main-video"></video><div class="ytp-right-controls"><button class="ytp-subtitles-button"></button></div></div>';
  video = document.querySelector('video') as HTMLVideoElement;
  Object.defineProperties(video, {
    readyState: { value: 4, configurable: true },
    duration: { value: 120 },
    videoWidth: { value: 1920, configurable: true },
    videoHeight: { value: 1080 },
    paused: { value: false },
  });
  video.currentTime = 25;
  video.getBoundingClientRect = () =>
    ({
      top: 64,
      left: 0,
      right: 640,
      bottom: 424,
      width: 640,
      height: 360,
    }) as DOMRect;
  const player = video.closest('#movie_player') as HTMLElement;
  player.getBoundingClientRect = video.getBoundingClientRect;
  tools = new PlayerTools(video, document.createElement('div'));
  await vi.advanceTimersByTimeAsync(0);
  screenshot = document.querySelector(
    '.mfs-screenshot-button'
  ) as HTMLButtonElement;
});
afterEach(() => {
  tools.cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('YouTube Screenshot button', () => {
  it('includes the current filters only when the saved screenshot option is on', async () => {
    const brightness = filterInput('Brightness');
    brightness.value = '145';
    brightness.dispatchEvent(new Event('input'));
    screenshot.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(capture).toHaveBeenLastCalledWith(video);
    preferencesChanged({ youtubeScreenshotIncludeFilters: true });
    screenshot.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(capture).toHaveBeenLastCalledWith(video, {
      ...DEFAULT_FILTERS,
      brightness: 145,
    });
    expect(video.style.filter).toContain('brightness(145%)');
    preferencesChanged({ youtubeScreenshotIncludeFilters: false });
    screenshot.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(capture).toHaveBeenLastCalledWith(video);
    expect(video.style.filter).toContain('brightness(145%)');
  });
  it('captures the same playing video once and provides visible success feedback', async () => {
    let finish: () => void = () => {};
    capture.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    screenshot.click();
    screenshot.click();
    expect(capture).toHaveBeenCalledExactlyOnceWith(video);
    expect(screenshot.disabled).toBe(true);
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(25);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(screenshot.disabled).toBe(false);
    const status = document.querySelector<HTMLElement>(
      '.mfs-screenshot-status'
    );
    expect(status?.textContent).toBe('Screenshot saved.');
    expect(status?.hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(status?.hidden).toBe(true);
  });
  it('shows capture errors and allows retrying', async () => {
    capture.mockRejectedValueOnce(
      new Error('Screenshot blocked by this video source.')
    );
    screenshot.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('.mfs-screenshot-status')?.textContent).toBe(
      'Screenshot blocked by this video source.'
    );
    expect(screenshot.disabled).toBe(false);
    screenshot.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(capture).toHaveBeenCalledTimes(2);
  });
  it('blocks ads, missing frames and protected video', async () => {
    const player = video.closest('#movie_player') as HTMLElement;
    for (const reason of ['ad', 'frame', 'protected']) {
      player.classList.toggle('ad-showing', reason === 'ad');
      Object.defineProperty(video, 'videoWidth', {
        value: reason === 'frame' ? 0 : 1920,
        configurable: true,
      });
      Object.defineProperty(video, 'mediaKeys', {
        value: reason === 'protected' ? {} : null,
        configurable: true,
      });
      video.dispatchEvent(new Event('loadedmetadata'));
      await vi.advanceTimersByTimeAsync(300);
      expect(screenshot.disabled).toBe(true);
      screenshot.click();
    }
    expect(capture).not.toHaveBeenCalled();
  });
  it('removes the saved-disabled button and prevents detached actions', () => {
    const storage = changed.addListener.mock.calls.at(-1)?.[0];
    storage(
      {
        playerTools: {
          newValue: {
            ...DEFAULT_PLAYER_TOOLS,
            youtubeScreenshotEnabled: false,
          },
        },
      },
      'sync'
    );
    expect(document.querySelector('.mfs-screenshot-button')).toBeNull();
    screenshot.click();
    expect(capture).not.toHaveBeenCalled();
    storage({ playerTools: { newValue: DEFAULT_PLAYER_TOOLS } }, 'sync');
    expect(document.querySelector('.mfs-screenshot-button')).toBe(screenshot);
    tools.cleanup();
    screenshot.click();
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('YouTube Video Filters popup', () => {
  it('stays open through focus changes and inside interactions until toggled closed', () => {
    filtersButton().click();
    const host = document.querySelector(
      '.mfs-youtube-filters-popup'
    ) as HTMLElement;
    filterInput('Brightness').dispatchEvent(
      new Event('pointerdown', { bubbles: true, composed: true })
    );
    filterAction('Vivid').click();
    document.body.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(host.hidden).toBe(false);
    filtersButton().click();
    expect(host.hidden).toBe(true);
    filtersButton().click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(host.hidden).toBe(true);
  });
  it('previews the current frame, applies a preset, and clears its selection after custom edits', () => {
    const drawImage = vi.fn();
    const context = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    const frame = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,preview');
    try {
      filtersButton().click();
      expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 160, 90);
      const row = filtersRoot().querySelector('[aria-label="Filter presets"]');
      if (!row) throw new Error('Preset thumbnails missing');
      const buttons = [...(row?.querySelectorAll('button') ?? [])];
      expect(buttons.map((button) => button.textContent)).toEqual([
        'Original',
        'Vivid',
        'Cinema',
        'Soft',
        'Mono',
      ]);
      expect(row?.nextElementSibling?.textContent).toContain('Reset filters');
      expect(
        [...row.querySelectorAll('img')].every(
          (image) =>
            !image.hidden && image.src === 'data:image/jpeg;base64,preview'
        )
      ).toBe(true);
      const vivid = filterAction('Vivid');
      vivid.click();
      expect(vivid.getAttribute('aria-pressed')).toBe('true');
      expect(filterInput('Saturation').value).toBe('145');
      expect(video.style.filter).toContain('saturate(145%)');
      const saturation = filterInput('Saturation');
      saturation.value = '140';
      saturation.dispatchEvent(new Event('input'));
      expect(
        buttons.every(
          (button) => button.getAttribute('aria-pressed') === 'false'
        )
      ).toBe(true);
      filterAction('Mono').click();
      expect(filterInput('Grayscale').value).toBe('100');
      filterAction('Reset filters').click();
      expect(filterAction('Original').getAttribute('aria-pressed')).toBe(
        'true'
      );
      expect(video.currentTime).toBe(25);
      expect(video.paused).toBe(false);
    } finally {
      context.mockRestore();
      frame.mockRestore();
    }
  });
  it('keeps presets usable when the video frame cannot be previewed', () => {
    const context = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => {
        throw new Error('Frame blocked');
      });
    try {
      filtersButton().click();
      expect(
        [...filtersRoot().querySelectorAll('.preset img')].every(
          (image) => (image as HTMLImageElement).hidden
        )
      ).toBe(true);
      filterAction('Cinema').click();
      expect(filterInput('Contrast').value).toBe('125');
    } finally {
      context.mockRestore();
    }
  });
  it('toggles Filters and consumes outside dismissal without activating the video', () => {
    const nativeAction = vi.fn();
    video.addEventListener('click', nativeAction);
    filtersButton().click();
    const host = document.querySelector(
      '.mfs-youtube-filters-popup'
    ) as HTMLElement;
    filtersButton().click();
    expect(host.hidden).toBe(true);
    filtersButton().click();
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      video.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
        })
      );
    }
    expect(host.hidden).toBe(true);
    expect(nativeAction).not.toHaveBeenCalled();
    video.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    video.click();
    expect(nativeAction).toHaveBeenCalledOnce();
  });
  it('opens beside the native controls, applies filters live, and handles keyboard and outside closing', () => {
    const button = filtersButton();
    button.click();
    const host = document.querySelector(
      '.mfs-youtube-filters-popup'
    ) as HTMLElement;
    expect(host.parentElement).toBe(video.closest('#movie_player'));
    expect(host.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(host.id);
    expect(filtersRoot().activeElement).toBe(filterInput('Brightness'));
    const brightness = filterInput('Brightness');
    brightness.value = '150';
    brightness.dispatchEvent(new Event('input'));
    expect(video.style.filter).toContain('brightness(150%)');
    expect(brightness.getAttribute('aria-valuetext')).toBe('150%');
    const nativeKeydown = vi.fn();
    video.parentElement?.addEventListener('keydown', nativeKeydown);
    brightness.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        composed: true,
      })
    );
    expect(video.currentTime).toBe(25);
    expect(nativeKeydown).not.toHaveBeenCalled();
    brightness.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
      })
    );
    expect(host.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
    button.click();
    document.body.dispatchEvent(
      new Event('pointerdown', { bubbles: true, composed: true })
    );
    expect(host.hidden).toBe(true);
    button.click();
    filterAction('Reset filters').click();
    expect(filterInput('Brightness').value).toBe('100');
    expect(video.style.filter).toContain('brightness(100%)');
    expect(video.paused).toBe(false);
    expect(
      (document.querySelector('.mfs-player-tools') as HTMLElement).shadowRoot
        ?.textContent
    ).not.toContain('Reset filters');
  });
  it('saves and removes a YouTube preset and reports failures without resetting live filters', async () => {
    filtersButton().click();
    const brightness = filterInput('Brightness');
    brightness.value = '125';
    brightness.dispatchEvent(new Event('input'));
    filterAction('Save for YouTube').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      playerTools: expect.objectContaining({
        siteFilters: {
          'www.youtube.com': { ...DEFAULT_FILTERS, brightness: 125 },
        },
      }),
    });
    expect(filtersRoot().querySelector('[role="status"]')?.textContent).toBe(
      'Filters saved for YouTube.'
    );
    expect(
      filtersRoot().querySelector('[role="status"]')?.parentElement?.tagName
    ).toBe('HEADER');
    expect(filterAction('Remove saved preset').disabled).toBe(false);
    filterAction('Remove saved preset').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith({
      playerTools: expect.objectContaining({ siteFilters: {} }),
    });
    vi.mocked(chrome.storage.sync.set).mockRejectedValueOnce(
      new Error('Storage failed')
    );
    filterAction('Save for YouTube').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(
      filtersRoot().querySelector('[role="status"]')?.textContent
    ).toContain('Could not save filter preferences');
    expect(video.style.filter).toContain('brightness(125%)');
    expect(filterAction('Save for YouTube').disabled).toBe(false);
  });
  it('restores presets on construction and keeps filter changes when the button is hidden', async () => {
    tools.cleanup();
    getPreferences.mockResolvedValue({
      playerTools: {
        ...DEFAULT_PLAYER_TOOLS,
        siteFilters: {
          'www.youtube.com': { ...DEFAULT_FILTERS, contrast: 120 },
        },
      },
    });
    tools = new PlayerTools(video, document.createElement('div'));
    await vi.advanceTimersByTimeAsync(0);
    expect(filterInput('Contrast').value).toBe('120');
    expect(video.style.filter).toContain('contrast(120%)');
    filtersButton().click();
    preferencesChanged({ youtubeFiltersEnabled: false });
    expect(document.querySelector('.mfs-filters-button')).toBeNull();
    expect(document.querySelector('.mfs-youtube-filters-popup')).toBeNull();
    expect(video.style.filter).toContain('contrast(120%)');
  });
  it('closes for ads, PiP, fullscreen changes and navigation, reattaches, and cleans up', async () => {
    const button = filtersButton();
    const player = video.closest('#movie_player') as HTMLElement;
    button.click();
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    video.dispatchEvent(new Event('enterpictureinpicture'));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    player.classList.add('ad-showing');
    await vi.advanceTimersByTimeAsync(300);
    expect(button.disabled).toBe(true);
    expect(player.classList.contains('mfs-filters-open')).toBe(false);
    player.classList.remove('ad-showing');
    await vi.advanceTimersByTimeAsync(300);
    const replacement = document.createElement('div');
    replacement.className = 'ytp-right-controls';
    player.querySelector('.ytp-right-controls')?.replaceWith(replacement);
    await vi.advanceTimersByTimeAsync(300);
    expect(replacement.querySelector('.mfs-filters-button')).toBe(button);
    button.click();
    document.dispatchEvent(new Event('yt-navigate-start'));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    tools.cleanup();
    button.click();
    expect(document.querySelector('.mfs-youtube-filters-popup')).toBeNull();
    expect(player.classList.contains('mfs-filters-open')).toBe(false);
    expect(video.style.filter).toBe('');
  });
});

describe('YouTube advanced controls and shortcuts', () => {
  const advancedHost = () =>
    document.querySelector('.mfs-youtube-advanced-popup') as HTMLElement;
  const advancedInput = (label: string) => {
    const input = advancedHost()?.shadowRoot?.querySelector<HTMLInputElement>(
      `input[aria-label="${label}"]`
    );
    if (!input) throw new Error(`Missing advanced control: ${label}`);
    return input;
  };
  const control = (kind: string) =>
    document.querySelector(`.mfs-${kind}-button`) as HTMLButtonElement;
  const hold = async (kind: string) => {
    const button = control(kind);
    button.dispatchEvent(
      new MouseEvent('pointerdown', { button: 0, bubbles: true })
    );
    await vi.advanceTimersByTimeAsync(600);
    button.dispatchEvent(new Event('pointerup', { bubbles: true }));
    button.click();
    return button;
  };
  it.each(['boost', 'cinema', 'screenshot'])(
    'consumes an outside click when the %s menu is open',
    async (kind) => {
      await hold(kind);
      const nativeClick = vi.fn();
      video.addEventListener('click', nativeClick);
      video.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
      );
      video.click();
      expect(advancedHost().hidden).toBe(true);
      expect(nativeClick).not.toHaveBeenCalled();
      video.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      video.click();
      expect(nativeClick).toHaveBeenCalledOnce();
    }
  );
  const key = (value: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key: value,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    document.dispatchEvent(event);
    return event;
  };
  const liveStorage = () => {
    let saved = { ...DEFAULT_PLAYER_TOOLS };
    getPreferences.mockImplementation(async () => ({ playerTools: saved }));
    vi.mocked(chrome.storage.sync.set).mockImplementation(async (items) => {
      saved = (items as { playerTools: typeof DEFAULT_PLAYER_TOOLS })
        .playerTools;
      preferencesChanged(saved);
    });
    return () => saved;
  };
  it('keeps normal boost clicks separate from holds and applies saved levels to an active boost', async () => {
    const saved = liveStorage();
    await hold('boost');
    expect(boost).not.toHaveBeenCalled();
    const input = advancedInput('Volume boost');
    input.value = '7';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(900);
    expect(input.value).toBe('7');
    input.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saved().youtubeBoost).toBe(7);
    expect(control('boost').nextElementSibling?.textContent).toContain('7×');
    control('boost').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(boost).toHaveBeenLastCalledWith(video, 700);
    expect(control('boost').getAttribute('aria-pressed')).toBe('true');
    preferencesChanged({ youtubeBoost: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(input.value).toBe('4');
    expect(boost).toHaveBeenLastCalledWith(video, 400);
    expect(advancedHost().hidden).toBe(false);
  });
  it('previews active boost and Cinema sliders before the drag is committed', async () => {
    const saved = liveStorage();
    control('boost').click();
    await vi.advanceTimersByTimeAsync(0);
    await hold('boost');
    const level = advancedInput('Volume boost');
    level.value = '6';
    level.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(0);
    expect(boost).toHaveBeenLastCalledWith(video, 600);
    expect(saved().youtubeBoost).toBe(DEFAULT_PLAYER_TOOLS.youtubeBoost);
    level.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saved().youtubeBoost).toBe(6);
    expect(
      advancedHost().shadowRoot?.querySelector('header [role="status"]')
        ?.textContent
    ).toBe('Saved.');
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    control('cinema').click();
    await hold('cinema');
    const dimming = advancedInput('Page dimming');
    dimming.value = '42';
    dimming.dispatchEvent(new Event('input'));
    const toolsRoot = document.querySelector('.mfs-player-tools')?.shadowRoot;
    expect(toolsRoot?.querySelector<HTMLElement>('.shade')?.style.opacity).toBe(
      '0.42'
    );
    expect(saved().dimming).toBe(DEFAULT_PLAYER_TOOLS.dimming);
    dimming.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saved().dimming).toBe(42);
  });
  it('saves cinema presets, custom selection, and dimming while keeping the menu and selection current', async () => {
    const saved = liveStorage();
    await hold('cinema');
    expect(control('cinema').getAttribute('aria-pressed')).toBe('false');
    const root = advancedHost().shadowRoot;
    const ocean = root?.querySelector<HTMLButtonElement>(
      '[aria-label="Ocean Cinema Mode preset"]'
    );
    ocean?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved()).toMatchObject({
      cinemaColor: '#172554',
      cinemaColorCustom: false,
    });
    expect(ocean?.getAttribute('aria-pressed')).toBe('true');
    const color = advancedInput('Custom Cinema Mode color');
    color.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(color.parentElement?.getAttribute('aria-pressed')).toBe('true');
    color.value = '#123456';
    color.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saved()).toMatchObject({
      cinemaColor: '#123456',
      cinemaColorCustom: true,
    });
    expect(root?.querySelector('legend')?.textContent).toContain(
      'Custom: #123456'
    );
    const dimming = advancedInput('Page dimming');
    dimming.value = '65';
    dimming.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saved().dimming).toBe(65);
    preferencesChanged({
      dimming: 35,
      cinemaColor: '#431407',
      cinemaColorCustom: false,
    });
    expect(dimming.value).toBe('35');
    expect(root?.querySelector('legend')?.textContent).toContain('Sunset');
    expect(color.parentElement?.getAttribute('aria-pressed')).toBe('false');
    expect(advancedHost().hidden).toBe(false);
  });
  it('saves screenshot filter inclusion in the same preference and uses it on normal capture', async () => {
    const saved = liveStorage();
    await hold('screenshot');
    expect(capture).not.toHaveBeenCalled();
    advancedInput('Include video filters').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved().youtubeScreenshotIncludeFilters).toBe(true);
    screenshot.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(capture).toHaveBeenLastCalledWith(video, DEFAULT_FILTERS);
    preferencesChanged({ youtubeScreenshotIncludeFilters: false });
    expect(advancedInput('Include video filters').checked).toBe(false);
  });
  it('preserves unrelated latest preferences, serializes rapid edits, and recovers from storage errors', async () => {
    const saved = liveStorage();
    await hold('boost');
    const input = advancedInput('Volume boost');
    const set = vi.mocked(chrome.storage.sync.set);
    set.mockRejectedValueOnce(new Error('Storage quota'));
    input.value = '5';
    input.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(0);
    expect(
      advancedHost().shadowRoot?.querySelector('[role="status"]')?.textContent
    ).toContain('Could not save');
    expect(input.value).toBe('2');
    expect(advancedHost().hidden).toBe(false);
    input.value = '6';
    input.dispatchEvent(new Event('change'));
    advancedInput('Automatically boost new videos').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved()).toMatchObject({
      youtubeBoost: 6,
      youtubeAutoBoost: true,
      miniPlayer: true,
    });
    expect(
      advancedHost().shadowRoot?.querySelector('[role="status"]')?.textContent
    ).toBe('Saved.');
  });
  it.each([
    'ads',
    'fullscreen',
    'pip',
    'navigation',
    'disabled',
    'cleanup',
  ] as const)('closes advanced options on %s', async (reason) => {
    await hold('cinema');
    const host = advancedHost();
    if (reason === 'ads') {
      video.closest('#movie_player')?.classList.add('ad-showing');
      video.dispatchEvent(new Event('timeupdate'));
      await vi.advanceTimersByTimeAsync(300);
    } else if (reason === 'fullscreen')
      document.dispatchEvent(new Event('fullscreenchange'));
    else if (reason === 'pip')
      video.dispatchEvent(new Event('enterpictureinpicture'));
    else if (reason === 'navigation')
      document.dispatchEvent(new Event('yt-navigate-start'));
    else if (reason === 'disabled')
      preferencesChanged({ youtubeCinemaEnabled: false });
    else tools.cleanup();
    expect(host.hidden || !host.isConnected).toBe(true);
    expect(control('cinema')?.getAttribute('aria-expanded') ?? 'false').toBe(
      'false'
    );
  });
  it('reopens after toolbar replacement and removes the popup completely on shutdown', async () => {
    await hold('cinema');
    const host = advancedHost();
    const old = document.querySelector('.ytp-right-controls') as HTMLElement;
    const replacement = document.createElement('div');
    replacement.className = 'ytp-right-controls';
    replacement.innerHTML = '<button class="ytp-subtitles-button"></button>';
    old.replaceWith(replacement);
    video.dispatchEvent(new Event('timeupdate'));
    await vi.advanceTimersByTimeAsync(300);
    expect(control('cinema').isConnected).toBe(true);
    // A disconnected anchor closes the stale popup, and the new toolbar can reopen it.
    expect(host.hidden).toBe(true);
    await hold('cinema');
    expect(host.hidden).toBe(false);
    tools.cleanup();
    expect(host.isConnected).toBe(false);
    expect(document.querySelector('.mfs-youtube-controls')).toBeNull();
  });
  it('supports action and advanced hotkeys, ignores typing/modifiers/repeats, and leaves native keys alone', async () => {
    expect(key('d').defaultPrevented).toBe(true);
    expect(control('cinema').getAttribute('aria-pressed')).toBe('true');
    expect(key('e').defaultPrevented).toBe(true);
    expect(control('info-cards').getAttribute('aria-pressed')).toBe('false');
    expect(key('s').defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(capture).toHaveBeenCalledOnce();
    for (const name of ['b', 'd', 's']) {
      (document.activeElement as HTMLElement)?.blur();
      expect(key(name, { shiftKey: true }).defaultPrevented).toBe(true);
      expect(advancedHost().hidden).toBe(false);
      expect(key('Escape').defaultPrevented).toBe(true);
      expect(advancedHost().hidden).toBe(true);
    }
    (document.activeElement as HTMLElement)?.blur();
    expect(key('b').defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(boost).toHaveBeenCalledExactlyOnceWith(video, 200);
    for (const name of ['c', 'f', 't', 'k', 'm'])
      expect(key(name).defaultPrevented).toBe(false);
    expect(key('b', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key('b', { repeat: true }).defaultPrevented).toBe(false);
    const typing = document.createElement('input');
    document.body.append(typing);
    typing.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'b', bubbles: true })
    );
    expect(boost).toHaveBeenCalledOnce();
    preferencesChanged({ youtubeCinemaEnabled: false });
    expect(key('d').defaultPrevented).toBe(false);
    video.closest('#movie_player')?.classList.add('ad-showing');
    expect(key('b').defaultPrevented).toBe(false);
  });
  it('opens Filters and Loop with their shortcuts and keeps inside menu interactions open', () => {
    expect(key('v').defaultPrevented).toBe(true);
    const host = document.querySelector(
      '.mfs-youtube-filters-popup'
    ) as HTMLElement;
    expect(host.hidden).toBe(false);
    filterInput('Brightness').dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', bubbles: true, composed: true })
    );
    expect(capture).not.toHaveBeenCalled();
    expect(host.hidden).toBe(false);
    key('Escape');
    (document.activeElement as HTMLElement)?.blur();
    expect(key('r').defaultPrevented).toBe(true);
    expect(
      document
        .querySelector('#movie_player')
        ?.classList.contains('mfs-filters-open')
    ).toBe(false);
    expect(control('loop-edit').getAttribute('aria-expanded')).toBe('true');
  });
});

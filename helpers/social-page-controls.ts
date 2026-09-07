import {
  INSTAGRAM_SPEEDS,
  normalizeInstagramSpeed,
} from '@/helpers/instagram-settings';
import {
  getViewportOverlayHost,
  removeEmptyOverlayHost,
} from '@/helpers/overlay-portal';
import type { ContentSettingsT } from '@/types/content';

export type SocialPlaybackSetting =
  | 'instagramPlaybackSpeed'
  | 'instagramAutoSkip'
  | 'tiktokPlaybackSpeed'
  | 'tiktokAutoSkip';
type Site = 'instagram' | 'tiktok';

export function setupSocialPageControls(
  video: HTMLVideoElement,
  site: Site,
  getSettings: () => Partial<ContentSettingsT>,
  onSettingChange?: (
    key: SocialPlaybackSetting,
    value: number | boolean
  ) => void
) {
  const doc = video.ownerDocument;
  const win = doc.defaultView ?? window;
  const speedKey = `${site}PlaybackSpeed` as const;
  const skipKey = `${site}AutoSkip` as const;
  const toolbar = doc.createElement('div');
  toolbar.className = 'mfs-social-page-controls';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute(
    'aria-label',
    `${site === 'instagram' ? 'Instagram' : 'TikTok'} playback controls`
  );
  toolbar.style.cssText =
    'all:initial;position:absolute;display:flex;flex-direction:column;gap:20px;width:52px;pointer-events:auto;z-index:2147483647;color:var(--mfs-foreground);font:600 12px/1.2 system-ui;';
  const systemTheme = win.matchMedia?.('(prefers-color-scheme: dark)');
  function updateAppearance(anchor: Element, overVideo: boolean) {
    let dark: boolean | undefined = overVideo ? true : undefined;
    // Read the rendered surface so a site's explicit theme wins over the OS.
    for (
      let element: Element | null = anchor;
      dark === undefined && element;
      element = element.parentElement
    ) {
      const style = win.getComputedStyle(element);
      const channels = style.backgroundColor.match(/[\d.]+/g)?.map(Number);
      if (channels && channels.length >= 3 && (channels[3] ?? 1) >= 0.5) {
        dark =
          (channels[0] ?? 0) * 0.2126 +
            (channels[1] ?? 0) * 0.7152 +
            (channels[2] ?? 0) * 0.0722 <
          140;
      } else if (
        style.colorScheme === 'dark' ||
        style.colorScheme === 'light'
      ) {
        dark = style.colorScheme === 'dark';
      }
    }
    toolbar.dataset.appearance =
      (dark ?? systemTheme?.matches ?? false) ? 'dark' : 'light';
  }
  const styles = doc.createElement('style');
  styles.textContent = `
    .mfs-social-page-controls[data-appearance="light"] { --mfs-foreground:#0c1014; --mfs-menu:rgba(255,255,255,.92); --mfs-border:#00000026; --mfs-hover:#0000000f; --mfs-selected:#0000001a; --mfs-track:#dbdfe4; --mfs-active:#0c1014; --mfs-active-knob:#f8f9f9; color-scheme:light; }
    .mfs-social-page-controls[data-appearance="dark"] { --mfs-foreground:#f8f9f9; --mfs-menu:rgba(20,20,20,.86); --mfs-border:#ffffff3d; --mfs-hover:#ffffff1f; --mfs-selected:#ffffff33; --mfs-track:#2c2f33; --mfs-active:#f8f9f9; --mfs-active-knob:#0c1014; color-scheme:dark; }
    .mfs-social-page-controls button { appearance:none; margin:0; padding:0; border:0; cursor:pointer; color:inherit; font:inherit; }
    .mfs-social-page-controls button:focus-visible { outline:2px solid var(--mfs-foreground); outline-offset:3px; }
    .mfs-social-page-controls .mfs-control-group { height:44px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; white-space:nowrap; text-align:center; }
    .mfs-social-page-controls .mfs-speed-button { width:36px; height:28px; background:transparent; }
    .mfs-social-page-controls .mfs-speed-menu { position:absolute; width:68px; padding:6px; box-sizing:border-box; border-radius:13px; background:var(--mfs-menu); border:1px solid var(--mfs-border); backdrop-filter:blur(16px) saturate(140%); box-shadow:0 6px 24px #0004; }
    .mfs-social-page-controls .mfs-speed-option { display:block; width:100%; height:28px; border-radius:10px; background:transparent; font-size:13px; }
    .mfs-social-page-controls .mfs-speed-option:hover { background:var(--mfs-hover); }
    .mfs-social-page-controls .mfs-speed-option[aria-checked=true] { background:var(--mfs-selected); }
    .mfs-social-page-controls .mfs-skip-switch { width:40px; height:22px; border-radius:20px; background:var(--mfs-track); transition:background 150ms; }
    .mfs-social-page-controls .mfs-skip-switch span { display:block; width:12px; height:12px; margin-left:5px; border-radius:50%; background:white; transition:transform 150ms,background 150ms; }
    .mfs-social-page-controls .mfs-skip-switch[aria-checked=true] { background:var(--mfs-active); }
    .mfs-social-page-controls .mfs-skip-switch[aria-checked=true] span { transform:translateX(18px); background:var(--mfs-active-knob); }
  `;
  const speedGroup = doc.createElement('div');
  speedGroup.className = 'mfs-control-group';
  const speed = doc.createElement('button');
  speed.type = 'button';
  speed.className = 'mfs-speed-button';
  speed.dataset.mfsAction = 'playback-speed';
  speed.setAttribute('aria-label', 'Playback speed');
  speed.setAttribute('aria-haspopup', 'menu');
  speed.setAttribute('aria-expanded', 'false');
  speed.innerHTML =
    '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M3 23a11 11 0 0 1 22 0M6 21h1M21 21h1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><g class="mfs-speed-needle" style="transform-origin:14px 23px;transition:transform 260ms cubic-bezier(.2,.8,.2,1)"><path d="M14 23v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></g><circle cx="14" cy="23" r="1.5" fill="currentColor"/></svg>';
  const speedLabel = doc.createElement('span');
  const menu = doc.createElement('div');
  menu.className = 'mfs-speed-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Playback speed');
  menu.hidden = true;
  const options = INSTAGRAM_SPEEDS.map((value) => {
    const option = doc.createElement('button');
    option.type = 'button';
    option.className = 'mfs-speed-option';
    option.setAttribute('role', 'menuitemradio');
    option.textContent = `${value}×`;
    option.addEventListener('click', () => {
      save(speedKey, value);
      closeMenu(true);
    });
    menu.append(option);
    return option;
  });
  speedGroup.append(speed, speedLabel);
  const skipGroup = doc.createElement('div');
  skipGroup.className = 'mfs-control-group';
  const skip = doc.createElement('button');
  skip.type = 'button';
  skip.className = 'mfs-skip-switch';
  skip.dataset.mfsAction = 'auto-skip';
  skip.setAttribute('role', 'switch');
  skip.setAttribute('aria-label', 'Auto-Skip');
  skip.append(doc.createElement('span'));
  const skipLabel = doc.createElement('span');
  skipLabel.textContent = 'Auto-skip';
  skipGroup.append(skip, skipLabel);
  toolbar.append(styles, speedGroup, skipGroup, menu);
  function closeMenu(focus = false) {
    menu.hidden = true;
    speed.setAttribute('aria-expanded', 'false');
    if (focus) speed.focus();
  }
  function openMenu() {
    menu.hidden = false;
    speed.setAttribute('aria-expanded', 'true');
    options
      .find((option) => option.getAttribute('aria-checked') === 'true')
      ?.focus();
  }
  speed.addEventListener('click', () =>
    menu.hidden ? openMenu() : closeMenu()
  );
  speed.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu();
    }
  });
  toolbar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      closeMenu(true);
    }
    const index = options.indexOf(doc.activeElement as HTMLButtonElement);
    if (
      index >= 0 &&
      ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
    ) {
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
              options.length;
      options[next]?.focus();
    }
  });
  const outside = (event: Event) => {
    if (!toolbar.contains(event.target as Node)) closeMenu();
  };
  doc.addEventListener('pointerdown', outside, true);
  toolbar.addEventListener('focusout', (event) => {
    if (!toolbar.contains(event.relatedTarget as Node)) closeMenu();
  });
  const stop = (event: Event) => event.stopPropagation();
  const stoppedEvents = [
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'click',
    'dblclick',
    'keydown',
    'keyup',
    'wheel',
  ];
  stoppedEvents.forEach((event) => {
    toolbar.addEventListener(event, stop);
  });
  let frame: number | undefined;
  let disposed = false;
  const area = (candidate: HTMLVideoElement) => {
    const rect = candidate.getBoundingClientRect();
    return (
      Math.max(
        0,
        Math.min(rect.right, win.innerWidth) - Math.max(rect.left, 0)
      ) *
      Math.max(
        0,
        Math.min(rect.bottom, win.innerHeight) - Math.max(rect.top, 0)
      )
    );
  };
  function sync() {
    if (disposed) return;
    const settings = getSettings();
    const showSpeed = settings[`${site}ShowPlaybackSpeed`] === true;
    const showSkip = settings[`${site}ShowAutoSkip`] === true;
    speedGroup.style.display = showSpeed ? 'flex' : 'none';
    skipGroup.style.display = showSkip ? 'flex' : 'none';
    if (!showSpeed) closeMenu();
    const value = normalizeInstagramSpeed(settings[speedKey]);
    speedLabel.textContent = `${value}×`;
    speed.title = `Playback speed: ${value}×`;
    const angle = [-90, -45, 0, 22.5, 45, 90][INSTAGRAM_SPEEDS.indexOf(value)];
    speed
      .querySelector<SVGElement>('.mfs-speed-needle')
      ?.style.setProperty('transform', `rotate(${angle}deg)`);
    options.forEach((option, index) => {
      option.setAttribute(
        'aria-checked',
        String(INSTAGRAM_SPEEDS[index] === value)
      );
    });
    const enabled = settings[skipKey] === true;
    skip.setAttribute('aria-checked', String(enabled));
    skip.title = `Auto-Skip: ${enabled ? 'on' : 'off'}`;
    if (!showSpeed && !showSkip) {
      closeMenu();
      toolbar.remove();
      removeEmptyOverlayHost(doc);
      return;
    }
    const bestVideo = Array.from(
      doc.querySelectorAll<HTMLVideoElement>('video:not(.mfs-thumbnail-video)')
    ).reduce<HTMLVideoElement | null>(
      (best, candidate) =>
        area(candidate) > (best ? area(best) : 0) ? candidate : best,
      null
    );
    const blockedByDialog = Array.from(
      doc.querySelectorAll('[role="dialog"], [aria-modal="true"]')
    ).some(
      (dialog) => !dialog.contains(video) && dialog.getClientRects().length > 0
    );
    if (bestVideo !== video || blockedByDialog) {
      closeMenu();
      toolbar.remove();
      removeEmptyOverlayHost(doc);
      return;
    }
    const rect = video.getBoundingClientRect();
    const height = showSpeed && showSkip ? 108 : 44;
    // Locate the visible action rail adjacent to this video, without depending
    // on the platforms' generated class names or moving any native buttons.
    const scope =
      video.closest(
        'article, [data-e2e="recommend-list-item-container"], [id^="one-column-item-"]'
      ) ?? doc;
    const railButtons = Array.from(
      scope.querySelectorAll<HTMLElement>(
        'button, [role="button"], [role="checkbox"], svg[aria-label]'
      )
    ).filter((button) => {
      if (button.closest('.mfs-social-page-controls')) return false;
      const label = [
        button.getAttribute('aria-label'),
        button.getAttribute('data-e2e'),
      ].join(' ');
      if (
        !/like|comment|share|gostar|coment|partilhar|curtir|compartilhar|gosto/i.test(
          label
        )
      )
        return false;
      const bounds = button.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.left >= rect.right - 32 &&
        bounds.left < rect.right + 130 &&
        bounds.top >= Math.max(rect.top, 0) &&
        bounds.bottom <= Math.min(rect.bottom, win.innerHeight)
      );
    });
    const firstRailButton = railButtons.sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
    )[0];
    let rail = firstRailButton?.getBoundingClientRect();
    // Include an avatar above Like when it belongs to the same narrow rail.
    for (
      let parent = firstRailButton?.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const bounds = parent.getBoundingClientRect();
      if (bounds.width > 100 || bounds.left < rect.right - 32) break;
      if (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.top >= Math.max(0, rect.top)
      )
        rail = bounds;
    }
    let left = rail ? rail.left + rail.width / 2 - 26 : rect.right - 64;
    let top = rail ? rail.top - height - 20 : rect.top + 12;
    if (top < Math.max(8, rect.top)) {
      left = rect.right - 64;
      top = rect.top + 12;
    }
    left = Math.max(8, Math.min(left, win.innerWidth - 60));
    top = Math.max(8, Math.min(top, win.innerHeight - height - 8));
    updateAppearance(
      firstRailButton?.parentElement ?? video.parentElement ?? doc.body,
      left < rect.right && left + 52 > rect.left
    );
    menu.style.left = left >= 86 ? '-78px' : '62px';
    menu.style.top = `${Math.max(8 - top, Math.min(-70, win.innerHeight - top - 190))}px`;
    const fullscreen = doc.fullscreenElement;
    const host = fullscreen?.contains(video)
      ? (fullscreen as HTMLElement)
      : getViewportOverlayHost(doc);
    if (toolbar.parentElement !== host) host.append(toolbar);
    const hostRect = host.getBoundingClientRect();
    toolbar.style.left = `${left - hostRect.left + host.scrollLeft - host.clientLeft}px`;
    toolbar.style.top = `${top - hostRect.top + host.scrollTop - host.clientTop}px`;
  }
  function schedule() {
    if (frame !== undefined || disposed) return;
    frame = win.requestAnimationFrame(() => {
      frame = undefined;
      sync();
    });
  }
  function save(key: SocialPlaybackSetting, value: number | boolean) {
    onSettingChange?.(key, value);
    chrome.storage.sync.set({ [key]: value });
    doc.dispatchEvent(new Event(`mfs-${site}-settings`));
  }
  const toggleSkip = () => save(skipKey, getSettings()[skipKey] !== true);
  skip.addEventListener('click', toggleSkip);
  doc.addEventListener(`mfs-${site}-settings`, sync);
  doc.addEventListener('scroll', schedule, true);
  doc.addEventListener('fullscreenchange', schedule);
  win.addEventListener('resize', schedule);
  video.addEventListener('play', schedule);
  video.addEventListener('loadedmetadata', schedule);
  video.addEventListener('timeupdate', schedule);
  const appearanceObserver = new MutationObserver(schedule);
  for (const element of [doc.documentElement, doc.body]) {
    if (element)
      appearanceObserver.observe(element, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'],
      });
  }
  // Sites can replace the portal or change player/dialog layout while paused,
  // when no timeupdate arrives to restore the controls. Ignore our own DOM
  // updates so syncing the toolbar cannot start an observer feedback loop.
  const layoutObserver = new MutationObserver((records) => {
    if (
      records.some((record) => {
        const target = record.target;
        if (
          toolbar.isConnected &&
          target instanceof Element &&
          target.closest('.mfs-viewport-portal, .mfs-social-page-controls')
        )
          return false;
        return (
          record.type === 'attributes' ||
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node instanceof Element &&
              !node.matches('.mfs-viewport-portal, .mfs-social-page-controls')
          ) ||
          !toolbar.isConnected
        );
      })
    )
      schedule();
  });
  layoutObserver.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'role', 'aria-modal'],
  });
  const sizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(schedule)
      : undefined;
  sizeObserver?.observe(video);
  systemTheme?.addEventListener('change', schedule);
  sync();
  return {
    cleanup() {
      disposed = true;
      appearanceObserver.disconnect();
      layoutObserver.disconnect();
      sizeObserver?.disconnect();
      systemTheme?.removeEventListener('change', schedule);
      if (frame !== undefined) win.cancelAnimationFrame(frame);
      doc.removeEventListener('pointerdown', outside, true);
      skip.removeEventListener('click', toggleSkip);
      stoppedEvents.forEach((event) => {
        toolbar.removeEventListener(event, stop);
      });
      doc.removeEventListener(`mfs-${site}-settings`, sync);
      doc.removeEventListener('scroll', schedule, true);
      doc.removeEventListener('fullscreenchange', schedule);
      win.removeEventListener('resize', schedule);
      video.removeEventListener('play', schedule);
      video.removeEventListener('loadedmetadata', schedule);
      video.removeEventListener('timeupdate', schedule);
      closeMenu();
      toolbar.remove();
      removeEmptyOverlayHost(doc);
    },
  };
}

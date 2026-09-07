import { normalizeInstagramSpeed } from '@/helpers/instagram-settings';
import {
  type SocialPlaybackSetting,
  setupSocialPageControls,
} from '@/helpers/social-page-controls';
import type { ContentSettingsT } from '@/types/content';

type AudioPreference = { volume: number; muted: boolean };
type AudioState = {
  preference?: AudioPreference;
  revision: number;
  loaded: boolean;
  pendingWrites: number;
};
const audioStates = new WeakMap<Document, AudioState>();
const validAudio = (value: unknown): value is AudioPreference => {
  const audio = value as AudioPreference | undefined;
  return (
    !!audio &&
    typeof audio.volume === 'number' &&
    Number.isFinite(audio.volume) &&
    audio.volume >= 0 &&
    audio.volume <= 1 &&
    typeof audio.muted === 'boolean'
  );
};

export function setupSocialVideo(
  video: HTMLVideoElement,
  getSettings: () => Partial<ContentSettingsT>,
  onSettingChange?: (
    key: SocialPlaybackSetting,
    value: number | boolean
  ) => void
) {
  const doc = video.ownerDocument;
  const win = doc.defaultView;
  const host = win?.location.hostname ?? '';
  const site = ['instagram', 'tiktok'].find(
    (name) => host === `${name}.com` || host.endsWith(`.${name}.com`)
  );
  if (!site || !win)
    return {
      remember: (_preference?: AudioPreference) => {},
      cleanup: () => {},
    };
  const key = `mfs-${site}-audio`;
  let state = audioStates.get(doc);
  if (!state) {
    state = { revision: 0, loaded: false, pendingWrites: 0 };
    audioStates.set(doc, state);
  }
  const shared = state;
  let disposed = false;
  let applyingAudio = false;
  let nativeIntentUntil = 0;
  const originalRate = video.playbackRate;
  const originalLoop = video.loop;
  let ownsRate = false;
  let ownsLoop = false;
  let skipped = false;
  const visibleArea = (element: HTMLVideoElement) => {
    const rect = element.getBoundingClientRect();
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
  const isActive = () => {
    const area = visibleArea(video);
    return (
      area > 0 &&
      !Array.from(doc.querySelectorAll('video')).some(
        (other) => other !== video && visibleArea(other) > area
      )
    );
  };
  const isReels = () =>
    site === 'instagram' && /^\/reels?(\/|$)/.test(win.location.pathname);
  const restoreAudio = () => {
    const preference = shared.preference;
    if (disposed || !preference || applyingAudio) return;
    applyingAudio = true;
    try {
      if (video.volume !== preference.volume) video.volume = preference.volume;
      // Offscreen/preloaded players retain the site's mute policy. Respect
      // browser autoplay restrictions until the user has interacted.
      if (
        !video.paused &&
        isActive() &&
        (preference.muted ||
          win.navigator.userActivation?.hasBeenActive !== false)
      ) {
        if (video.muted !== preference.muted) video.muted = preference.muted;
      }
    } finally {
      applyingAudio = false;
    }
  };
  const autoSkipEnabled = () =>
    site === 'instagram'
      ? isReels() && getSettings().instagramAutoSkip
      : getSettings().tiktokAutoSkip === true;
  const syncSettings = () => {
    const settings = getSettings();
    const speed = normalizeInstagramSpeed(
      site === 'instagram'
        ? settings.instagramPlaybackSpeed
        : settings.tiktokPlaybackSpeed
    );
    if (video.playbackRate !== speed) video.playbackRate = speed;
    ownsRate = true;
    if (autoSkipEnabled()) {
      if (video.loop) video.loop = false;
      ownsLoop = true;
    } else if (ownsLoop) {
      video.loop = originalLoop;
      ownsLoop = false;
    }
  };
  const onPlay = () => {
    skipped = false;
    restoreAudio();
    syncSettings();
  };
  const onEnded = () => {
    if (
      skipped ||
      !autoSkipEnabled() ||
      !isActive() ||
      doc.visibilityState === 'hidden' ||
      Array.from(
        doc.querySelectorAll('[role="dialog"], [aria-modal="true"]')
      ).some((dialog) => site !== 'tiktok' || !dialog.contains(video))
    )
      return;
    if (site === 'tiktok') {
      const nextButton = Array.from(
        doc.querySelectorAll<HTMLElement>(
          'button[aria-label="Next video" i], [role="button"][aria-label="Next video" i], button[title="Next video" i]'
        )
      ).find((button) => {
        const rect = button.getBoundingClientRect();
        return (
          !button.hasAttribute('disabled') &&
          button.getAttribute('aria-disabled') !== 'true' &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
      if (nextButton) {
        skipped = true;
        nextButton.click();
        return;
      }
    }
    // Find the video's scroll container rather than relying on generated classes.
    for (
      let parent = video.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const style = win.getComputedStyle(parent);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        parent.scrollHeight > parent.clientHeight &&
        parent.clientHeight > 0
      ) {
        if (parent.scrollTop + parent.clientHeight >= parent.scrollHeight - 1)
          return;
        skipped = true;
        parent.scrollBy({ top: parent.clientHeight, behavior: 'smooth' });
        return;
      }
    }
  };
  const remember = (
    preference: AudioPreference = { volume: video.volume, muted: video.muted }
  ) => {
    if (!validAudio(preference) || disposed) return;
    shared.preference = { ...preference };
    shared.revision++;
    // Start the durable write immediately: page teardown does not reliably
    // run controller cleanup or a debounce timer before a reload/browser exit.
    shared.pendingWrites++;
    chrome.storage.local.set({ [key]: shared.preference }, () => {
      shared.pendingWrites--;
      // Read lastError to avoid an unhandled extension-context error.
      void chrome.runtime?.lastError;
    });
  };
  if (
    !shared.loaded &&
    typeof chrome !== 'undefined' &&
    chrome.storage?.local
  ) {
    shared.loaded = true;
    const revision = shared.revision;
    chrome.storage.local.get(key, (result) => {
      if (revision === shared.revision && validAudio(result[key]))
        shared.preference = result[key];
      doc.dispatchEvent(new Event('mfs-audio-loaded'));
    });
  }
  const onStorage = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) => {
    if (
      area !== 'local' ||
      !validAudio(changes[key]?.newValue) ||
      shared.pendingWrites > 0
    )
      return;
    shared.preference = changes[key].newValue;
    restoreAudio();
  };
  const onMetadata = () => {
    skipped = false;
    restoreAudio();
    syncSettings();
  };
  const loopObserver = new MutationObserver(syncSettings);
  loopObserver.observe(video, {
    attributes: true,
    attributeFilter: ['loop'],
  });
  const onFirstActivation = (event: Event) => {
    if (win.navigator.userActivation?.hasBeenActive === false) return;
    doc.removeEventListener('pointerdown', onFirstActivation, true);
    doc.removeEventListener('keydown', onFirstActivation, true);
    // Let our mute/slider controls apply the action the user actually chose.
    // Unmuting here first would turn a subsequent Unmute click into Mute.
    if (
      event.target instanceof Element &&
      event.target.closest('[data-mfs-action]')
    )
      return;
    restoreAudio();
  };
  doc.addEventListener('pointerdown', onFirstActivation, true);
  doc.addEventListener('keydown', onFirstActivation, true);
  video.addEventListener('seeked', restoreAudio);
  video.addEventListener('playing', restoreAudio);
  video.addEventListener('ratechange', syncSettings);
  video.addEventListener('play', onPlay);
  video.addEventListener('loadedmetadata', onMetadata);
  const onNativeAudioIntent = (event: Event) => {
    if (event.type === 'pointermove' && (event as PointerEvent).buttons === 0)
      return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('[data-mfs-action]')) return;
    const control = target.closest(
      'button, [role="button"], [role="slider"], input[type="range"]'
    );
    if (!control) return;
    const label = [
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('data-e2e'),
      control.querySelector('svg title')?.textContent,
    ].join(' ');
    if (/volume|mute|sound|audio|som|silenciar/i.test(label) && isActive()) {
      nativeIntentUntil = Date.now() + 1500;
    }
  };
  const onVolumeChange = () => {
    if (applyingAudio) return;
    // Site initialization/autoplay also fires volumechange. Only deliberate
    // audio-control interaction may replace the user's durable preference.
    if (
      !getSettings().hideVideoControls &&
      Date.now() < nativeIntentUntil &&
      isActive()
    ) {
      if (
        video.volume !== shared.preference?.volume ||
        video.muted !== shared.preference?.muted
      )
        remember();
    } else {
      restoreAudio();
    }
  };
  doc.addEventListener('pointerdown', onNativeAudioIntent, true);
  doc.addEventListener('pointermove', onNativeAudioIntent, true);
  doc.addEventListener('keydown', onNativeAudioIntent, true);
  doc.addEventListener('wheel', onNativeAudioIntent, true);
  video.addEventListener('volumechange', onVolumeChange);
  video.addEventListener('ended', onEnded);
  doc.addEventListener('mfs-audio-loaded', restoreAudio);
  doc.addEventListener(`mfs-${site}-settings`, syncSettings);
  if (typeof chrome !== 'undefined')
    chrome.storage?.onChanged?.addListener(onStorage);
  restoreAudio();
  syncSettings();
  const pageControls = setupSocialPageControls(
    video,
    site as 'instagram' | 'tiktok',
    getSettings,
    onSettingChange
  );
  return {
    remember,
    cleanup: () => {
      disposed = true;
      pageControls.cleanup();
      loopObserver.disconnect();
      video.removeEventListener('ratechange', syncSettings);
      doc.removeEventListener('pointerdown', onFirstActivation, true);
      doc.removeEventListener('keydown', onFirstActivation, true);
      video.removeEventListener('seeked', restoreAudio);
      video.removeEventListener('playing', restoreAudio);
      doc.removeEventListener('pointerdown', onNativeAudioIntent, true);
      doc.removeEventListener('pointermove', onNativeAudioIntent, true);
      doc.removeEventListener('keydown', onNativeAudioIntent, true);
      doc.removeEventListener('wheel', onNativeAudioIntent, true);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ended', onEnded);
      doc.removeEventListener('mfs-audio-loaded', restoreAudio);
      doc.removeEventListener(`mfs-${site}-settings`, syncSettings);
      if (typeof chrome !== 'undefined')
        chrome.storage?.onChanged?.removeListener(onStorage);
      if (ownsRate) video.playbackRate = originalRate;
      if (ownsLoop) video.loop = originalLoop;
    },
  };
}

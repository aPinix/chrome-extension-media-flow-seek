import { VideoStateT } from '@/types/content';

export class VideoStateManager {
  private videoStates = new Map<HTMLVideoElement, VideoStateT>();

  set(video: HTMLVideoElement, state: VideoStateT): void {
    this.videoStates.set(video, state);
  }

  get(video: HTMLVideoElement): VideoStateT | undefined {
    return this.videoStates.get(video);
  }

  has(video: HTMLVideoElement): boolean {
    return this.videoStates.has(video);
  }

  delete(video: HTMLVideoElement): boolean {
    const state = this.videoStates.get(video);
    if (state) {
      // Call sync cleanup function if it exists
      if (state.syncCleanup) {
        state.syncCleanup();
      }

      // Clean up DOM elements
      state.overlay.remove();
      state.scrollContent.remove();
      state.timeline.remove();
      state.debugIndicator.remove();
      state.wrapper.remove();
    }
    return this.videoStates.delete(video);
  }

  clear(): void {
    // Clean up all DOM elements before clearing
    this.videoStates.forEach((state) => {
      // Call sync cleanup function if it exists
      if (state.syncCleanup) {
        state.syncCleanup();
      }

      state.overlay.remove();
      state.scrollContent.remove();
      state.timeline.remove();
      state.debugIndicator.remove();
      state.wrapper.remove();
    });
    this.videoStates.clear();
  }

  forEach(
    callback: (state: VideoStateT, video: HTMLVideoElement) => void
  ): void {
    this.videoStates.forEach(callback);
  }

  updateTimelineHeight(
    height: number,
    unit: 'px' | '%',
    position: 'top' | 'bottom'
  ): void {
    this.videoStates.forEach((state) => {
      if (state.timeline) {
        const heightValue = unit === '%' ? `${height}%` : `${height}px`;
        state.timeline.style.height = heightValue;

        // Update position to account for new height and position setting
        if (position === 'top') {
          state.timeline.style.top = '0px';
        } else {
          state.timeline.style.top = `calc(100% - ${heightValue})`;
        }
      }
    });
  }

  updateTimelinePosition(
    position: 'top' | 'bottom',
    height: number,
    unit: 'px' | '%'
  ): void {
    this.videoStates.forEach((state) => {
      if (state.timeline) {
        const heightValue = unit === '%' ? `${height}%` : `${height}px`;

        // Update position based on timeline position setting
        if (position === 'top') {
          state.timeline.style.top = '0px';
        } else {
          state.timeline.style.top = `calc(100% - ${heightValue})`;
        }
      }
    });
  }

  updateDebugMode(
    debugMode: boolean,
    getDebugColorBackground: () => string,
    getDebugImageBackground: () => string
  ): void {
    this.videoStates.forEach((state) => {
      // Add/remove debug indicator from DOM
      if (debugMode) {
        // Add to DOM if not already there
        if (!state.debugIndicator.parentElement) {
          state.wrapper.appendChild(state.debugIndicator);
        }
      } else {
        // Remove from DOM if present
        if (state.debugIndicator.parentElement) {
          state.debugIndicator.remove();
        }
      }

      // Update debug background pattern on scroll content
      if (state.scrollContent) {
        const currentStyle = state.scrollContent.style.cssText;
        // Remove existing background-image and background-size if they exist
        const styleWithoutDebug = currentStyle
          .replace(/background-image:[^;]*;?/g, '')
          .replace(/background-size:[^;]*;?/g, '');

        // Apply new style with or without debug background
        state.scrollContent.style.cssText = `
          ${styleWithoutDebug}
          height: 100%;
          min-width: 100%;
          background-color: rgb(0 0 0 / 0);
          ${getDebugImageBackground()}
        `;
      }

      // Update debug background color on overlay
      if (state.overlay) {
        const currentOverlayStyle = state.overlay.style.cssText;
        const styleWithoutDebugColor = currentOverlayStyle.replace(
          /background-color:[^;]*;?/g,
          ''
        );

        state.overlay.style.cssText = `
          ${styleWithoutDebugColor}
          width: 100%;
          height: 100%;
          position: absolute;
          left: 0px;
          top: 0px;
          overflow-x: scroll;
          overflow-y: hidden;
          border-radius: inherit;
          scrollbar-width: none;
          -ms-overflow-style: none;
          ${getDebugColorBackground()}
        `;
      }
    });
  }
}

// Shared by the injected player controls and the feature previews.
export const VOLUME_CONTROL_WIDTH_PX = 18;
export const VOLUME_EDGE_GAP_PX = 8;
export const VOLUME_BOTTOM_GAP_PX = 20;
export const VOLUME_CONTROL_HEIGHT_PX = 60;

export const MEDIA_OVERLAY_STYLES = `
        .mfs-seekbar-thumbnail-preview {
          all: initial;
          position: absolute;
          left: 0;
          z-index: 2147483646 !important;
          display: block;
          box-sizing: border-box;
          width: 220px;
          max-width: calc(100% - 16px);
          overflow: visible;
          border: 0;
          background: transparent;
          color: white;
          opacity: 0;
          transform: translateX(-50%) translateY(4px);
          transition: opacity 100ms ease, transform 100ms ease;
          pointer-events: none;
          user-select: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .mfs-seekbar-thumbnail-preview[data-mfs-visible="true"] {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        .mfs-thumbnail-frame {
          position: relative;
          display: none;
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          box-sizing: border-box;
          border: 1px solid rgb(255 255 255 / 0.14);
          border-radius: 8px;
          background: black;
          box-shadow: 0 5px 18px rgb(0 0 0 / 0.38);
        }

        .mfs-seekbar-thumbnail-preview[data-mfs-image-visible="true"] .mfs-thumbnail-frame {
          display: block;
        }

        .mfs-thumbnail-image,
        .mfs-thumbnail-video {
          position: absolute;
          inset: 0;
          display: block;
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          border: 0;
          background-color: black;
          background-repeat: no-repeat;
          object-fit: cover;
        }

        .mfs-thumbnail-image[hidden],
        .mfs-thumbnail-video[hidden],
        .mfs-thumbnail-loader {
          display: none !important;
        }

        .mfs-thumbnail-copy {
          display: flex;
          box-sizing: border-box;
          width: fit-content;
          max-width: 100%;
          min-width: 0;
          align-items: center;
          gap: 8px;
          margin: 0 auto;
          padding: 6px 12px;
          overflow: hidden;
          border-radius: 9999px;
          background: rgb(15 23 42 / 0.68);
          box-shadow: 0 3px 12px rgb(0 0 0 / 0.28);
          backdrop-filter: blur(10px) saturate(1.2);
          -webkit-backdrop-filter: blur(10px) saturate(1.2);
          font-size: 11px;
          line-height: 14px;
        }

        .mfs-seekbar-thumbnail-preview[data-mfs-image-visible="true"] .mfs-thumbnail-copy {
          margin-top: 7px;
        }

        .mfs-thumbnail-time {
          display: inline-flex;
          flex: none;
          align-items: center;
          color: rgb(255 255 255 / 0.78);
          font-variant-numeric: tabular-nums;
          font-weight: 400;
        }

        .mfs-thumbnail-time-number {
          display: inline-block;
          --number-flow-mask-height: 0.15em;
          --number-flow-mask-width: 0.25em;
          line-height: 1;
        }

        .mfs-thumbnail-time-symbol {
          display: inline-block;
        }

        .mfs-thumbnail-chapter-stage {
          position: relative;
          display: block;
          flex: 0 1 auto;
          width: 0;
          min-width: 0;
          height: 14px;
          overflow: hidden;
          transition: width 180ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .mfs-thumbnail-chapter-stage[hidden] {
          display: none !important;
        }

        .mfs-thumbnail-chapter,
        .mfs-thumbnail-chapter-outgoing {
          position: absolute;
          inset: 0;
          display: block;
          min-width: 0;
          overflow: hidden;
          color: white;
          font-weight: 500;
          white-space: nowrap;
          text-overflow: ellipsis;
          transform-origin: left center;
          transition: opacity 160ms ease, filter 180ms ease,
            transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .mfs-thumbnail-chapter[data-mfs-state="entering"],
        .mfs-thumbnail-chapter-outgoing[data-mfs-state="idle"],
        .mfs-thumbnail-chapter-outgoing[data-mfs-state="leaving"] {
          opacity: 0;
          filter: blur(5px);
          transform: scale(0.96);
        }

        .mfs-thumbnail-chapter[data-mfs-state="visible"],
        .mfs-thumbnail-chapter-outgoing[data-mfs-state="visible"] {
          opacity: 1;
          filter: blur(0);
          transform: scale(1);
        }

        .mfs-thumbnail-chapter-measure {
          position: absolute;
          width: max-content;
          visibility: hidden;
          font-weight: 500;
          white-space: nowrap;
        }

        @media (prefers-reduced-motion: reduce) {
          .mfs-seekbar-thumbnail-preview {
            transition: none;
          }

          .mfs-thumbnail-chapter-stage,
          .mfs-thumbnail-chapter,
          .mfs-thumbnail-chapter-outgoing {
            transition: none;
          }
        }

        .mfs-media-controls {
          all: initial;
          width: ${VOLUME_CONTROL_WIDTH_PX}px;
          height: min(${VOLUME_CONTROL_HEIGHT_PX}px, calc(100% - 16px));
          position: absolute;
          right: ${VOLUME_EDGE_GAP_PX}px;
          top: auto;
          bottom: ${VOLUME_BOTTOM_GAP_PX}px;
          z-index: 2147483647 !important;
          display: block;
          box-sizing: border-box;
          overflow: hidden;
          border: 0;
          border-radius: 999px;
          background: rgb(255 255 255 / 0.28);
          color: white;
          box-shadow: none;
          visibility: hidden;
          opacity: 0;
          transform: none;
          transition: opacity 140ms ease, transform 140ms ease;
          -webkit-backdrop-filter: blur(6px) saturate(130%);
          backdrop-filter: blur(6px) saturate(130%);
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .mfs-media-controls[hidden] {
          display: none !important;
        }

        .mfs-media-controls[data-mfs-active="true"][data-mfs-video-hovered="true"] {
          visibility: visible;
          opacity: 0.3;
          pointer-events: auto;
        }

        .mfs-media-controls[data-mfs-active="true"][data-mfs-visible="true"],
        .mfs-media-controls[data-mfs-active="true"][data-mfs-interacting="true"],
        .mfs-media-controls[data-mfs-active="true"]:hover,
        .mfs-media-controls[data-mfs-active="true"]:focus-within {
          visibility: visible;
          opacity: 1;
          transform: none;
          pointer-events: auto !important;
        }

        .mfs-volume-pill {
          all: unset;
          width: 100%;
          height: 100%;
          position: relative;
          display: block;
          box-sizing: border-box;
          overflow: hidden;
          border-radius: inherit;
          color: inherit;
          cursor: pointer;
          touch-action: none;
          user-select: none;
        }

        .mfs-volume-pill::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 2;
          border-radius: inherit;
        }

        .mfs-volume-pill:focus-visible {
          outline: 2px solid white;
          outline-offset: -4px;
        }

        .mfs-volume-pill[data-mfs-dragging="true"] {
          cursor: ns-resize;
        }

        .mfs-volume-fill {
          width: 100%;
          height: var(--mfs-volume, 100%);
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 0;
          background: rgb(255 255 255 / 0.42);
          border-radius: 0;
          box-shadow: none;
          transition: height 120ms ease-out;
          -webkit-backdrop-filter: blur(6px) saturate(130%);
          backdrop-filter: blur(6px) saturate(130%);
          pointer-events: none;
        }

        .mfs-volume-pill[data-mfs-dragging="true"] .mfs-volume-fill {
          transition: none;
        }

        .mfs-volume-mute {
          all: unset;
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: ${VOLUME_CONTROL_WIDTH_PX}px;
          z-index: 4;
          cursor: pointer;
          border-radius: 50%;
        }

        .mfs-volume-mute:focus-visible {
          outline: 2px solid white;
          outline-offset: -2px;
        }

        .mfs-volume-icon {
          width: 14px;
          height: 14px;
          position: absolute;
          left: 50%;
          bottom: ${(VOLUME_CONTROL_WIDTH_PX - 14) / 2}px;
          z-index: 3;
          display: block;
          color: rgb(60 60 60);
          filter: none;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .mfs-volume-icon path {
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .mfs-volume-icon-speaker {
          fill: currentColor !important;
          stroke: none !important;
        }
        .mfs-volume-icon-wave,
        .mfs-volume-icon-muted {
          opacity: 0;
          transform: scaleX(0.35);
          transform-box: fill-box;
          transform-origin: left center;
          transition:
            opacity 140ms ease,
            transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .mfs-media-controls[data-mfs-volume-level="low"] .mfs-volume-icon-wave-one,
        .mfs-media-controls[data-mfs-volume-level="medium"] .mfs-volume-icon-wave-one,
        .mfs-media-controls[data-mfs-volume-level="medium"] .mfs-volume-icon-wave-two,
        .mfs-media-controls[data-mfs-volume-level="high"] .mfs-volume-icon-wave {
          opacity: 1;
          transform: scaleX(1);
        }

        .mfs-volume-icon-muted {
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          transform: none;
          transition:
            opacity 100ms ease,
            stroke-dashoffset 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .mfs-media-controls[data-mfs-volume-level="muted"] .mfs-volume-icon-muted {
          opacity: 1;
          stroke-dashoffset: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          .mfs-volume-icon-wave,
          .mfs-volume-icon-muted {
            transition: none;
          }
        }

`;

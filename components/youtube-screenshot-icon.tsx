import { createElement, type SVGProps } from 'react';
import { YOUTUBE_CONTROL_ICONS } from '@/helpers/youtube-control-icons';

export function YouTubeScreenshotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.6"
      viewBox="0 0 24 20"
      width="24"
      {...props}
    >
      {YOUTUBE_CONTROL_ICONS.screenshot.map((shape, index) =>
        createElement(shape.tag, { ...shape.attributes, key: index })
      )}
    </svg>
  );
}

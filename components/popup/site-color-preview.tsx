import { useId } from 'react';

export const SITE_COLOR_EXAMPLES = [
  { name: 'YouTube', color: '#ff0000' },
  { name: 'Vimeo', color: '#1ab7ea' },
  { name: 'Instagram', color: '#e1306c' },
  { name: 'TikTok', color: '#25f4ee' },
] as const;

export function SiteColorPreview({ index }: { index: number }) {
  const site = SITE_COLOR_EXAMPLES[index] ?? SITE_COLOR_EXAMPLES[0];
  const gradientId = useId();
  return (
    <div className="absolute right-2 bottom-6 flex items-center gap-1.5 rounded-lg bg-black/45 px-2 py-1.5 font-medium text-[10px] text-white backdrop-blur-md">
      <span
        className="feature-preview-site-badge flex items-center gap-1.5"
        key={site.name}
      >
        <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24">
          {site.name === 'YouTube' && (
            <>
              <rect
                fill={site.color}
                height="16"
                rx="5"
                width="22"
                x="1"
                y="4"
              />
              <path d="m10 8 6 4-6 4Z" fill="white" />
            </>
          )}
          {site.name === 'Vimeo' && (
            <path
              d="M23.98 6.416c-.106 2.338-1.74 5.54-4.894 9.607-3.268 4.248-6.033 6.372-8.295 6.372-1.401 0-2.587-1.294-3.556-3.882-.647-2.373-1.294-4.745-1.941-7.118-.719-2.588-1.49-3.882-2.318-3.882-.18 0-.808.378-1.887 1.133L0 7.188a315.065 315.065 0 0 0 3.511-3.13C5.094 2.69 6.282 1.97 7.074 1.9c1.871-.18 3.023 1.096 3.455 3.827.468 2.947.791 4.779.972 5.496.539 2.443 1.133 3.664 1.781 3.664.503 0 1.259-.792 2.267-2.377 1.007-1.584 1.547-2.79 1.619-3.618.144-1.368-.396-2.052-1.619-2.052-.576 0-1.17.132-1.781.394 1.183-3.875 3.442-5.758 6.777-5.65 2.473.072 3.635 1.682 3.485 4.832Z"
              fill={site.color}
            />
          )}
          {site.name === 'Instagram' && (
            <>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="1" y1="1" y2="0">
                  <stop stopColor="#ffdc80" />
                  <stop offset=".5" stopColor="#e1306c" />
                  <stop offset="1" stopColor="#833ab4" />
                </linearGradient>
              </defs>
              <rect
                fill={`url(#${gradientId})`}
                height="22"
                rx="6"
                width="22"
                x="1"
                y="1"
              />
              <rect
                fill="none"
                height="14"
                rx="4"
                stroke="white"
                strokeWidth="1.7"
                width="14"
                x="5"
                y="5"
              />
              <circle
                cx="12"
                cy="12"
                fill="none"
                r="3.4"
                stroke="white"
                strokeWidth="1.7"
              />
              <circle cx="17" cy="7" fill="white" r="1" />
            </>
          )}
          {site.name === 'TikTok' && (
            <>
              <path
                d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 7 6"
                fill="none"
                stroke="#25f4ee"
                strokeWidth="3"
                transform="translate(-1 -1)"
              />
              <path
                d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 7 6"
                fill="none"
                stroke="#fe2c55"
                strokeWidth="3"
                transform="translate(1 1)"
              />
              <path
                d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 7 6"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
            </>
          )}
        </svg>
        <span>{site.name}</span>
      </span>
    </div>
  );
}

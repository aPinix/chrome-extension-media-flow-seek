import { GlobeIcon } from 'lucide-react';

import { getSiteRuleHostname } from '@/helpers/domains';
import { cn } from '@/lib/utils';

interface DomainFaviconPropsI {
  className?: string;
  domain?: string;
}

export function DomainFavicon({ className, domain }: DomainFaviconPropsI) {
  const hostname = domain ? getSiteRuleHostname(domain) : null;

  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center overflow-hidden text-slate-400 dark:text-slate-500',
        className
      )}
    >
      {hostname ? (
        <>
          <img
            alt=""
            className="size-4 object-contain"
            key={hostname}
            onError={(event) => {
              event.currentTarget.classList.add('hidden');
              event.currentTarget.nextElementSibling?.classList.remove(
                'hidden'
              );
            }}
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`}
          />
          <GlobeIcon aria-hidden="true" className="hidden size-3.5" />
        </>
      ) : (
        <GlobeIcon aria-hidden="true" className="size-3.5" />
      )}
    </span>
  );
}

import { AppKbd } from '@/components/app/app-kbd';

export function MinimalPlayerDescription() {
  return (
    <span>
      Hold <AppKbd aria-label="Shift key">Shift</AppKbd> to use the site's
      original controls
    </span>
  );
}

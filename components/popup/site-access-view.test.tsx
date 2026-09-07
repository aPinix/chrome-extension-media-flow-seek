// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDomainRule } from '@/helpers/domains';
import type { DomainConfigT, DomainSortT } from '@/types/domains';
import { DomainModeE, DomainSortE } from '@/types/domains';

import { SiteAccessView } from './site-access-view';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

const INITIAL_RULES: DomainConfigT[] = [
  createDomainRule('*', DomainModeE.On),
  createDomainRule('youtube.com'),
  createDomainRule('vimeo.com', DomainModeE.Off),
  createDomainRule('twitch.tv', DomainModeE.On),
];

function SiteAccessHarness({
  currentDomain = 'youtube.com',
  initialRules = INITIAL_RULES,
  initialSort = DomainSortE.Custom,
  isActive = true,
}: {
  currentDomain?: string;
  initialRules?: DomainConfigT[];
  initialSort?: DomainSortT;
  isActive?: boolean;
}) {
  const [rules, setRules] = useState(initialRules);
  const [sort, setSort] = useState<DomainSortT>(initialSort);
  return (
    <>
      <div id="domain-toolbar-root" />
      <SiteAccessView
        currentDomain={currentDomain}
        domainRules={rules}
        domainSort={sort}
        isActive={isActive}
        onDomainRulesChange={setRules}
        onDomainSortChange={setSort}
      />
      <output data-testid="rules">{JSON.stringify(rules)}</output>
      <output data-testid="sort">{sort}</output>
    </>
  );
}

const readRules = () =>
  JSON.parse(
    screen.getByTestId('rules').textContent ?? '[]'
  ) as DomainConfigT[];

describe('SiteAccessView', () => {
  it('shows the creation date below every saved domain', () => {
    const createdAt = Date.UTC(2026, 8, 3, 12);
    const expectedDate = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(createdAt);

    render(
      <SiteAccessHarness
        initialRules={[
          createDomainRule('*', DomainModeE.On),
          createDomainRule('dated.example', DomainModeE.On, createdAt),
          createDomainRule('legacy.example', DomainModeE.Off),
        ]}
      />
    );

    const datedRow = document.querySelector('[data-domain="dated.example"]');
    const legacyRow = document.querySelector('[data-domain="legacy.example"]');
    const date = within(datedRow as HTMLElement).getByText(
      `Created ${expectedDate}`
    );

    expect(date.tagName).toBe('TIME');
    expect(date.getAttribute('datetime')).toBe(
      new Date(createdAt).toISOString()
    );
    expect(
      within(legacyRow as HTMLElement).getByText('Created previously')
    ).toBeTruthy();
  });

  it('lets horizontal swipe gestures reach the parent tab carousel', () => {
    render(<SiteAccessHarness />);

    const scrollContainer = screen.getByTestId('site-access-scroll-container');
    const classNames = scrollContainer.className.split(/\s+/);

    expect(classNames).toContain('overscroll-y-contain');
    expect(classNames).not.toContain('overscroll-contain');
    expect(classNames).not.toContain('gap-6');
    expect(classNames).not.toContain('pt-34');
    expect(screen.getByTestId('site-access-intro').className).toContain(
      'pt-22'
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Domains' })
    ).toBeTruthy();
    expect(screen.getByText('Choose where BetterVideo runs')).toBeTruthy();
  });

  it('puts history after the website settings title and search in the bottom toolbar', () => {
    render(<SiteAccessHarness />);

    const controls = screen.getByTestId('domain-bottom-toolbar');
    const classNames = controls.className.split(/\s+/);

    expect(classNames).toContain('h-12');
    expect(classNames).toContain('items-center');
    const heading = screen.getByRole('heading', { name: 'Website settings' });
    const history = screen.getByRole('toolbar', {
      name: 'Website settings history',
    });
    expect(heading.parentElement?.parentElement?.contains(history)).toBe(true);
    expect(
      within(history).getByRole('button', {
        name: 'Undo website removal',
      })
    ).toBeTruthy();
    expect(
      within(history).getByRole('button', {
        name: 'Redo website removal',
      })
    ).toBeTruthy();
    const addButton = within(controls).getByRole('button', {
      name: 'Add website',
    });
    const search = within(controls).getByRole('searchbox', {
      name: 'Search website settings',
    });
    expect(addButton.className).toContain('bg-lime-400');
    expect(addButton.className).toContain('text-lime-950');
    expect(addButton.className).toContain('shadow-sm');
    expect(addButton.querySelector('svg')?.classList).toContain('lucide-plus');
    expect(addButton.textContent).toBe('');
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    expect(search.className).toContain('h-10');
    expect(search.parentElement).toBe(addButton.parentElement);
    expect(controls.querySelector('.lucide-search')).toBeTruthy();
    const sortButton = screen.getByRole('button', {
      name: 'Sort website settings: Custom order',
    });
    expect(sortButton.querySelector('svg')?.classList).toContain(
      'lucide-list-restart'
    );
  });

  it('focuses the search input whenever the Domains view becomes active', async () => {
    const { rerender } = render(<SiteAccessHarness isActive={false} />);
    const searchInput = screen.getByRole('searchbox', {
      name: 'Search website settings',
    });

    expect(document.activeElement).not.toBe(searchInput);

    rerender(<SiteAccessHarness isActive />);

    await waitFor(() => expect(document.activeElement).toBe(searchInput));
  });

  it('synchronizes the current-site and saved-row controls', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const currentControl = screen.getByRole('group', {
      name: 'Access for current website youtube.com',
    });
    const onMode = within(currentControl).getByRole('radio', { name: 'On' });
    const offMode = within(currentControl).getByRole('radio', { name: 'Off' });

    expect(onMode.closest('label')?.querySelector('svg')?.classList).toContain(
      'lucide-check-check'
    );
    expect(offMode.closest('label')?.querySelector('svg')?.classList).toContain(
      'lucide-ban'
    );

    await user.click(onMode);

    const savedControl = screen.getByRole('group', {
      name: 'Access for youtube.com',
    });
    expect(
      (
        within(currentControl).getByRole('radio', {
          name: 'On',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
    expect(
      (
        within(savedControl).getByRole('radio', {
          name: 'On',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it('keeps a fixed mode and delete column for every saved website row', () => {
    render(<SiteAccessHarness />);

    const deleteButton = screen.getByRole('button', {
      name: 'Delete youtube.com',
    });
    const row = deleteButton.closest('li');
    const dragPreview = document.querySelector<HTMLElement>(
      '[data-domain-drag-preview="youtube.com"]'
    );
    const modeControl = screen.getByRole('group', {
      name: 'Access for youtube.com',
    });

    expect(row?.className).toContain(
      'grid-cols-[20px_24px_minmax(0,1fr)_80px_28px]'
    );
    expect(row?.className).toContain('rounded-none');
    expect(dragPreview?.parentElement).toBe(document.body);
    expect(dragPreview?.style.borderRadius).toBe('0px');
    expect(row?.className).toContain('hover:bg-slate-50/70');
    expect(row?.className).toContain('dark:hover:bg-slate-700/20');
    expect(modeControl.className).toContain('w-20');
    expect(deleteButton.className).toContain('opacity-40');
    expect(deleteButton.className).toContain('hover:text-red-600');
    expect(deleteButton.className).not.toContain('group-hover/domain-row');
    expect(deleteButton.className).not.toContain('absolute');
    expect(deleteButton.className.split(/\s+/)).not.toContain(
      'pointer-events-none'
    );
  });

  it('uses the lime add action and creates the row immediately', async () => {
    const user = userEvent.setup();
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    render(<SiteAccessHarness />);

    const currentSiteAdd = screen.getByRole('button', {
      name: 'Show youtube.com in website settings',
    });
    expect(currentSiteAdd.querySelector('svg')?.classList).toContain(
      'lucide-crosshair'
    );
    expect(currentSiteAdd.querySelector('svg')?.classList).toContain('size-4');

    const search = screen.getByRole('searchbox', {
      name: 'Search website settings',
    }) as HTMLInputElement;
    const add = screen.getByRole('button', { name: 'Add website' });
    await user.type(search, 'example.org');
    expect(add.className).toContain('bg-lime-400');
    await user.click(add);

    expect(search.value).toBe('');
    expect(screen.queryByPlaceholderText('example.com')).toBeNull();
    expect(readRules()[1]?.domain).toBe('example.org');
    expect(typeof readRules()[1]?.createdAt).toBe('number');
    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      })
    );
  });

  it('adds from Enter using the same inline search flow', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness initialSort={DomainSortE.Custom} />);
    const search = screen.getByRole('searchbox', {
      name: 'Search website settings',
    });

    await user.type(search, 'enter.example{Enter}');

    expect(readRules()[1]?.domain).toBe('enter.example');
    expect(
      screen
        .getByRole('list', { name: 'Saved website settings' })
        .querySelector<HTMLElement>('[data-domain]')?.dataset.domain
    ).toBe('enter.example');
    expect((search as HTMLInputElement).value).toBe('');
  });

  it('mutes domain suffixes and edits a saved domain from its favicon', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const editDomain = screen.getByRole('button', {
      name: 'Edit youtube.com',
    });
    const currentDomainControl = screen.getByRole('group', {
      name: 'Access for current website youtube.com',
    });
    const currentDomainRow =
      currentDomainControl.closest<HTMLElement>('.card-list-item');
    const domainRow = editDomain.closest('li');
    if (!currentDomainRow) throw new Error('Expected the current domain row');
    if (!domainRow) throw new Error('Expected a saved domain row');
    expect(within(currentDomainRow).getByText('.com').className).toContain(
      'text-muted-foreground'
    );
    expect(within(domainRow).getByText('.com').className).toContain(
      'text-muted-foreground'
    );
    expect(editDomain.className).toContain('absolute');
    expect(editDomain.className).toContain('cursor-pointer');
    expect(editDomain.className).toContain(
      'group-hover/domain-edit:opacity-100'
    );
    expect(editDomain.className).toContain('rounded-full');
    expect(editDomain.className).toContain('bg-sky-500/15');
    expect(editDomain.className).toContain('text-sky-500');
    expect(editDomain.className).toContain('hover:scale-105');
    expect(editDomain.querySelector('svg')?.classList).toContain(
      'lucide-settings-2'
    );

    await user.hover(editDomain);
    expect(await screen.findByText('Edit youtube.com')).toBeTruthy();

    await user.click(editDomain);
    const input = screen.getByRole('textbox', {
      name: 'Domain name for youtube.com',
    });
    expect((input as HTMLInputElement).value).toBe('youtube.com');
    await user.clear(input);
    await user.type(
      input,
      'https://example.net/channel///?autoplay=1??source=popup{Enter}'
    );

    await waitFor(() =>
      expect(
        readRules().some(({ domain }) => domain === 'example.net/channel')
      ).toBe(true)
    );
    expect(readRules().some(({ domain }) => domain === 'youtube.com')).toBe(
      false
    );
  });

  it('starts editing when the saved domain text is double-clicked', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const domainText = screen.getByRole('button', {
      name: 'Domain youtube.com. Double-click to edit.',
    });

    await user.click(domainText);
    expect(
      screen.queryByRole('textbox', {
        name: 'Domain name for youtube.com',
      })
    ).toBeNull();

    await user.dblClick(domainText);
    const input = await screen.findByRole('textbox', {
      name: 'Domain name for youtube.com',
    });

    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe('youtube.com');
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe('youtube.com'.length);
  });

  it('animates removal and keeps persistent undo and redo controls', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness currentDomain="example.com" />);

    const undoButton = screen.getByRole('button', {
      name: 'Undo website removal',
    }) as HTMLButtonElement;
    const redoButton = screen.getByRole('button', {
      name: 'Redo website removal',
    }) as HTMLButtonElement;
    expect(undoButton.disabled).toBe(true);
    expect(redoButton.disabled).toBe(true);
    for (const historyButton of [undoButton, redoButton]) {
      expect(historyButton.className).toContain('size-5');
      expect(historyButton.className).toContain('disabled:bg-slate-300');
      expect(historyButton.className).toContain('disabled:text-slate-500');
      expect(historyButton.className).toContain('dark:disabled:bg-slate-700');
      expect(historyButton.className).toContain('dark:disabled:text-slate-400');
      expect(historyButton.getAttribute('title')).toBeNull();
      expect(historyButton.parentElement?.tabIndex).toBe(0);
    }

    await user.hover(undoButton.parentElement as HTMLElement);
    expect((await screen.findByText('Undo')).parentElement?.textContent).toBe(
      'Undo last website removal'
    );
    await user.unhover(undoButton.parentElement as HTMLElement);
    await user.hover(redoButton.parentElement as HTMLElement);
    expect((await screen.findByText('Redo')).parentElement?.textContent).toBe(
      'Redo last website removal'
    );

    const currentControl = screen.getByRole('group', {
      name: 'Access for current website example.com',
    });
    await user.click(
      within(currentControl).getByRole('radio', { name: 'Off' })
    );

    expect(
      readRules()
        .map(({ domain }) => domain)
        .slice(0, 3)
    ).toEqual(['*', 'example.com', 'youtube.com']);

    const deleteButton = screen.getByRole('button', {
      name: 'Delete example.com',
    });
    const deletedRow = deleteButton.closest('li');
    await user.click(deleteButton);
    expect(deletedRow?.getAttribute('data-removing')).toBe('true');
    expect(readRules()[1]?.domain).toBe('example.com');

    await waitFor(() => expect(readRules()[1]?.domain).toBe('youtube.com'));
    expect(
      (
        within(
          screen.getByRole('group', {
            name: 'Access for current website example.com',
          })
        ).getByRole('radio', { name: 'Default' }) as HTMLInputElement
      ).checked
    ).toBe(true);
    expect(undoButton.disabled).toBe(false);
    expect(redoButton.disabled).toBe(true);

    await user.click(undoButton);
    expect(readRules()[1]?.domain).toBe('example.com');
    expect(undoButton.disabled).toBe(true);
    expect(redoButton.disabled).toBe(false);

    await user.click(redoButton);
    expect(
      within(screen.getByRole('list', { name: 'Saved website settings' }))
        .getByRole('button', { hidden: true, name: 'Delete example.com' })
        .closest('li')
        ?.getAttribute('data-removing')
    ).toBe('true');
    await waitFor(() => expect(readRules()[1]?.domain).toBe('youtube.com'));

    await user.click(undoButton);
    expect(readRules()[1]?.domain).toBe('example.com');
    expect(
      (
        within(
          screen.getByRole('group', {
            name: 'Access for current website example.com',
          })
        ).getByRole('radio', { name: 'Off' }) as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it('adds the current site from the header plus button', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness currentDomain="example.com" />);

    await user.click(
      screen.getByRole('button', {
        name: 'Add example.com to website settings',
      })
    );

    expect(
      readRules()
        .map(({ domain }) => domain)
        .slice(0, 3)
    ).toEqual(['*', 'example.com', 'youtube.com']);
    expect(
      screen.getByRole('button', {
        name: 'Show example.com in website settings',
      })
    ).toBeTruthy();
  });

  it('reveals an existing current website from the plus button', async () => {
    const user = userEvent.setup();
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    render(<SiteAccessHarness />);

    const existingButton = screen.getByRole('button', {
      name: 'Show youtube.com in website settings',
    });

    await user.hover(existingButton);
    expect(await screen.findByText('Already exists')).toBeTruthy();
    await user.click(existingButton);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('enables Add for a valid unsaved URL and creates it directly', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const addButton = screen.getByRole('button', { name: /Add website/i });
    const search = screen.getByRole('searchbox', {
      name: 'Search website settings',
    });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);

    await user.type(search, 'chrome://settings');
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    await user.clear(search);
    const toolbar = screen.getByTestId('domain-bottom-toolbar');
    await user.type(
      search,
      'https://store.steampowered.com/app/2399420/Le_Mans_Ultimate////?utm_source=popup??autoplay=1'
    );
    expect((addButton as HTMLButtonElement).disabled).toBe(false);
    expect(toolbar.querySelector('.lucide-search')).toBeNull();
    expect(
      toolbar
        .querySelector('img')
        ?.getAttribute('src')
        ?.includes('store.steampowered.com')
    ).toBe(true);
    await user.hover(addButton);
    expect(
      await screen.findByText(
        'Add domain: store.steampowered.com/app/2399420/Le_Mans_Ultimate'
      )
    ).toBeTruthy();
    await user.click(addButton);
    expect(readRules()[1]?.domain).toBe(
      'store.steampowered.com/app/2399420/Le_Mans_Ultimate'
    );
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.queryByPlaceholderText('example.com')).toBeNull();
    await user.type(
      search,
      'https://store.steampowered.com/app/2399420/Le_Mans_Ultimate/?another=query'
    );
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    expect(
      readRules().filter(
        ({ domain }) =>
          domain === 'store.steampowered.com/app/2399420/Le_Mans_Ultimate'
      )
    ).toHaveLength(1);
  });

  it('keeps invalid Enter submissions in the search field', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const addButton = screen.getByRole('button', { name: /Add website/i });
    const search = screen.getByRole('searchbox', {
      name: 'Search website settings',
    });
    const rulesBefore = readRules();
    await user.type(search, 'chrome://settings{Enter}');

    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    expect((search as HTMLInputElement).value).toBe('chrome://settings');
    expect(readRules()).toEqual(rulesBefore);
  });

  it('filters saved websites by domain fragments and pasted URLs', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const search = screen.getByRole('searchbox', {
      name: 'Search website settings',
    });
    await user.type(search, 'VIMEO');

    const filteredList = screen.getByRole('list', {
      name: 'Saved website settings',
    });
    expect(
      within(filteredList).getByRole('button', { name: 'Edit vimeo.com' })
    ).toBeTruthy();
    expect(
      within(filteredList).queryByRole('button', { name: 'Edit youtube.com' })
    ).toBeNull();
    expect(
      (
        within(filteredList).getByRole('button', {
          name: /Move vimeo\.com/,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);

    await user.clear(search);
    await user.type(search, 'https://www.twitch.tv/videos/123');
    expect(
      screen.getByRole('list', { name: 'Saved website settings' }).textContent
    ).toContain('twitch.tv');

    await user.clear(search);
    await user.type(search, 'not-saved.example');
    expect(screen.getByText('No matching websites')).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'Clear website search' })
    );
    expect(
      within(
        screen.getByRole('list', { name: 'Saved website settings' })
      ).getAllByRole('listitem')
    ).toHaveLength(3);
  });

  it('sorts by website or creation date and inserts at the sorted position', async () => {
    const user = userEvent.setup();
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    render(<SiteAccessHarness initialSort={DomainSortE.DomainAscending} />);

    const getVisibleDomains = () =>
      Array.from(
        screen
          .getByRole('list', { name: 'Saved website settings' })
          .querySelectorAll<HTMLElement>('[data-domain]')
      ).map(({ dataset }) => dataset.domain);

    expect(
      screen
        .getByRole('button', {
          name: 'Sort website settings: Website · Ascending',
        })
        .querySelector('svg')?.classList
    ).toContain('lucide-arrow-down-a-z');
    expect(getVisibleDomains()).toEqual([
      'twitch.tv',
      'vimeo.com',
      'youtube.com',
    ]);

    const search = screen.getByRole('searchbox', {
      name: 'Search website settings',
    });
    await user.type(search, 'alpha.example{Enter}');

    expect(getVisibleDomains()).toEqual([
      'alpha.example',
      'twitch.tv',
      'vimeo.com',
      'youtube.com',
    ]);
    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      })
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Sort website settings: Website · Ascending',
      })
    );
    const websiteDescending = await screen.findByRole('button', {
      name: 'Website · Descending',
    });
    const dateAscending = screen.getByRole('button', {
      name: 'Date added · Ascending',
    });
    const dateDescending = screen.getByRole('button', {
      name: 'Date added · Descending',
    });
    const customOrder = screen.getByRole('button', {
      name: 'Custom order',
    });
    expect(websiteDescending.querySelector('svg')?.classList).toContain(
      'lucide-arrow-up-a-z'
    );
    expect(dateAscending.querySelector('svg')?.classList).toContain(
      'lucide-list-sort-ascending'
    );
    expect(dateDescending.querySelector('svg')?.classList).toContain(
      'lucide-arrow-up-a-z'
    );
    expect(customOrder.querySelector('svg')?.classList).toContain(
      'lucide-list-restart'
    );
    await user.click(dateDescending);
    expect(getVisibleDomains()[0]).toBe('alpha.example');
    expect(
      screen
        .getByRole('button', {
          name: 'Sort website settings: Date added · Descending',
        })
        .querySelector('svg')?.classList
    ).toContain('lucide-arrow-up-a-z');
  });

  it('disables reordering outside Custom and preserves the saved custom order', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness initialSort={DomainSortE.DomainAscending} />);

    const initialRules = readRules();
    const moveTwitch = screen.getByRole('button', {
      name: /Move twitch\.tv/,
    }) as HTMLButtonElement;
    const twitchRow = moveTwitch.closest('li');

    expect(moveTwitch.disabled).toBe(true);
    expect(moveTwitch.dataset.dragHandleVisible).toBe('false');
    expect(moveTwitch.className).toContain('-translate-x-3');
    expect(moveTwitch.className).toContain('opacity-0');
    expect(twitchRow?.className).toContain('grid-cols-[0px_24px_');

    fireEvent.keyDown(moveTwitch, { altKey: true, key: 'ArrowDown' });

    expect(screen.getByTestId('sort').textContent).toBe(
      DomainSortE.DomainAscending
    );
    expect(readRules()).toEqual(initialRules);

    await user.click(
      screen.getByRole('button', {
        name: 'Sort website settings: Website · Ascending',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Custom order' }));

    expect(moveTwitch.disabled).toBe(false);
    expect(moveTwitch.dataset.dragHandleVisible).toBe('true');
    expect(moveTwitch.className).toContain('translate-x-0');
    expect(moveTwitch.className).not.toContain('opacity-0');
    expect(twitchRow?.className).toContain('grid-cols-[20px_24px_');
    expect(
      Array.from(
        screen
          .getByRole('list', { name: 'Saved website settings' })
          .querySelectorAll<HTMLElement>('[data-domain]')
      ).map(({ dataset }) => dataset.domain)
    ).toEqual(['youtube.com', 'vimeo.com', 'twitch.tv']);
  });

  it('reorders immediately with Alt+Arrow and announces the new position', () => {
    render(<SiteAccessHarness initialSort={DomainSortE.Custom} />);

    const moveYoutube = screen.getByRole('button', {
      name: /Move youtube\.com/,
    }) as HTMLButtonElement;
    const youtubeRow = moveYoutube.closest('li');

    expect(moveYoutube.disabled).toBe(false);
    expect(moveYoutube.className).toContain('cursor-grab');
    expect(moveYoutube.draggable).toBe(false);
    expect(youtubeRow?.draggable).toBe(true);

    fireEvent.keyDown(moveYoutube, { altKey: true, key: 'ArrowDown' });

    expect(
      readRules()
        .map(({ domain }) => domain)
        .slice(1)
    ).toEqual(['vimeo.com', 'youtube.com', 'twitch.tv']);
    expect(
      screen.getByText(/youtube\.com moved to position 2 of 3/i)
    ).toBeTruthy();
  });

  it('changes only the wildcard when the global default is toggled', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);
    const before = readRules().slice(1);
    const globalDefaultIcon = screen.getByTestId('global-default-icon');
    const globalDefaultSwitch = screen.getByRole('switch', {
      name: 'Run BetterVideo by default on websites',
    });
    const defaultMode = screen.getAllByRole('radio', { name: 'Default' })[0];

    expect(globalDefaultIcon.className).toContain('text-lime-600');
    expect(globalDefaultIcon.className).toContain('transition-colors');
    const globalDefaultTitle = screen.getByText('Run by Default');
    const globalDefaultState = screen.getByTestId('global-default-state');
    expect(globalDefaultTitle.className).toContain('text-slate-900');
    expect(globalDefaultTitle.className).toContain('dark:text-white');
    expect(globalDefaultTitle.className).not.toContain('text-lime-600');
    expect(globalDefaultState.textContent).toBe('Enabled');
    expect(globalDefaultState.className).toContain('font-bold');
    expect(globalDefaultState.className).toContain('text-lime-600');
    expect(globalDefaultState.parentElement?.textContent).toBe(
      'BetterVideo is Enabled by default on websites without a custom setting.'
    );
    expect(defaultMode?.closest('label')?.className).toContain('text-lime-500');
    expect(globalDefaultSwitch.className).toContain('data-checked:bg-lime-500');
    expect(globalDefaultSwitch.className).toContain(
      'data-unchecked:bg-rose-500'
    );

    await user.click(globalDefaultSwitch);

    expect(readRules()[0]?.type).toBe('blacklist');
    expect(readRules().slice(1)).toEqual(before);
    expect(globalDefaultTitle.textContent).toBe('Run by Default');
    expect(globalDefaultState.textContent).toBe('Disabled');
    expect(globalDefaultState.className).toContain('text-rose-600');
    expect(globalDefaultIcon.className).toContain('text-rose-600');
    expect(globalDefaultTitle.className).not.toContain('text-rose-600');
    expect(defaultMode?.closest('label')?.className).toContain('text-rose-500');
    const switchGlobe = globalDefaultSwitch.querySelector('svg');
    expect(switchGlobe?.classList).toContain('text-rose-600');
    expect(switchGlobe?.classList).toContain('transition-colors');
  });

  it('shows the global website default in Default mode tooltips', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);
    const defaultMode = screen.getAllByRole('radio', { name: 'Default' })[0];

    if (!defaultMode) throw new Error('Expected a Default domain mode');

    await user.hover(defaultMode);
    const onState = await screen.findByText(
      (_, element) =>
        element?.tagName === 'STRONG' && element.textContent === 'On'
    );
    expect(onState.tagName).toBe('STRONG');
    expect(onState.parentElement?.textContent).toBe('Default: On');

    await user.unhover(defaultMode);
    await user.click(
      screen.getByRole('switch', {
        name: 'Run BetterVideo by default on websites',
      })
    );
    await user.hover(defaultMode);
    const offState = await screen.findByText(
      (_, element) =>
        element?.tagName === 'STRONG' && element.textContent === 'Off'
    );
    expect(offState.tagName).toBe('STRONG');
    expect(offState.parentElement?.textContent).toBe('Default: Off');
  });
});

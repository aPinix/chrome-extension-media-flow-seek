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
import type { DomainConfigT } from '@/types/domains';
import { DomainModeE } from '@/types/domains';

import { SiteAccessView } from './site-access-view';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
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
}: {
  currentDomain?: string;
  initialRules?: DomainConfigT[];
}) {
  const [rules, setRules] = useState(initialRules);
  return (
    <>
      <SiteAccessView
        currentDomain={currentDomain}
        domainRules={rules}
        onDomainRulesChange={setRules}
      />
      <output data-testid="rules">{JSON.stringify(rules)}</output>
    </>
  );
}

const readRules = () =>
  JSON.parse(
    screen.getByTestId('rules').textContent ?? '[]'
  ) as DomainConfigT[];

describe('SiteAccessView', () => {
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

  it('keeps the website settings actions and search in one sticky block', () => {
    render(<SiteAccessHarness />);

    const controls = screen.getByTestId('website-settings-sticky-controls');
    const classNames = controls.className.split(/\s+/);

    expect(classNames).toContain('sticky');
    expect(classNames).toContain('top-[48px]');
    expect(classNames).toContain('pt-6');
    expect(classNames).toContain('z-20');
    expect(classNames).toContain('backdrop-blur-xl');
    expect(classNames).toContain('rounded-b-xl');
    expect(classNames).not.toContain('border-b');
    expect(controls.dataset.sticky).toBe('false');
    expect(classNames).toContain('-mx-2');
    expect(classNames).toContain('px-2');
    expect(
      within(controls).getByRole('heading', { name: 'Website settings' })
    ).toBeTruthy();
    expect(
      within(controls).getByRole('button', {
        name: 'Undo website removal',
      })
    ).toBeTruthy();
    expect(
      within(controls).getByRole('button', {
        name: 'Redo website removal',
      })
    ).toBeTruthy();
    expect(
      within(controls).getByRole('button', { name: 'Add website' })
    ).toBeTruthy();
    expect(
      within(controls).getByRole('searchbox', {
        name: 'Search website settings',
      })
    ).toBeTruthy();
  });

  it('synchronizes the current-site and saved-row controls', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const currentControl = screen.getByRole('group', {
      name: 'Access for current website youtube.com',
    });
    await user.click(within(currentControl).getByRole('radio', { name: 'On' }));

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

  it('uses prominent colored add and editor actions', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const currentSiteAdd = screen.getByRole('button', {
      name: 'youtube.com is already in website settings',
    });
    expect(currentSiteAdd.querySelector('svg')?.classList).toContain('size-5');

    await user.click(screen.getByRole('button', { name: 'Add website' }));
    const discard = await screen.findByRole('button', {
      name: 'Discard website',
    });
    const create = await screen.findByRole('button', {
      name: 'Create website',
    });

    expect(discard.className).toContain('size-5');
    expect(discard.className).toContain('rounded-md');
    expect(discard.className).toContain('bg-red-500/15');
    expect(create.className).toContain('size-5');
    expect(create.className).toContain('rounded-md');
    expect(create.className).toContain('bg-emerald-500/15');

    await user.hover(discard);
    expect(await screen.findByText('Discard (Esc)')).toBeTruthy();
    await user.hover(create);
    expect(await screen.findByText('Create (Enter)')).toBeTruthy();
  });

  it('mutes domain suffixes and edits a saved domain from its favicon', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const editDomain = screen.getByRole('button', {
      name: 'Edit youtube.com',
    });
    const domainRow = editDomain.closest('li');
    if (!domainRow) throw new Error('Expected a saved domain row');
    expect(within(domainRow).getByText('.com').className).toContain(
      'text-muted-foreground'
    );
    expect(editDomain.className).toContain('absolute');
    expect(editDomain.className).toContain(
      'group-hover/domain-edit:opacity-100'
    );

    await user.hover(editDomain);
    expect(await screen.findByText('Edit youtube.com')).toBeTruthy();

    await user.click(editDomain);
    const input = screen.getByRole('textbox', {
      name: 'Domain name for youtube.com',
    });
    expect((input as HTMLInputElement).value).toBe('youtube.com');
    await user.clear(input);
    await user.type(input, 'example.net{Enter}');

    await waitFor(() =>
      expect(readRules().some(({ domain }) => domain === 'example.net')).toBe(
        true
      )
    );
    expect(readRules().some(({ domain }) => domain === 'youtube.com')).toBe(
      false
    );
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
      expect(historyButton.className).toContain('disabled:bg-slate-300');
      expect(historyButton.className).toContain('disabled:text-slate-500');
      expect(historyButton.className).toContain('dark:disabled:bg-slate-700');
      expect(historyButton.className).toContain('dark:disabled:text-slate-400');
    }

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
      (
        screen.getByRole('button', {
          name: 'example.com is already in website settings',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('normalizes inline additions and cancels duplicate submissions', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const addButton = screen.getByRole('button', { name: /Add website/i });
    await user.click(addButton);
    const editor = screen.getByPlaceholderText('example.com');
    await user.type(editor, 'https://news.bbc.co.uk/story{Enter}');
    expect(readRules()[1]?.domain).toBe('bbc.co.uk');

    await waitFor(() =>
      expect((addButton as HTMLButtonElement).disabled).toBe(false)
    );
    await user.click(addButton);
    await user.type(
      screen.getByPlaceholderText('example.com'),
      'https://www.bbc.co.uk/another{Enter}'
    );

    await waitFor(() =>
      expect(screen.queryByPlaceholderText('example.com')).toBeNull()
    );
    expect(
      readRules().filter(({ domain }) => domain === 'bbc.co.uk')
    ).toHaveLength(1);
    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    );
  });

  it('shows validation feedback and supports Escape to discard', async () => {
    const user = userEvent.setup();
    render(<SiteAccessHarness />);

    const addButton = screen.getByRole('button', { name: /Add website/i });
    await user.click(addButton);
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    const editor = screen.getByPlaceholderText('example.com');
    await user.type(editor, 'chrome://settings{Enter}');
    expect(screen.getByRole('alert').textContent).toContain('valid website');

    await user.type(editor, '{Escape}');
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('example.com')).toBeNull()
    );
    await waitFor(() =>
      expect((addButton as HTMLButtonElement).disabled).toBe(false)
    );
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

  it('reorders immediately with Alt+Arrow and announces the new position', () => {
    render(<SiteAccessHarness />);

    fireEvent.keyDown(
      screen.getByRole('button', {
        name: /Move youtube\.com/,
      }),
      { altKey: true, key: 'ArrowDown' }
    );

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

    expect(globalDefaultIcon.className).toContain('text-sky-500');

    await user.click(
      screen.getByRole('switch', { name: 'Run on all websites by default' })
    );

    expect(readRules()[0]?.type).toBe('blacklist');
    expect(readRules().slice(1)).toEqual(before);
    expect(globalDefaultIcon.className).toContain('text-slate-400');
  });
});

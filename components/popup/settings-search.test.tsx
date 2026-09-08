// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsSearch } from './settings-search';

function Fixture() {
  const contentRef = useRef<HTMLDivElement>(null);
  return <><div ref={contentRef}><div className="card-list-item">Loop Sections</div><div className="card-list-item">Remember loop sections</div><div className="card-list-item">Volume</div></div><SettingsSearch contentRef={contentRef} active /></>;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('highlights matches, scrolls to the first, and clears the search', async () => {
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  render(<Fixture />);
  const input = screen.getByRole('searchbox', { name: 'Search settings' });
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: 'LOOP' } });
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('2 found'));
  expect(screen.getByText('Loop Sections').hasAttribute('data-search-match')).toBe(true);
  expect(screen.getByText('Volume').hasAttribute('data-search-match')).toBe(false);
  expect(scroll).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(input);
  fireEvent.click(screen.getByRole('button', { name: 'Clear settings search' }));
  await waitFor(() => expect(document.querySelector('[data-search-match]')).toBeNull());
});
it('reports no matches without scrolling', async () => {
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  render(<Fixture />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not found' } });
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No matches'));
  expect(scroll).not.toHaveBeenCalled();
});

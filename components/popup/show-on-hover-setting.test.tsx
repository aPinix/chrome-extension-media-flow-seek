// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShowOnHoverSetting } from './show-on-hover-setting';

afterEach(cleanup);

describe('ShowOnHoverSetting', () => {
  it('updates the preference when it is not required by another feature', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <ShowOnHoverSetting
        checked={false}
        isSeekbarSeekingEnabled={false}
        isSeekbarThumbnailPreviewEnabled={false}
        onCheckedChange={onCheckedChange}
      />
    );

    expect(screen.getByText('Timeline Show on Hover')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Preview Timeline Show on Hover',
      })
    ).toBeTruthy();
    expect(
      screen
        .getByRole('switch', { name: 'Show timeline on hover' })
        .getAttribute('aria-checked')
    ).toBe('false');

    await user.click(
      screen.getByRole('switch', { name: 'Show timeline on hover' })
    );
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it('locks the effective value on for Click & Drag Seekbar', () => {
    render(
      <ShowOnHoverSetting
        checked={false}
        isSeekbarSeekingEnabled={true}
        isSeekbarThumbnailPreviewEnabled={false}
        onCheckedChange={vi.fn()}
      />
    );

    const hoverSwitch = screen.getByRole('switch', {
      name: 'Show timeline on hover',
    });
    expect(hoverSwitch.getAttribute('aria-checked')).toBe('true');
    expect(hoverSwitch.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen.getByLabelText('Why Timeline Show on Hover is locked').className
    ).toContain('cursor-help');
    expect(
      screen.getByText(/Locked on while Click & Drag Seekbar/)
    ).toBeTruthy();
  });

  it('locks the effective value on for Hover Thumbnails', () => {
    render(
      <ShowOnHoverSetting
        checked={false}
        isSeekbarSeekingEnabled={false}
        isSeekbarThumbnailPreviewEnabled={true}
        onCheckedChange={vi.fn()}
      />
    );

    const hoverSwitch = screen.getByRole('switch', {
      name: 'Show timeline on hover',
    });
    expect(hoverSwitch.getAttribute('aria-checked')).toBe('true');
    expect(hoverSwitch.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/Locked on while Hover Thumbnails/)).toBeTruthy();
  });
});

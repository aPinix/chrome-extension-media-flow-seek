// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScrollHotkeyE } from '@/helpers/scroll-speed';
import { ActionAreaE } from '@/types/content';

import { SeekControlsSettings } from './seek-controls-settings';

afterEach(cleanup);

const createProps = () => ({
  actionArea: ActionAreaE.Full,
  actionAreaSize: 30,
  actionAreaSizeUnit: '%' as const,
  colorizedTimeline: false,
  fastScrollHotkey: ScrollHotkeyE.Alt,
  isDragSeekingEnabled: false,
  isPlayPauseWheelEnabled: true,
  isScrollSeekingEnabled: true,
  isSeekbarSeekingEnabled: true,
  onActionAreaChange: vi.fn(),
  onActionAreaReset: vi.fn(),
  onActionAreaSizeChange: vi.fn(),
  onActionAreaSizeReset: vi.fn(),
  onActionAreaSizeUnitChange: vi.fn(),
  onDragSeekingEnabledChange: vi.fn(),
  onFastScrollHotkeyChange: vi.fn(),
  onHeightChange: vi.fn(),
  onHeightReset: vi.fn(),
  onPlayPauseWheelEnabledChange: vi.fn(),
  onPositionChange: vi.fn(),
  onPositionReset: vi.fn(),
  onScrollInversionChange: vi.fn(),
  onScrollSeekingEnabledChange: vi.fn(),
  onScrollSpeedFactorChange: vi.fn(),
  onSeekbarSeekingEnabledChange: vi.fn(),
  onSlowScrollHotkeyChange: vi.fn(),
  onUnitChange: vi.fn(),
  scrollInverted: false,
  scrollSpeedFactor: 1,
  slowScrollHotkey: ScrollHotkeyE.AltShift,
  timelineHeight: 6,
  timelinePosition: 'bottom' as const,
  timelineUnit: 'px' as const,
});

describe('SeekControlsSettings', () => {
  it('keeps the sticky video preview below the popup header gradient', () => {
    render(<SeekControlsSettings {...createProps()} />);

    const preview = screen.getByTestId('sticky-seek-preview');
    expect(preview.className).toContain('top-16');
    expect(preview.className).not.toContain('top-0');
    expect(preview.className).toContain('z-20');
    expect(preview.className).not.toContain('z-40');
  });

  it('keeps every method expanded and focuses the preview with explicit buttons', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<SeekControlsSettings {...props} />);

    const scrollPreview = screen.getByRole('button', {
      name: 'Preview Scroll to Seek',
    });
    const dragPreview = screen.getByRole('button', {
      name: 'Preview Drag to Seek',
    });

    expect(scrollPreview.getAttribute('aria-pressed')).toBe('true');
    expect(scrollPreview.className).toContain('cursor-pointer');
    expect(screen.getByTestId('scroll-method-icon').className).toContain(
      'bg-brand-50'
    );
    expect(
      document.querySelector('[data-method="scroll"]')?.className
    ).not.toContain('bg-brand-50/40');
    expect(
      document.querySelector('[data-method="scroll"]')?.className
    ).toContain('border-brand-500');
    expect(dragPreview.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Inverse Scroll')).toBeTruthy();
    expect(screen.queryByText(/Begin with a horizontal movement/)).toBeNull();
    expect(screen.queryByText(/The timeline stays visible/)).toBeNull();
    const primaryModifierKey = screen.getAllByLabelText(/Command|Ctrl/)[0];
    expect(primaryModifierKey).toBeTruthy();
    if (!primaryModifierKey) throw new Error('Expected a modifier keycap');
    expect(primaryModifierKey.tagName).toBe('KBD');
    expect(primaryModifierKey.className).toContain('rounded-[5px]');
    expect(primaryModifierKey.textContent).toMatch(/⌘|Ctrl/);
    expect(screen.getByTestId('sticky-seek-preview').className).toContain(
      'sticky'
    );
    expect(screen.getByTestId('sticky-seek-preview').className).not.toContain(
      'before:'
    );
    expect(screen.getByTestId('seek-methods').className).toContain('mt-3');
    expect(
      screen
        .getByTestId('seek-controls-preview')
        .getAttribute('data-scroll-speed-factor')
    ).toBe('1');
    expect(
      screen
        .getByTestId('seek-controls-preview')
        .getAttribute('data-scroll-inverted')
    ).toBe('false');

    await user.click(dragPreview);

    expect(scrollPreview.getAttribute('aria-pressed')).toBe('false');
    expect(dragPreview.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('drag-method-icon').className).toContain(
      'bg-slate-100'
    );
    expect(screen.getByText('Inverse Scroll')).toBeTruthy();
    expect(
      screen
        .getByTestId('seek-controls-preview')
        .getAttribute('data-focused-method')
    ).toBe('drag');

    const actionAreaGroup = screen.getByRole('group', {
      name: 'Active video area',
    });
    const topActionArea = within(actionAreaGroup).getByRole('radio', {
      name: 'Top',
    });
    fireEvent.mouseEnter(topActionArea.closest('label') as HTMLLabelElement);
    expect(screen.getByTestId('action-area-overlay').style.top).toBe('');
    expect(screen.getByTestId('action-area-overlay').style.height).toBe('');
    expect(props.onActionAreaChange).not.toHaveBeenCalled();

    fireEvent.mouseLeave(actionAreaGroup);
    expect(props.onActionAreaChange).not.toHaveBeenCalled();

    await user.click(topActionArea);
    expect(props.onActionAreaChange).toHaveBeenCalledWith(ActionAreaE.Top);
  });

  it('keeps preview controls separate from method switches', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<SeekControlsSettings {...props} />);

    await user.click(
      screen.getByRole('button', { name: 'Preview Drag to Seek' })
    );

    expect(props.onDragSeekingEnabledChange).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('switch', { name: 'Enable Drag to Seek' })
        .getAttribute('aria-checked')
    ).toBe('false');
  });

  it('focuses the preview when any seek method card is clicked', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<SeekControlsSettings {...props} />);

    const preview = screen.getByTestId('seek-controls-preview');
    const dragCard = document.querySelector(
      '[data-method="drag"]'
    ) as HTMLElement;
    const seekbarCard = document.querySelector(
      '[data-method="seekbar"]'
    ) as HTMLElement;
    const scrollCard = document.querySelector(
      '[data-method="scroll"]'
    ) as HTMLElement;

    expect(scrollCard.className).not.toContain('cursor-pointer');

    await user.click(dragCard);
    expect(preview.getAttribute('data-focused-method')).toBe('drag');
    expect(props.onDragSeekingEnabledChange).not.toHaveBeenCalled();

    await user.click(seekbarCard);
    expect(preview.getAttribute('data-focused-method')).toBe('seekbar');
    expect(props.onSeekbarSeekingEnabledChange).not.toHaveBeenCalled();

    await user.click(screen.getByText('Inverse Scroll'));
    expect(preview.getAttribute('data-focused-method')).toBe('scroll');
    expect(props.onScrollSeekingEnabledChange).not.toHaveBeenCalled();
  });

  it('keeps method switches independent and reports the all-off state', async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.isScrollSeekingEnabled = false;
    props.isSeekbarSeekingEnabled = false;
    render(<SeekControlsSettings {...props} />);

    expect(screen.getByRole('status').textContent).toContain(
      'No seek controls enabled'
    );
    await user.click(
      screen.getByRole('switch', { name: 'Enable Drag to Seek' })
    );
    expect(props.onDragSeekingEnabledChange).toHaveBeenCalledWith(true);
  });

  it('preserves disabled Scroll child values while preventing edits', () => {
    const props = createProps();
    props.isScrollSeekingEnabled = false;
    props.isSeekbarSeekingEnabled = false;
    props.scrollInverted = true;
    props.scrollSpeedFactor = 2;
    render(<SeekControlsSettings {...props} />);

    const fieldset = screen
      .getByText('Inverse Scroll')
      .closest('fieldset') as HTMLFieldSetElement | null;
    expect(fieldset?.disabled).toBe(true);
    expect(
      screen
        .getByRole('switch', { name: 'Inverse scroll direction' })
        .getAttribute('aria-checked')
    ).toBe('true');
    expect(screen.getByText('2×')).toBeTruthy();
    expect(
      screen
        .getByTestId('seek-controls-preview')
        .getAttribute('data-scroll-inverted')
    ).toBe('true');
    expect(
      screen
        .getByTestId('seek-controls-preview')
        .getAttribute('data-scroll-speed-factor')
    ).toBe('2');
  });
});

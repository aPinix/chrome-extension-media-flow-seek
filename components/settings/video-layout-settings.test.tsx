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
import { ActionAreaE } from '@/types/content';

import { VideoLayoutSettings } from './video-layout-settings';

afterEach(cleanup);

const createCallbacks = () => ({
  onActionAreaChange: vi.fn(),
  onActionAreaSizeChange: vi.fn(),
  onActionAreaSizeReset: vi.fn(),
  onHeightChange: vi.fn(),
  onHeightReset: vi.fn(),
  onPositionChange: vi.fn(),
  onUnitChange: vi.fn(),
  onPlayPauseWheelEnabledChange: vi.fn(),
});

const baseProps = {
  actionArea: ActionAreaE.Full,
  actionAreaSize: 30,
  colorizedTimeline: false,
  height: 6,
  position: 'bottom' as const,
  unit: 'px' as const,
  isPlayPauseWheelEnabled: true,
};

const getRangeInput = (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>('input[type="range"]');
  if (!input) throw new Error('Expected a range input');
  return input;
};

describe('VideoLayoutSettings', () => {
  it('renders one shared preview and keeps both control groups visible', () => {
    render(<VideoLayoutSettings {...baseProps} {...createCallbacks()} />);

    expect(screen.getAllByTestId('video-layout-preview')).toHaveLength(1);
    expect(
      within(screen.getByTestId('video-layout-preview')).getByText('PREVIEW')
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Action Area' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Cycle action area selection' })
    ).toBeNull();

    const actionAreaControl = screen.getByRole('group', {
      name: 'Action area',
    });
    expect(within(actionAreaControl).getAllByRole('radio')).toHaveLength(4);
    expect(
      (
        within(actionAreaControl).getByRole('radio', {
          name: 'Full',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);

    expect(
      screen.getByTestId('action-area-size-control').getAttribute('aria-hidden')
    ).toBe('true');
    const hiddenAreaSizeInput = screen
      .getByTestId('action-area-size-control')
      .querySelector('input[type="range"]');
    expect((hiddenAreaSizeInput as HTMLInputElement | null)?.disabled).toBe(
      true
    );
    const timelinePositionOptions = within(
      screen.getByRole('group', { name: 'Timeline position' })
    ).getAllByRole('radio');
    expect(
      timelinePositionOptions.map((option) => option.getAttribute('value'))
    ).toEqual(['bottom', 'top']);
    expect(
      getRangeInput(screen.getByRole('group', { name: 'Timeline height' }))
    ).toBeTruthy();
    const timelineHeightControl = screen.getByRole('group', {
      name: 'Timeline height',
    });
    expect(
      timelineHeightControl.querySelector('[data-slot="app-slider-track"]')
        ?.className
    ).toContain('h-3');
    expect(
      screen.getByRole('spinbutton', { name: 'Timeline height value' })
        .className
    ).toContain('bg-slate-100');
    expect(
      timelineHeightControl.querySelector('[data-slot="app-slider-thumb"]')
        ?.className
    ).toContain('after:opacity-0');
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Wheel Actions' })).toBeTruthy();
    expect(screen.queryByText('Volume')).toBeNull();
  });

  it('calls every settings callback from its explicit controls', async () => {
    const user = userEvent.setup();
    const callbacks = createCallbacks();

    render(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Middle}
        actionAreaSize={40}
        height={12}
      />
    );

    const actionAreaControl = screen.getByRole('group', {
      name: 'Action area',
    });
    await user.click(
      within(actionAreaControl).getByRole('radio', { name: 'Top' })
    );
    expect(callbacks.onActionAreaChange).toHaveBeenCalledWith(ActionAreaE.Top);

    fireEvent.change(
      getRangeInput(screen.getByRole('group', { name: 'Action area size' })),
      {
        target: { value: '45' },
      }
    );
    expect(callbacks.onActionAreaSizeChange).toHaveBeenCalledWith(45);

    const timelinePosition = screen.getByRole('group', {
      name: 'Timeline position',
    });
    await user.click(
      within(timelinePosition).getByRole('radio', { name: 'Top' })
    );
    expect(callbacks.onPositionChange).toHaveBeenCalledWith('top');

    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Timeline height value' }),
      {
        target: { value: '14' },
      }
    );
    expect(callbacks.onHeightChange).toHaveBeenCalledWith(14);

    await user.click(screen.getByRole('radio', { name: '%' }));
    expect(callbacks.onUnitChange).toHaveBeenCalledWith('%');

    await user.click(
      screen.getByRole('button', { name: 'Reset area size to default' })
    );
    expect(callbacks.onActionAreaSizeReset).toHaveBeenCalledOnce();

    await user.click(
      screen.getByRole('button', { name: 'Reset height to default' })
    );
    expect(callbacks.onHeightReset).toHaveBeenCalledOnce();

    await user.click(
      screen.getByRole('switch', { name: 'Toggle play pause wheel action' })
    );
    expect(callbacks.onPlayPauseWheelEnabledChange).toHaveBeenCalledWith(false);
  });

  it('disables each reset button when its slider is at the default', () => {
    render(
      <VideoLayoutSettings
        {...baseProps}
        {...createCallbacks()}
        actionArea={ActionAreaE.Middle}
      />
    );

    for (const resetButton of [
      screen.getByRole('button', { name: 'Reset area size to default' }),
      screen.getByRole('button', { name: 'Reset height to default' }),
    ]) {
      expect(resetButton).toHaveProperty('disabled', true);
      expect(resetButton.className).toContain('disabled:bg-slate-300');
      expect(resetButton.className).toContain('disabled:text-slate-500');
      expect(resetButton.className).toContain('dark:disabled:bg-slate-700');
      expect(resetButton.className).toContain('dark:disabled:text-slate-400');
    }
  });

  it('positions every action-area state from the selected percentage', () => {
    const callbacks = createCallbacks();
    const { rerender } = render(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Top}
        actionAreaSize={40}
      />
    );
    const overlay = screen.getByTestId('action-area-overlay');

    expect(overlay.style.height).toBe('40%');
    expect(overlay.style.top).toBe('0%');

    rerender(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Middle}
        actionAreaSize={40}
      />
    );
    expect(overlay.style.height).toBe('40%');
    expect(overlay.style.top).toBe('30%');

    rerender(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Bottom}
        actionAreaSize={40}
      />
    );
    expect(overlay.style.height).toBe('40%');
    expect(overlay.style.top).toBe('60%');

    rerender(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Full}
      />
    );
    expect(overlay.style.height).toBe('');
    expect(overlay.style.top).toBe('');
    expect(overlay.className).toContain('inset-0');
  });

  it('updates the preview timeline position, height, and unit', () => {
    const callbacks = createCallbacks();
    const { rerender } = render(
      <VideoLayoutSettings {...baseProps} {...callbacks} />
    );
    const timeline = screen.getByTestId('timeline-overlay');
    const timelineProgress = screen.getByTestId('timeline-progress');

    expect(timeline.style.height).toBe('6px');
    expect(timeline.style.top).toBe('calc(100% - 6px)');
    expect(timelineProgress.className).not.toContain('border');
    expect(timelineProgress.className).toContain('bg-white/55');

    rerender(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        height={12}
        position="top"
        unit="%"
      />
    );
    expect(timeline.style.height).toBe('12%');
    expect(timeline.style.top).toBe('0px');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'top timeline at 12%'
    );

    rerender(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        colorizedTimeline={true}
      />
    );
    expect(timelineProgress.className).toContain('bg-brand-400/80');
  });
});

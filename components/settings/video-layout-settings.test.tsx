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
  onActionAreaReset: vi.fn(),
  onActionAreaSizeChange: vi.fn(),
  onActionAreaSizeReset: vi.fn(),
  onActionAreaSizeUnitChange: vi.fn(),
  onHeightChange: vi.fn(),
  onHeightReset: vi.fn(),
  onPositionChange: vi.fn(),
  onPositionReset: vi.fn(),
  onUnitChange: vi.fn(),
});

const baseProps = {
  actionArea: ActionAreaE.Full,
  actionAreaSize: 30,
  actionAreaSizeUnit: '%' as const,
  height: 6,
  position: 'bottom' as const,
  unit: 'px' as const,
};

const getRangeInput = (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>('input[type="range"]');
  if (!input) throw new Error('Expected a range input');
  return input;
};

describe('VideoLayoutSettings', () => {
  it('renders one shared active-area and timeline configuration', () => {
    render(<VideoLayoutSettings {...baseProps} {...createCallbacks()} />);

    expect(
      screen.getByRole('heading', { name: 'Active Video Area' })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Timeline Appearance' })
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole('group', { name: 'Active video area' })
      ).getAllByRole('radio')
    ).toHaveLength(4);
    expect(
      screen.getByTestId('action-area-size-control').getAttribute('aria-hidden')
    ).toBe('true');
    expect(screen.queryByText('Timeline Show on Hover')).toBeNull();
  });

  it('calls the shared layout callbacks', async () => {
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

    await user.click(
      within(
        screen.getByRole('group', { name: 'Active video area' })
      ).getByRole('radio', { name: 'Top' })
    );
    expect(callbacks.onActionAreaChange).toHaveBeenCalledWith(ActionAreaE.Top);

    const actionAreaGroup = screen.getByRole('group', {
      name: 'Active video area',
    });
    expect(actionAreaGroup.className).toContain('border-0');
    expect(actionAreaGroup.className).toContain('bg-slate-200');
    fireEvent.mouseEnter(
      within(actionAreaGroup)
        .getByRole('radio', { name: 'Bottom' })
        .closest('label') as HTMLLabelElement
    );
    expect(callbacks.onActionAreaChange).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(actionAreaGroup);
    expect(callbacks.onActionAreaChange).toHaveBeenCalledTimes(1);

    fireEvent.change(
      getRangeInput(screen.getByRole('group', { name: 'Action area size' })),
      { target: { value: '45' } }
    );
    expect(callbacks.onActionAreaSizeChange).toHaveBeenCalledWith(45);

    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Action area size value' }),
      { target: { value: '50' } }
    );
    expect(callbacks.onActionAreaSizeChange).toHaveBeenCalledWith(50);
    const actionAreaSizeInput = screen.getByRole('spinbutton', {
      name: 'Action area size value',
    });
    expect(actionAreaSizeInput.className).toContain('h-8');
    expect(actionAreaSizeInput.className).toContain('bg-slate-200');
    expect(actionAreaSizeInput.parentElement?.className).toContain('w-32');
    expect(actionAreaSizeInput.parentElement?.textContent).toContain('%');
    const actionAreaUnitGroup = screen.getByRole('group', {
      name: 'Action area size unit',
    });
    expect(actionAreaUnitGroup.className).toContain('inset-y-1');
    await user.click(
      within(actionAreaUnitGroup).getByRole('radio', { name: 'px' })
    );
    expect(callbacks.onActionAreaSizeUnitChange).toHaveBeenCalledWith('px');

    const timelinePositionGroup = screen.getByRole('group', {
      name: 'Timeline position',
    });
    expect(timelinePositionGroup.className).toContain('border-0');
    expect(timelinePositionGroup.className).toContain('bg-slate-200');
    await user.click(
      within(timelinePositionGroup).getByRole('radio', { name: 'Top' })
    );
    expect(callbacks.onPositionChange).toHaveBeenCalledWith('top');

    const timelineHeightInput = screen.getByRole('spinbutton', {
      name: 'Timeline height value',
    });
    expect(timelineHeightInput.className).toContain('bg-slate-200');
    expect(
      screen.getByRole('group', { name: 'Timeline height unit' }).className
    ).toContain('inset-y-1');
    expect(
      screen.getByRole('group', { name: 'Timeline height unit' }).className
    ).toContain('border-0');
    expect(
      screen.getByRole('group', { name: 'Timeline height unit' }).className
    ).toContain('bg-slate-300/80');
    fireEvent.change(timelineHeightInput, { target: { value: '14' } });
    expect(callbacks.onHeightChange).toHaveBeenCalledWith(14);
  });

  it('keeps timeline height reset enabled until both 6 and px are restored', async () => {
    const user = userEvent.setup();
    const callbacks = createCallbacks();
    const { rerender } = render(
      <VideoLayoutSettings {...baseProps} {...callbacks} height={6} unit="%" />
    );

    const reset = screen.getByRole('button', {
      name: 'Reset height to default',
    });
    expect((reset as HTMLButtonElement).disabled).toBe(false);
    await user.click(reset);
    expect(callbacks.onHeightReset).toHaveBeenCalledOnce();

    rerender(
      <VideoLayoutSettings {...baseProps} {...callbacks} height={6} unit="px" />
    );
    expect((reset as HTMLButtonElement).disabled).toBe(true);
  });

  it('resets timeline position to the Bottom default', async () => {
    const user = userEvent.setup();
    const callbacks = createCallbacks();
    const { rerender } = render(
      <VideoLayoutSettings {...baseProps} {...callbacks} position="top" />
    );

    const reset = screen.getByRole('button', {
      name: 'Reset timeline position to default',
    });
    expect((reset as HTMLButtonElement).disabled).toBe(false);
    await user.click(reset);
    expect(callbacks.onPositionReset).toHaveBeenCalledOnce();

    rerender(
      <VideoLayoutSettings {...baseProps} {...callbacks} position="bottom" />
    );
    expect((reset as HTMLButtonElement).disabled).toBe(true);
  });

  it('resets the active video area to the Full default', async () => {
    const user = userEvent.setup();
    const callbacks = createCallbacks();
    const { rerender } = render(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Middle}
      />
    );

    const reset = screen.getByRole('button', {
      name: 'Reset active video area to default',
    });
    expect((reset as HTMLButtonElement).disabled).toBe(false);
    await user.click(reset);
    expect(callbacks.onActionAreaReset).toHaveBeenCalledOnce();

    rerender(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Full}
      />
    );
    expect((reset as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Area Size reset for any value other than 30%', async () => {
    const user = userEvent.setup();
    const callbacks = createCallbacks();
    const { rerender } = render(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Middle}
        actionAreaSize={30}
        actionAreaSizeUnit="px"
      />
    );

    const reset = screen.getByRole('button', {
      name: 'Reset area size to default',
    });
    expect((reset as HTMLButtonElement).disabled).toBe(false);

    rerender(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Middle}
        actionAreaSize={40}
        actionAreaSizeUnit="%"
      />
    );
    expect((reset as HTMLButtonElement).disabled).toBe(false);
    await user.click(reset);
    expect(callbacks.onActionAreaSizeReset).toHaveBeenCalledOnce();

    rerender(
      <VideoLayoutSettings
        {...baseProps}
        {...callbacks}
        actionArea={ActionAreaE.Middle}
        actionAreaSize={30}
        actionAreaSizeUnit="%"
      />
    );
    expect((reset as HTMLButtonElement).disabled).toBe(true);
  });
});

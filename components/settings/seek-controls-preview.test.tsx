// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { ActionAreaE } from '@/types/content';

import {
  getScrollWheelOffset,
  getSeekPreviewElapsed,
  getSeekPreviewProgress,
  SeekControlsPreview,
} from './seek-controls-preview';

afterEach(cleanup);

describe('SeekControlsPreview', () => {
  it('keeps the video, timeline, and gesture movement on one progress cycle', () => {
    expect(getSeekPreviewProgress(0, 'scroll')).toBeCloseTo(0.34);
    expect(getSeekPreviewProgress(1600, 'scroll')).toBeCloseTo(0.72);
    expect(getSeekPreviewProgress(3200, 'scroll')).toBeCloseTo(0.34);
    expect(getSeekPreviewProgress(2000, 'drag')).toBeCloseTo(0.72);
    expect(getSeekPreviewProgress(2000, 'seekbar')).toBeCloseTo(0.72);
    expect(getSeekPreviewProgress(0, 'scroll', true)).toBeCloseTo(0.72);
    expect(getSeekPreviewProgress(1600, 'scroll', true)).toBeCloseTo(0.34);
    expect(getSeekPreviewProgress(0, 'drag', true)).toBeCloseTo(0.34);
  });

  it('applies Base Speed to the Scroll preview animation clock only', () => {
    expect(getSeekPreviewElapsed(800, 'scroll', 2)).toBe(1600);
    expect(getSeekPreviewElapsed(800, 'scroll', 0.5)).toBe(400);
    expect(getSeekPreviewElapsed(800, 'drag', 2)).toBe(800);
    expect(getSeekPreviewElapsed(800, 'seekbar', 2)).toBe(800);
    expect(
      getSeekPreviewProgress(getSeekPreviewElapsed(800, 'scroll', 2), 'scroll')
    ).toBeCloseTo(0.72);
  });

  it('moves the traditional mouse wheel toward the current seek direction', () => {
    expect(getScrollWheelOffset(0)).toBeCloseTo(0);
    expect(getScrollWheelOffset(70)).toBeCloseTo(1.75);
    expect(getScrollWheelOffset(800)).toBeCloseTo(2);
    expect(getScrollWheelOffset(1530)).toBeLessThan(1);
    expect(getScrollWheelOffset(1600)).toBeCloseTo(0);
    expect(getScrollWheelOffset(1670)).toBeCloseTo(-1.75);
    expect(getScrollWheelOffset(2400)).toBeCloseTo(-2);
    expect(getScrollWheelOffset(3200)).toBeCloseTo(0);
  });

  it.each([
    [false, false, false, 'none'],
    [true, false, false, 'Scroll'],
    [false, true, false, 'Drag'],
    [false, false, true, 'Seekbar'],
    [true, true, false, 'Scroll, Drag'],
    [true, false, true, 'Scroll, Seekbar'],
    [false, true, true, 'Drag, Seekbar'],
    [true, true, true, 'Scroll, Drag, Seekbar'],
  ])(
    'describes the enabled combination scroll=%s drag=%s seekbar=%s',
    (scroll, drag, seekbar, expectedMethods) => {
      render(
        <SeekControlsPreview
          actionArea={ActionAreaE.Full}
          actionAreaSize={30}
          colorizedTimeline={false}
          focusedMethod="scroll"
          isDragSeekingEnabled={drag}
          isScrollSeekingEnabled={scroll}
          isSeekbarSeekingEnabled={seekbar}
          timelineHeight={6}
          timelinePosition="bottom"
          timelineUnit="px"
        />
      );

      expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
        `Enabled methods: ${expectedMethods}`
      );
    }
  );

  it('describes enabled methods and live layout geometry', () => {
    render(
      <SeekControlsPreview
        actionArea={ActionAreaE.Middle}
        actionAreaSize={40}
        colorizedTimeline={true}
        focusedMethod="drag"
        isDragSeekingEnabled={true}
        isScrollSeekingEnabled={true}
        isSeekbarSeekingEnabled={false}
        timelineHeight={12}
        timelinePosition="top"
        timelineUnit="%"
      />
    );

    const preview = screen.getByRole('img');
    expect(preview.className).toContain('aspect-video');
    expect(preview.className).not.toContain('border');
    expect(preview.className).not.toContain('shadow-inner');
    expect(preview.getAttribute('aria-label')).toContain(
      'Focused method: Drag'
    );
    expect(preview.getAttribute('aria-label')).toContain(
      'Enabled methods: Scroll, Drag'
    );
    expect(preview.getAttribute('aria-label')).toContain(
      'middle active video area at 40%'
    );
    expect(preview.getAttribute('aria-label')).toContain('top timeline at 12%');
    expect(screen.getByTestId('action-area-overlay').style.top).toBe('30%');
    expect(screen.getByTestId('action-area-overlay').className).toContain(
      'border-violet-300/90'
    );
    expect(screen.getByTestId('timeline-overlay').style.top).toBe('0px');
    expect(screen.getByTestId('timeline-overlay').className).toContain(
      'bg-white/20'
    );
    expect(screen.getByTestId('timeline-overlay').className).toContain(
      'backdrop-blur-[8px]'
    );
    expect(screen.getByTestId('timeline-progress').className).toContain(
      'bg-violet-400/80'
    );
    expect(screen.getByTestId('drag-gesture-cue').className).toContain(
      'bg-white/20'
    );
    expect(screen.getByTestId('drag-cursor-hand')).toBeTruthy();
    expect(screen.queryByTestId('drag-magic-mouse')).toBeNull();
    expect(screen.getByTestId('timeline-progress').childElementCount).toBe(0);
    expect(screen.getByTestId('timeline-progress').className).toContain(
      'w-[34%]'
    );
    const video = screen.getByTestId('seek-preview-video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('/video/video-preview.mp4');
    expect(video.autoplay).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByText('LIVE PREVIEW')).toBeNull();
    expect(screen.getByTestId('focused-method-label').textContent).toBe(
      'Drag to Seek'
    );
    expect(screen.getByTestId('gesture-cue-layer').className).toContain('z-40');
    expect(screen.getByTestId('focused-method-label').className).toContain(
      'z-50'
    );
    expect(screen.getByTestId('timeline-overlay').className).toContain('z-20');
  });

  it('cycles through trackpad, Magic Mouse, and traditional mouse demonstrations', () => {
    render(
      <SeekControlsPreview
        actionArea={ActionAreaE.Full}
        actionAreaSize={30}
        colorizedTimeline={false}
        focusedMethod="scroll"
        isDragSeekingEnabled={false}
        isScrollSeekingEnabled={true}
        isSeekbarSeekingEnabled={false}
        timelineHeight={6}
        timelinePosition="bottom"
        timelineUnit="px"
      />
    );

    expect(screen.getByTestId('scroll-device')).toBeTruthy();
    expect(screen.getByTestId('scroll-device').className).not.toContain('bg-');
    expect(screen.getByTestId('scroll-device').className).toContain('border-2');
    expect(screen.getByTestId('scroll-device').className).toContain(
      '[corner-shape:squircle]'
    );
    expect(screen.getByTestId('scroll-device-container').className).toContain(
      'p-3'
    );
    expect(screen.getByTestId('scroll-fingers').children).toHaveLength(2);
    expect(screen.getByTestId('scroll-wheel').className).toContain('h-4');
    expect(screen.getByTestId('scroll-wheel').className).toContain('w-2');
    expect(
      screen
        .getByTestId('scroll-wheel')
        .style.getPropertyValue('--seek-wheel-x')
    ).toBe('0px');
    expect(
      screen
        .getByTestId('scroll-fingers')
        .style.getPropertyValue('--seek-finger-x')
    ).toBe('0px');
  });

  it('advances the scroll input device cycle when the preview is activated', async () => {
    const user = userEvent.setup();
    render(
      <SeekControlsPreview
        actionArea={ActionAreaE.Full}
        actionAreaSize={30}
        colorizedTimeline={false}
        focusedMethod="scroll"
        isDragSeekingEnabled={false}
        isScrollSeekingEnabled={true}
        isSeekbarSeekingEnabled={false}
        timelineHeight={6}
        timelinePosition="bottom"
        timelineUnit="px"
      />
    );

    const advanceButton = screen.getByRole('button', {
      name: 'Show next scroll input device',
    });

    expect(screen.getByTestId('scroll-device').dataset.scrollDevice).toBe(
      'trackpad'
    );
    await user.click(advanceButton);
    expect(screen.getByTestId('scroll-device').dataset.scrollDevice).toBe(
      'magic-mouse'
    );
    await user.click(advanceButton);
    expect(screen.getByTestId('scroll-device').dataset.scrollDevice).toBe(
      'mouse'
    );
    await user.click(advanceButton);
    expect(screen.getByTestId('scroll-device').dataset.scrollDevice).toBe(
      'trackpad'
    );
  });

  it('anchors the seekbar cursor to the live timeline edge', () => {
    const { rerender } = render(
      <SeekControlsPreview
        actionArea={ActionAreaE.Full}
        actionAreaSize={30}
        colorizedTimeline={false}
        focusedMethod="seekbar"
        isDragSeekingEnabled={false}
        isScrollSeekingEnabled={false}
        isSeekbarSeekingEnabled={true}
        timelineHeight={12}
        timelinePosition="top"
        timelineUnit="%"
      />
    );

    const cursor = screen.getByTestId('seekbar-gesture-cue');
    expect(cursor.style.top).toBe('6%');
    expect(cursor.style.bottom).toBe('');
    expect(cursor.className).not.toContain('-translate-x-1/2');
    expect(cursor.className).toContain('-translate-y-1/2');
    expect(cursor.firstElementChild?.getAttribute('class')).toContain(
      '-translate-x-[3.333px]'
    );

    rerender(
      <SeekControlsPreview
        actionArea={ActionAreaE.Full}
        actionAreaSize={30}
        colorizedTimeline={false}
        focusedMethod="seekbar"
        isDragSeekingEnabled={false}
        isScrollSeekingEnabled={false}
        isSeekbarSeekingEnabled={true}
        timelineHeight={18}
        timelinePosition="bottom"
        timelineUnit="px"
      />
    );

    expect(cursor.style.top).toBe('calc(100% - 9px)');
    expect(cursor.style.bottom).toBe('');
  });

  it('renders an absolute pixel action area', () => {
    render(
      <SeekControlsPreview
        actionArea={ActionAreaE.Middle}
        actionAreaSize={48}
        actionAreaSizeUnit="px"
        colorizedTimeline={false}
        focusedMethod="scroll"
        isDragSeekingEnabled={false}
        isScrollSeekingEnabled={true}
        isSeekbarSeekingEnabled={false}
        timelineHeight={6}
        timelinePosition="bottom"
        timelineUnit="px"
      />
    );

    const overlay = screen.getByTestId('action-area-overlay');
    expect(overlay.style.height).toBe('48px');
    expect(overlay.style.top).toBe('calc(0.5 * (100% - 48px))');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'middle active video area at 48px'
    );
  });

  it('announces an all-off state without inventing an enabled method', () => {
    render(
      <SeekControlsPreview
        actionArea={ActionAreaE.Full}
        actionAreaSize={30}
        colorizedTimeline={false}
        focusedMethod="scroll"
        isDragSeekingEnabled={false}
        isScrollSeekingEnabled={false}
        isSeekbarSeekingEnabled={false}
        timelineHeight={6}
        timelinePosition="bottom"
        timelineUnit="px"
      />
    );

    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'Enabled methods: none'
    );
  });
});

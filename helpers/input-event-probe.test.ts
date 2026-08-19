// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  InputEventProbe,
  type InputEventProbeRecord,
  normalizeInputEvent,
} from '@/helpers/input-event-probe';

type InputEventProbeGlobal = typeof globalThis & {
  __MFS_INPUT_EVENTS__?: InputEventProbeRecord[];
};

afterEach(() => {
  delete (globalThis as InputEventProbeGlobal).__MFS_INPUT_EVENTS__;
  vi.restoreAllMocks();
});

describe('normalizeInputEvent', () => {
  it('records wheel coordinates, deltas, and the event modifier snapshot', () => {
    const event = new WheelEvent('wheel', {
      altKey: true,
      clientX: 120,
      clientY: 80,
      deltaX: 14,
      deltaY: -9,
      metaKey: true,
      screenX: 640,
      screenY: 420,
      shiftKey: true,
    });

    expect(normalizeInputEvent(event, document)).toEqual({
      altKey: true,
      clientX: 120,
      clientY: 80,
      ctrlKey: false,
      deltaX: 14,
      deltaY: -9,
      documentHasFocus: document.hasFocus(),
      eventType: 'wheel',
      metaKey: true,
      screenX: 640,
      screenY: 420,
      shiftKey: true,
      visibilityState: document.visibilityState,
    });
  });

  it('uses null for coordinates and deltas that the event does not expose', () => {
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'Control',
    });

    expect(normalizeInputEvent(event, document)).toMatchObject({
      altKey: false,
      clientX: null,
      clientY: null,
      ctrlKey: true,
      deltaX: null,
      deltaY: null,
      eventType: 'keydown',
      metaKey: false,
      screenX: null,
      screenY: null,
      shiftKey: false,
    });
  });
});

describe('InputEventProbe', () => {
  it('captures events, caps the ring buffer, and cleans up when stopped', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const probe = new InputEventProbe(document, window, 2);

    probe.start();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    document.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 10, clientY: 20 })
    );

    expect(probe.getRecords().map(({ eventType }) => eventType)).toEqual([
      'keyup',
      'mousemove',
    ]);
    expect((globalThis as InputEventProbeGlobal).__MFS_INPUT_EVENTS__).toBe(
      probe.getRecords()
    );

    probe.stop();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));

    expect(probe.getRecords()).toHaveLength(0);
    expect(
      (globalThis as InputEventProbeGlobal).__MFS_INPUT_EVENTS__
    ).toBeUndefined();
  });

  it('captures window focus transitions without stale mouse fields', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const probe = new InputEventProbe(document, window);
    probe.start();

    window.dispatchEvent(new FocusEvent('blur'));

    expect(probe.getRecords().at(-1)).toMatchObject({
      clientX: null,
      clientY: null,
      deltaX: null,
      deltaY: null,
      eventType: 'blur',
      screenX: null,
      screenY: null,
    });

    probe.stop();
  });
});

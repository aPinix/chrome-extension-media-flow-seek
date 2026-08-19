export interface InputEventProbeRecord {
  eventType: string;
  clientX: number | null;
  clientY: number | null;
  screenX: number | null;
  screenY: number | null;
  deltaX: number | null;
  deltaY: number | null;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  documentHasFocus: boolean;
  visibilityState: DocumentVisibilityState;
}

type InputEventProbeGlobal = typeof globalThis & {
  __MFS_INPUT_EVENTS__?: InputEventProbeRecord[];
};

const DEFAULT_MAX_RECORDS = 500;
const INPUT_EVENT_TYPES = [
  'wheel',
  'pointermove',
  'mousemove',
  'keydown',
  'keyup',
  'visibilitychange',
] as const;

const readBoolean = (event: Event, key: keyof MouseEvent): boolean => {
  const value = (event as unknown as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : false;
};

export const normalizeInputEvent = (
  event: Event,
  ownerDocument: Document
): InputEventProbeRecord => {
  const mouseEvent = event instanceof MouseEvent ? event : null;
  const wheelEvent = event instanceof WheelEvent ? event : null;

  return {
    eventType: event.type,
    clientX: mouseEvent?.clientX ?? null,
    clientY: mouseEvent?.clientY ?? null,
    screenX: mouseEvent?.screenX ?? null,
    screenY: mouseEvent?.screenY ?? null,
    deltaX: wheelEvent?.deltaX ?? null,
    deltaY: wheelEvent?.deltaY ?? null,
    metaKey: readBoolean(event, 'metaKey'),
    ctrlKey: readBoolean(event, 'ctrlKey'),
    altKey: readBoolean(event, 'altKey'),
    shiftKey: readBoolean(event, 'shiftKey'),
    documentHasFocus: ownerDocument.hasFocus(),
    visibilityState: ownerDocument.visibilityState,
  };
};

export class InputEventProbe {
  private readonly records: InputEventProbeRecord[] = [];
  private isRunning = false;

  constructor(
    private readonly ownerDocument: Document,
    private readonly ownerWindow: Window,
    private readonly maxRecords = DEFAULT_MAX_RECORDS
  ) {}

  start(): void {
    if (this.isRunning) return;

    this.records.length = 0;
    (globalThis as InputEventProbeGlobal).__MFS_INPUT_EVENTS__ = this.records;

    for (const type of INPUT_EVENT_TYPES) {
      this.ownerDocument.addEventListener(type, this.handleEvent, {
        capture: true,
        passive: true,
      });
    }
    this.ownerWindow.addEventListener('blur', this.handleEvent, true);
    this.ownerWindow.addEventListener('focus', this.handleEvent, true);
    this.isRunning = true;
  }

  stop(): void {
    if (!this.isRunning) return;

    for (const type of INPUT_EVENT_TYPES) {
      this.ownerDocument.removeEventListener(type, this.handleEvent, true);
    }
    this.ownerWindow.removeEventListener('blur', this.handleEvent, true);
    this.ownerWindow.removeEventListener('focus', this.handleEvent, true);

    this.records.length = 0;
    delete (globalThis as InputEventProbeGlobal).__MFS_INPUT_EVENTS__;
    this.isRunning = false;
  }

  setEnabled(enabled: boolean): void {
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  getRecords(): readonly InputEventProbeRecord[] {
    return this.records;
  }

  private readonly handleEvent = (event: Event): void => {
    const record = normalizeInputEvent(event, this.ownerDocument);
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }

    console.log('[BetterVideo input probe]', record);
  };
}

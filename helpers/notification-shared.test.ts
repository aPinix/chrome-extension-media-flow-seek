import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNotificationFunction } from '@/helpers/notification-shared';

class FakeClassList {
  private classes = new Set<string>();

  add(className: string) {
    this.classes.add(className);
  }

  contains(className: string) {
    return this.classes.has(className);
  }

  remove(className: string) {
    this.classes.delete(className);
  }
}

class FakeElement {
  children: FakeElement[] = [];
  classList = new FakeClassList();
  className = '';
  id = '';
  innerHTML = '';
  parent?: FakeElement;
  textContent = '';

  appendChild(child: FakeElement) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter(
        (child) => child !== this
      );
      this.parent = undefined;
    }
  }
}

class FakeDocument {
  body = new FakeElement();
  head = new FakeElement();

  createElement() {
    return new FakeElement();
  }

  getElementById(id: string) {
    return this.findById(id)[0] ?? null;
  }

  querySelectorAll(selector: string) {
    return selector.startsWith('#') ? this.findById(selector.slice(1)) : [];
  }

  private findById(id: string) {
    const matches: FakeElement[] = [];
    const visit = (element: FakeElement) => {
      if (element.id === id) matches.push(element);
      element.children.forEach(visit);
    };

    visit(this.head);
    visit(this.body);
    return matches;
  }
}

describe('toggle notification', () => {
  let animationFrameCalls: number;
  let fakeDocument: FakeDocument;

  beforeEach(() => {
    vi.useFakeTimers();
    animationFrameCalls = 0;
    fakeDocument = new FakeDocument();
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrameCalls += 1;
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reuses one popover and resets its dismissal timer', () => {
    const showNotification = createNotificationFunction();

    showNotification(true, 'hotkey');
    const notification = fakeDocument.getElementById(
      'media-flow-seek-notification'
    );

    expect(notification?.innerHTML).toContain('>Enabled</span>');
    expect(notification?.innerHTML).toContain('mfs-notification-logo');
    expect(notification?.innerHTML).toContain('mfs-notification-status');
    expect(notification?.innerHTML).not.toContain('mfs-notification-via');
    expect(notification?.innerHTML).not.toContain('✅');
    expect(notification?.innerHTML).not.toContain('🚫');
    expect(notification?.innerHTML).not.toContain('⌨️');
    expect(notification?.innerHTML).not.toContain('🖱️');
    expect(animationFrameCalls).toBe(2);
    expect(notification?.classList.contains('mfs-notification-show')).toBe(
      true
    );
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('backdrop-filter: saturate(180%) blur(20px)');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('background: rgb(255 255 255 / 0.8)');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('background: rgb(51 51 51 / 0.8)');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('border-radius: 9999px');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('border: 1px solid rgb(255 255 255 / 0.4)');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('padding: 12px 20px 12px 12px');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('0 24px 60px -24px rgb(15 23 42 / 0.28)');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('transform-origin: center');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).not.toContain('mask-image');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('transform: translateX(-50%) scale(0.94)');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).not.toContain('corner-shape');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('@media (prefers-color-scheme: dark)');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('color: rgb(22 163 74)');
    expect(
      fakeDocument.getElementById('mfs-notification-styles')?.textContent
    ).toContain('color: rgb(220 38 38)');

    vi.advanceTimersByTime(2500);
    showNotification(false, 'hotkey');

    expect(
      fakeDocument.querySelectorAll('#media-flow-seek-notification')
    ).toHaveLength(1);
    expect(fakeDocument.getElementById('media-flow-seek-notification')).toBe(
      notification
    );
    expect(notification?.innerHTML).toContain('>Disabled</span>');

    vi.advanceTimersByTime(2999);
    expect(notification?.classList.contains('mfs-notification-show')).toBe(
      true
    );

    vi.advanceTimersByTime(1);
    expect(notification?.classList.contains('mfs-notification-show')).toBe(
      false
    );
  });
});

// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { isVideoBlockedByDialog } from './page-dialogs';

afterEach(() => document.body.replaceChildren());

it('ignores offscreen dialogs but blocks visible unrelated dialogs', () => {
  const video = document.createElement('video');
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  document.body.append(video, dialog);
  dialog.getBoundingClientRect = () => new DOMRect(0, window.innerHeight, 550, 64);
  expect(isVideoBlockedByDialog(video)).toBe(false);
  dialog.getBoundingClientRect = () => new DOMRect(0, 20, 550, 64);
  expect(isVideoBlockedByDialog(video)).toBe(true);
  dialog.hidden = true;
  expect(isVideoBlockedByDialog(video)).toBe(false);
});

it('allows the popup player, blocks background videos, and respects nested login dialogs', () => {
  const background = document.createElement('video');
  const video = document.createElement('video');
  const popup = document.createElement('div');
  popup.setAttribute('role', 'dialog');
  popup.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
  popup.append(video);
  document.body.append(background, popup);
  expect(isVideoBlockedByDialog(video)).toBe(false);
  expect(isVideoBlockedByDialog(background)).toBe(true);
  const login = document.createElement('div');
  login.setAttribute('aria-modal', 'true');
  login.getBoundingClientRect = () => new DOMRect(100, 100, 400, 400);
  popup.append(login);
  expect(isVideoBlockedByDialog(video)).toBe(true);
  login.remove();
  expect(isVideoBlockedByDialog(video)).toBe(false);
});

export const ShortcutHotkeyStateE = {
  NotConfigured: 'Not Configured',
  NotAvailable: 'Not Available',
  Configured: 'Configured',
} as const;
export type ShortcutHotkeyStateT =
  (typeof ShortcutHotkeyStateE)[keyof typeof ShortcutHotkeyStateE];

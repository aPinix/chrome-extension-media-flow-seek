export const SETTINGS_SCHEMA_VERSION = 2;

type SeekSettingsMigrationInput = {
  settingsSchemaVersion?: number;
  isScrollSeekingEnabled?: boolean;
  isTimelineSeekingEnabled?: boolean;
  dragVideoToSeek?: boolean;
  hideVideoControls?: boolean;
};

type SeekSettingsDefaults = Required<
  Omit<SeekSettingsMigrationInput, 'settingsSchemaVersion'>
>;

export type MigratedSeekSettings = SeekSettingsDefaults & {
  settingsSchemaVersion: number;
  didMigrate: boolean;
};

export const migrateSeekSettings = (
  stored: SeekSettingsMigrationInput,
  defaults: SeekSettingsDefaults
): MigratedSeekSettings => {
  const isCurrentSchema =
    typeof stored.settingsSchemaVersion === 'number' &&
    stored.settingsSchemaVersion >= SETTINGS_SCHEMA_VERSION;
  const isTimelineSeekingEnabled =
    stored.isTimelineSeekingEnabled ?? defaults.isTimelineSeekingEnabled;

  return {
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
    didMigrate: !isCurrentSchema,
    isScrollSeekingEnabled:
      stored.isScrollSeekingEnabled ?? defaults.isScrollSeekingEnabled,
    isTimelineSeekingEnabled,
    // Drag and Minimal Player used to be children of timeline seeking. During
    // the one-time migration, preserve what was actually active rather than
    // awakening a stored child preference that could not previously run.
    dragVideoToSeek: isCurrentSchema
      ? (stored.dragVideoToSeek ?? defaults.dragVideoToSeek)
      : (stored.dragVideoToSeek ?? defaults.dragVideoToSeek) &&
        isTimelineSeekingEnabled,
    hideVideoControls: isCurrentSchema
      ? (stored.hideVideoControls ?? defaults.hideVideoControls)
      : (stored.hideVideoControls ?? defaults.hideVideoControls) &&
        isTimelineSeekingEnabled,
  };
};

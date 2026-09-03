// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { createDomainRule } from '@/helpers/domains';
import { SettingsManager } from '@/helpers/settings-manager';
import { DomainModeE } from '@/types/domains';

describe('SettingsManager seek mode gates', () => {
  it('defaults YouTube chaptered timelines to off and updates them independently', () => {
    const settings = new SettingsManager();

    expect(settings.isYouTubeChapteredTimelineEnabled()).toBe(false);
    settings.updateSetting('isYouTubeChapteredTimelineEnabled', true);
    expect(settings.isYouTubeChapteredTimelineEnabled()).toBe(true);
  });

  it('defaults action area size to percentage units', () => {
    const settings = new SettingsManager();

    expect(settings.getActionAreaSize()).toBe(30);
    expect(settings.getActionAreaSizeUnit()).toBe('%');
  });

  it('keeps Drag and Minimal Player independent from Click and Drag Seekbar', () => {
    const settings = new SettingsManager();
    settings.updateSetting('isTimelineSeekingEnabled', false);
    settings.updateSetting('dragVideoToSeek', true);
    settings.updateSetting('hideVideoControls', true);

    expect(settings.isTimelineSeekingEnabled()).toBe(false);
    expect(settings.shouldDragVideoToSeek()).toBe(true);
    expect(settings.shouldHideVideoControls()).toBe(true);
    expect(settings.hasActiveVideoFeatures()).toBe(true);
  });

  it('forces effective hover visibility without overwriting its stored preference', () => {
    const settings = new SettingsManager();
    settings.updateSetting('showTimelineOnHover', false);
    settings.updateSetting('isTimelineSeekingEnabled', true);

    expect(settings.shouldShowTimelineOnHover()).toBe(true);
    expect(settings.getSettings().showTimelineOnHover).toBe(false);

    settings.updateSetting('isTimelineSeekingEnabled', false);
    expect(settings.shouldShowTimelineOnHover()).toBe(false);
    expect(settings.getSettings().showTimelineOnHover).toBe(false);
  });

  it('gates wheel actions and overlay activation with the Scroll parent', () => {
    const settings = new SettingsManager();
    settings.updateSetting('isScrollSeekingEnabled', false);
    settings.updateSetting('isPlayPauseWheelEnabled', true);
    settings.updateSetting('isTimelineSeekingEnabled', false);
    settings.updateSetting('dragVideoToSeek', false);
    settings.updateSetting('showTimelineOnHover', false);
    settings.updateSetting('hideVideoControls', false);

    expect(settings.isPlayPauseWheelEnabled()).toBe(false);
    expect(settings.hasActiveVideoFeatures()).toBe(false);
    expect(settings.shouldRun()).toBe(false);

    settings.updateSetting('hideVideoControls', true);
    expect(settings.hasActiveVideoFeatures()).toBe(true);
    expect(settings.shouldRun()).toBe(true);
  });

  it('gives an exact page rule priority over a broader host rule', () => {
    const settings = new SettingsManager();
    settings.updateSetting('domainRules', [
      createDomainRule('*', DomainModeE.On),
      createDomainRule('localhost', DomainModeE.On),
      createDomainRule(
        'localhost/app/2399420/Le_Mans_Ultimate/',
        DomainModeE.Off
      ),
    ]);

    window.history.replaceState({}, '', '/app/2399420/Le_Mans_Ultimate/');
    expect(settings.shouldRun()).toBe(false);

    window.history.replaceState({}, '', '/app/another-game/');
    expect(settings.shouldRun()).toBe(true);
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SliderResetButton } from './slider-reset-button';

afterEach(cleanup);

describe('SliderResetButton', () => {
  it.each([false, true])(
    'shows its tooltip when disabled is %s',
    async (disabled) => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <SliderResetButton
          disabled={disabled}
          label="Reset height to default"
          onClick={onClick}
        />
      );

      const button = screen.getByRole('button', {
        name: 'Reset height to default',
      }) as HTMLButtonElement;
      const trigger = button.parentElement as HTMLElement;

      expect(button.disabled).toBe(disabled);
      expect(button.getAttribute('title')).toBeNull();
      expect(trigger.tabIndex).toBe(disabled ? 0 : -1);

      await user.hover(trigger);
      const emphasizedText = await screen.findByText('Reset');
      expect(
        emphasizedText.closest('[data-slot="tooltip-content"]')?.textContent
      ).toBe('Reset height to default');
    }
  );
});

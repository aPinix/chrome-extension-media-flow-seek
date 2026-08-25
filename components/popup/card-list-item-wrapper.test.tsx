// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CardListItem } from './card-list-item';
import { CardListItemWrapper } from './card-list-item-wrapper';

afterEach(cleanup);

describe('CardListItemWrapper', () => {
  it('keeps a single visible row fully rounded when another row is omitted', () => {
    const Harness = ({ showDebug }: { showDebug: boolean }) => (
      <CardListItemWrapper>
        <CardListItem description="Only row" title="Extension" />
        {showDebug ? <CardListItem description="Hidden" title="Debug" /> : null}
      </CardListItemWrapper>
    );

    render(<Harness showDebug={false} />);

    const card = screen.getByText('Extension').closest('.card-list-item');
    expect(card?.className).toContain('rounded-xl');
    expect(card?.className).toContain('border');
    expect(card?.parentElement?.className).not.toContain('gap-0');
  });
});

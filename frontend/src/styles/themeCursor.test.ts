import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const themeCss = readFileSync(resolve(__dirname, 'theme.css'), 'utf8');

describe('global cursor affordances', () => {
  it('shows the hand cursor for clickable controls by default', () => {
    expect(themeCss).toMatch(/button:not\(:disabled\)/);
    expect(themeCss).toMatch(/a\[href\]/);
    expect(themeCss).toMatch(/cursor:\s*pointer/);
  });

  it('keeps disabled controls visibly non-clickable', () => {
    expect(themeCss).toMatch(/button:disabled/);
    expect(themeCss).toMatch(/\[aria-disabled=['"]true['"]\]/);
    expect(themeCss).toMatch(/cursor:\s*not-allowed/);
  });
});

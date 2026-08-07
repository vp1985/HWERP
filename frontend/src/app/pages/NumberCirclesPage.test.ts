import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routesSource = () => readFileSync(resolve(__dirname, '../routes.tsx'), 'utf8');

describe('NumberCirclesPage route contracts', () => {
  it('supports both technical and German admin paths for Nummernkreise', () => {
    const source = routesSource();

    expect(source).toContain("path: 'admin/number-circles', Component: NumberCirclesPage");
    expect(source).toContain("path: 'admin/nummernkreise', Component: NumberCirclesPage");
  });
});

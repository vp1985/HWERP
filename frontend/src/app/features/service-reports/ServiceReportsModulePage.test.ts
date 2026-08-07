import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'pages/ServiceReportsModulePage.tsx'), 'utf8');

describe('ServiceReportsModulePage source contracts', () => {
  it('wires report open buttons to a visible detail panel', () => {
    expect(source).toContain('const openReport = (report: ServiceReport) =>');
    expect(source).toContain('onClick={() => openReport(report)}');
    expect(source).toContain('Berichtsdetails');
  });

  it('keeps tab clicks synchronized with service routes', () => {
    expect(source).toContain('useNavigate');
    expect(source).toContain('navigate(pathForServiceTab(tab.key))');
  });

  it('renders validation errors before creating invalid reports', () => {
    expect(source).toContain('validateReportForm');
    expect(source).toContain('formErrors');
    expect(source).toContain('role="alert"');
  });
});

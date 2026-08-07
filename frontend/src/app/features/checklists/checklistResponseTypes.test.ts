import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const typesSource = () => readFileSync(resolve(process.cwd(), 'src/app/lib/types.ts'), 'utf8');
const migrationSource = () => readFileSync(resolve(process.cwd(), 'migrations/019_checklist_run_item_responses.sql'), 'utf8');

describe('general checklist response fields', () => {
  it('adds response type and choice data to template and run items', () => {
    const source = typesSource();

    expect(source).toContain("export type ChecklistResponseType = 'check' | 'yes_no' | 'multiple_choice'");
    expect(source).toContain('responseType: ChecklistResponseType;');
    expect(source).toContain('choiceOptions: string[];');
    expect(source).toContain('selectedChoice: string | null;');
    expect(source).toContain("| 'needs_clarification'");
  });

  it('persists response type, choices and clarification status in Postgres', () => {
    const source = migrationSource();

    expect(source).toContain('ALTER TABLE checklist_template_items');
    expect(source).toContain('response_type');
    expect(source).toContain('choice_options');
    expect(source).toContain('selected_choice');
    expect(source).toContain('needs_clarification');
  });
});

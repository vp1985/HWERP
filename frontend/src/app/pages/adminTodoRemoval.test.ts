import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');

describe('legacy admin todo kanban removal', () => {
  it('does not expose the old markdown todo board route or sidebar entry', () => {
    const routesSource = read('src/app/routes.tsx');
    const sidebarSource = read('src/app/components/Sidebar.tsx');

    expect(routesSource).not.toContain('AdminTodoPage');
    expect(routesSource).not.toContain('admin/todo');
    expect(sidebarSource).not.toContain('/admin/todo');
    expect(sidebarSource).not.toContain('Todo-Board');
  });

  it('does not mount the old markdown todos API', () => {
    const serverSource = read('server/index.ts');

    expect(serverSource).not.toContain('todosRouter');
    expect(serverSource).not.toContain('/api/todos');
  });

  it('removes the old todo board implementation and markdown store', () => {
    expect(existsSync(join(root, 'src/app/pages/AdminTodoPage.tsx'))).toBe(false);
    expect(existsSync(join(root, 'server/routes/todos.ts'))).toBe(false);
    expect(existsSync(join(root, 'todos'))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_SECTION_IDS,
  createCollapsedSidebarState,
  loadSidebarState,
  toggleSidebarSection,
} from './sidebarState';

describe('sidebar submenu state', () => {
  it('starts with every submenu collapsed when there is no saved state', () => {
    expect(createCollapsedSidebarState()).toEqual({
      kontakte: false,
      stammdaten: false,
      arbeitsvorbereitung: false,
      service: false,
      admin: false,
    });

    expect(loadSidebarState(null)).toEqual(createCollapsedSidebarState());
  });

  it('restores the last saved submenu state while defaulting missing sections to collapsed', () => {
    const restored = loadSidebarState(JSON.stringify({
      kontakte: true,
      service: true,
      unknown: true,
    }));

    expect(restored).toEqual({
      kontakte: true,
      stammdaten: false,
      arbeitsvorbereitung: false,
      service: true,
      admin: false,
    });
    expect(Object.keys(restored)).toEqual([...SIDEBAR_SECTION_IDS]);
  });

  it('toggles one submenu without opening the others', () => {
    const state = createCollapsedSidebarState();

    expect(toggleSidebarSection(state, 'kontakte')).toEqual({
      kontakte: true,
      stammdaten: false,
      arbeitsvorbereitung: false,
      service: false,
      admin: false,
    });
  });
});

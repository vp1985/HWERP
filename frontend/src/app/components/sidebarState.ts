export const SIDEBAR_SECTION_IDS = ['kontakte', 'stammdaten', 'arbeitsvorbereitung', 'service', 'admin'] as const;

export type SidebarSectionId = (typeof SIDEBAR_SECTION_IDS)[number];
export type SidebarExpandedState = Record<SidebarSectionId, boolean>;

export const SIDEBAR_STORAGE_KEY = 'hwerp.sidebar.expandedSections';
export const SIDEBAR_LAYOUT_MODE_STORAGE_KEY = 'hwerp.sidebar.layoutMode';
export type SidebarLayoutMode = 'expanded' | 'iconOnly';

export function loadSidebarLayoutMode(rawValue: string | null): SidebarLayoutMode {
  return rawValue === 'iconOnly' ? 'iconOnly' : 'expanded';
}

export function serializeSidebarLayoutMode(mode: SidebarLayoutMode): string {
  return mode;
}

export function toggleSidebarLayoutMode(mode: SidebarLayoutMode): SidebarLayoutMode {
  return mode === 'expanded' ? 'iconOnly' : 'expanded';
}

export function createCollapsedSidebarState(): SidebarExpandedState {
  return SIDEBAR_SECTION_IDS.reduce((state, sectionId) => {
    state[sectionId] = false;
    return state;
  }, {} as SidebarExpandedState);
}

export function loadSidebarState(rawValue: string | null): SidebarExpandedState {
  const state = createCollapsedSidebarState();

  if (!rawValue) {
    return state;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<Record<string, unknown>>;

    for (const sectionId of SIDEBAR_SECTION_IDS) {
      if (typeof parsed[sectionId] === 'boolean') {
        state[sectionId] = parsed[sectionId];
      }
    }
  } catch {
    return state;
  }

  return state;
}

export function toggleSidebarSection(
  state: SidebarExpandedState,
  sectionId: SidebarSectionId,
): SidebarExpandedState {
  return {
    ...state,
    [sectionId]: !state[sectionId],
  };
}

export function serializeSidebarState(state: SidebarExpandedState): string {
  return JSON.stringify(state);
}

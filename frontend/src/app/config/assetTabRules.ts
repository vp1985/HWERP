import { Tag } from '../types/tag';

/**
 * Asset Tab Rules - Zentrale Konfiguration für dynamische Tabs
 *
 * Motivation: Tags steuern, welche Zusatzbereiche bei einem Asset angezeigt werden.
 * Dies vermeidet aufgeblähte Formulare und ermöglicht flexible Asset-Klassen.
 *
 * Matching-Strategie:
 * - Bevorzugt tag.code (wenn gesetzt, schneller/stabiler)
 * - Fallback auf tag.name (wenn kein code vorhanden)
 *
 * Erweiterbarkeit: Neue Asset-Klassen einfach durch Hinzufügen einer Regel möglich.
 */

export interface AssetTabRule {
  tabId: string;          // Eindeutige ID für den Tab (Code Englisch)
  tabLabel: string;       // Anzeigename im Tab (Deutsch)
  matchCode?: string;     // Matcht auf tag.code (bevorzugt)
  matchName?: string;     // Matcht auf tag.name (fallback)
}

/**
 * MVP-Regeln für dynamische Tabs
 *
 * Diese Regeln werden erweitert, sobald konkrete Anforderungen für
 * Zusatzfelder bei bestimmten Asset-Typen bekannt sind.
 */
export const assetTabRules: AssetTabRule[] = [
  {
    tabId: 'trafo-data',
    tabLabel: 'Trafo-Daten',
    matchCode: 'Tx',
    matchName: 'Trafo',
  },
  {
    tabId: 'switchgear-data',
    tabLabel: 'Schaltanlage-Daten',
    matchName: 'Schaltanlage',
  },
  {
    tabId: 'circuit-breaker-data',
    tabLabel: 'Leistungsschalter-Daten',
    matchCode: 'LS',
    matchName: 'Leistungsschalter',
  },
];

/**
 * Ermittelt, welche dynamischen Tabs für die gegebenen Tag-IDs angezeigt werden sollen
 *
 * @param tagIds - Array der aktuell ausgewählten Tag-IDs
 * @param allTags - Vollständige Tag-Liste aus dem Store
 * @returns Array der anzuzeigenden Tab-Regeln
 */
export function getActiveTabsForAsset(
  tagIds: string[],
  allTags: Tag[]
): AssetTabRule[] {
  if (!tagIds.length) return [];

  // Ausgewählte Tags laden
  const selectedTags = allTags.filter((t) => tagIds.includes(t.id));

  // Matching durchführen
  const activeTabs: AssetTabRule[] = [];
  const addedTabIds = new Set<string>(); // Verhindert Duplikate

  for (const rule of assetTabRules) {
    const matches = selectedTags.some((tag) => {
      // Bevorzugt: Match auf code
      if (rule.matchCode && tag.code === rule.matchCode) {
        return true;
      }
      // Fallback: Match auf name
      if (rule.matchName && tag.name === rule.matchName) {
        return true;
      }
      return false;
    });

    if (matches && !addedTabIds.has(rule.tabId)) {
      activeTabs.push(rule);
      addedTabIds.add(rule.tabId);
    }
  }

  return activeTabs;
}

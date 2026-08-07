/**
 * AssetType Storage Layer
 *
 * DEV: Eigenständiger LocalStorage-Bereich für Asset-Typen.
 * Bewusst NICHT im Haupt-Repository (hwerp), da Asset-Typen ein
 * separates Admin-Modul sind und später eigenständig auf DB migriert werden.
 *
 * Alle Funktionen sind synchron (LocalStorage ist synchron).
 * Beim Wechsel auf eine DB-API müssen sie zu async umgebaut werden –
 * die Signatur ist deshalb schon jetzt als isolierte Fassade angelegt.
 */

import { uuid } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssetType {
  id: string;
  /** Eindeutiger technischer Code (lowercase, digits, underscore; startet mit Buchstabe). Immutable nach Anlage. */
  code: string;
  /** Anzeige-Label */
  label: string;
  /** Kurzbezeichnung / Kürzel für kompakte Darstellung */
  short: string | null;
  /** Referenz auf übergeordneten Typ (Hierarchie) */
  parentTypeId: string | null;
  /** Sortierreihenfolge (ASC, nulls last) */
  sortOrder: number | null;
  /** Optionaler Icon-Name (z.B. Lucide-Name) */
  icon: string | null;
  /** Soft-Delete / Deaktivierung */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'hwerp.assetTypes.v1';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadAll(): AssetType[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AssetType[];
  } catch {
    console.error('[assetTypeStorage] Failed to parse localStorage');
    return [];
  }
}

function saveAll(types: AssetType[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Alle Asset-Typen laden */
export function getAssetTypes(): AssetType[] {
  return loadAll();
}

/** Anlegen oder aktualisieren */
export function upsertAssetType(assetType: AssetType): void {
  const types = loadAll();
  const idx = types.findIndex((t) => t.id === assetType.id);
  const now = new Date().toISOString();

  if (idx >= 0) {
    // Update – code bleibt unverändert (immutable)
    types[idx] = {
      ...assetType,
      code: types[idx].code, // enforce immutability
      createdAt: types[idx].createdAt,
      updatedAt: now,
    };
  } else {
    types.push({
      ...assetType,
      createdAt: now,
      updatedAt: now,
    });
  }

  saveAll(types);
}

/** Deaktivieren (Soft-Delete) */
export function deactivateAssetType(id: string): void {
  const types = loadAll();
  const idx = types.findIndex((t) => t.id === id);
  if (idx >= 0) {
    types[idx].isActive = false;
    types[idx].updatedAt = new Date().toISOString();
    saveAll(types);
  }
}

/** Reaktivieren */
export function reactivateAssetType(id: string): void {
  const types = loadAll();
  const idx = types.findIndex((t) => t.id === id);
  if (idx >= 0) {
    types[idx].isActive = true;
    types[idx].updatedAt = new Date().toISOString();
    saveAll(types);
  }
}

/**
 * Seed-Daten einfügen, falls der Storage leer ist.
 * Wird einmalig beim ersten Laden der Seite aufgerufen.
 */
export function seedAssetTypesIfEmpty(): void {
  const existing = loadAll();
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const make = (
    code: string,
    label: string,
    short: string | null,
    parentTypeId: string | null,
    sortOrder: number
  ): AssetType => ({
    id: uuid(),
    code,
    label,
    short,
    parentTypeId,
    sortOrder,
    icon: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const trafo = make('trafo', 'Transformator', 'Trafo', null, 1);
  const trafo3w = make('trafo_3w', 'Transformator – Dreiwickler', 'Trafo 3W', trafo.id, 1);
  const leistungsschalter = make('leistungsschalter', 'Leistungsschalter', 'LS', null, 2);
  const trafostation = make('trafostation', 'Trafostation', 'TS', null, 3);
  const schaltanlageMv = make('schaltanlage_mv', 'Schaltanlage (MS)', 'SA MS', null, 4);
  const nshv = make('nshv', 'NSHV', 'NSHV', null, 5);

  saveAll([trafo, trafo3w, leistungsschalter, trafostation, schaltanlageMv, nshv]);
}

// ---------------------------------------------------------------------------
// Validation helpers (used by the UI)
// ---------------------------------------------------------------------------

/** Code-Format: lowercase, digits, underscore; muss mit Buchstabe beginnen */
export function isValidCode(code: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(code);
}

/** Prüft, ob der Code bereits vergeben ist (case-insensitive) */
export function isCodeUnique(code: string, excludeId?: string): boolean {
  const types = loadAll();
  return !types.some(
    (t) => t.code.toLowerCase() === code.toLowerCase() && t.id !== excludeId
  );
}

/**
 * Slugify: Label → Code-Vorschlag
 * Umlaute → ae/oe/ue/ss, Sonderzeichen → _, mehrfache _ → einer, trim
 */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

// ---------------------------------------------------------------------------
// Postgres-backed async store (used when API server is running)
// ---------------------------------------------------------------------------

export const pgAssetTypeStore = {
  getAll: (): Promise<AssetType[]> =>
    fetch('/api/asset-types').then((r) => r.json()),
  upsert: (type: AssetType): Promise<AssetType> =>
    fetch('/api/asset-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(type),
    }).then((r) => r.json()),
  deactivate: (id: string): Promise<void> =>
    fetch(`/api/asset-types/${id}/deactivate`, { method: 'PATCH' }).then(() => undefined),
  reactivate: (id: string): Promise<void> =>
    fetch(`/api/asset-types/${id}/reactivate`, { method: 'PATCH' }).then(() => undefined),
  seedIfEmpty: (): Promise<void> =>
    fetch('/api/asset-types/seed', { method: 'POST' }).then(() => undefined),
};

/**
 * Sammelt alle Nachfahren-IDs eines Typs (rekursiv).
 * Wird für Zirkelbezug-Prüfung im Parent-Dropdown benötigt.
 */
export function getDescendantIds(typeId: string, allTypes: AssetType[]): Set<string> {
  const descendants = new Set<string>();
  const collect = (parentId: string) => {
    allTypes
      .filter((t) => t.parentTypeId === parentId)
      .forEach((child) => {
        descendants.add(child.id);
        collect(child.id);
      });
  };
  collect(typeId);
  return descendants;
}

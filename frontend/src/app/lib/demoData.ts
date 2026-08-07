import { Material } from './types';
import { uuid } from './utils';

/**
 * Demo Data Factory für HWERP - Material Focus
 *
 * Schlanke Version mit 20 Demo-Materialien für das Material-Modul.
 * Assets, Kunden und Standorte werden separat in AdminTools generiert.
 */

/**
 * Erzeugt 20 Demo-Materialien mit realistischen Daten
 * Kategorien: Transformatoren, Schaltanlagen, Kabel, Zubehör
 */
export function createDemoMaterials(): Material[] {
  const now = new Date().toISOString();

  return [
    // Transformatoren (5)
    {
      id: uuid(),
      articleNumber: 'TRAFO-630-20',
      name: 'Transformator 630 kVA 20/0.4 kV',
      description: 'Öltransformator für Mittelspannung, luftgekühlt, ONAN',
      category: 'Transformatoren',
      manufacturer: 'Siemens',
      unit: 'Stück',
      price: 42500.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'TRAFO-1000-20',
      name: 'Transformator 1000 kVA 20/0.4 kV',
      description: 'Gießharztransformator, trocken, Schutzklasse IP00',
      category: 'Transformatoren',
      manufacturer: 'ABB',
      unit: 'Stück',
      price: 68900.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'TRAFO-1600-20',
      name: 'Transformator 1600 kVA 20/0.4 kV',
      description: 'Öltransformator hermetisch, biodegradables Öl',
      category: 'Transformatoren',
      manufacturer: 'Schneider Electric',
      unit: 'Stück',
      price: 89500.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'TRAFO-400-10',
      name: 'Transformator 400 kVA 10/0.4 kV',
      description: 'Kompakt-Trafo für Niederspannung, geräuscharm',
      category: 'Transformatoren',
      manufacturer: 'Siemens',
      unit: 'Stück',
      price: 28400.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'TRAFO-250-10',
      name: 'Transformator 250 kVA 10/0.4 kV',
      description: 'Gießharz-Kompakttrafo, wartungsfrei',
      category: 'Transformatoren',
      manufacturer: 'ABB',
      unit: 'Stück',
      price: 18750.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },

    // Schaltanlagen (5)
    {
      id: uuid(),
      articleNumber: 'SA-RMU-24KV-6F',
      name: 'Ring Main Unit 24 kV 6-Felder',
      description: 'SF6-Schaltanlage kompakt, 630A, mit Erdungsschalter',
      category: 'Schaltanlagen',
      manufacturer: 'Schneider Electric',
      unit: 'Stück',
      price: 35600.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'SA-GIS-36KV',
      name: 'GIS Schaltanlage 36 kV',
      description: 'Gasisolierte Schaltanlage, wartungsarm, Indoor',
      category: 'Schaltanlagen',
      manufacturer: 'ABB',
      unit: 'Stück',
      price: 124500.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'SA-AIS-12KV-3F',
      name: 'AIS Schaltanlage 12 kV 3-Felder',
      description: 'Luftisoliert, Outdoor-Ausführung, 1250A',
      category: 'Schaltanlagen',
      manufacturer: 'Siemens',
      unit: 'Stück',
      price: 42800.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'SA-COMPACT-20KV',
      name: 'Kompaktschaltanlage 20 kV',
      description: 'Modulares System, erweiterbar, SF6-frei',
      category: 'Schaltanlagen',
      manufacturer: 'Schneider Electric',
      unit: 'Stück',
      price: 28900.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'SA-DIST-10KV-2F',
      name: 'Verteilerschaltanlage 10 kV 2-Felder',
      description: 'Für Industrieanlagen, mit Schutzrelais',
      category: 'Schaltanlagen',
      manufacturer: 'ABB',
      unit: 'Stück',
      price: 19500.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },

    // Kabel & Leitungen (5)
    {
      id: uuid(),
      articleNumber: 'KBL-NAYY-4X150',
      name: 'Erdkabel NAYY 4x150 mm²',
      description: 'Niederspannungskabel 0.6/1 kV, kupfer',
      category: 'Kabel & Leitungen',
      manufacturer: 'Nexans',
      unit: 'Meter',
      price: 28.50,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'KBL-NA2XS2Y-3X240',
      name: 'Mittelspannungskabel NA2XS2Y 3x240 mm²',
      description: 'VPE-isoliert, 12/20 kV, Kupferleiter',
      category: 'Kabel & Leitungen',
      manufacturer: 'Prysmian',
      unit: 'Meter',
      price: 156.80,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'KBL-NYY-5X10',
      name: 'Steuerkabel NYY 5x10 mm²',
      description: 'Installationskabel 0.6/1 kV',
      category: 'Kabel & Leitungen',
      manufacturer: 'Lapp',
      unit: 'Meter',
      price: 8.20,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'KBL-HSLH-4X50',
      name: 'Halogenfreies Kabel HSLH 4x50 mm²',
      description: 'Flammwidrig, 0.6/1 kV, raucharm',
      category: 'Kabel & Leitungen',
      manufacturer: 'Helukabel',
      unit: 'Meter',
      price: 14.90,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'KBL-NYCWY-4X185',
      name: 'Erdkabel NYCWY 4x185 mm²',
      description: 'Wellmantel, 0.6/1 kV, für Dauerlast',
      category: 'Kabel & Leitungen',
      manufacturer: 'Nexans',
      unit: 'Meter',
      price: 34.70,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },

    // Zubehör & Kleinteile (5)
    {
      id: uuid(),
      articleNumber: 'ZUB-KLEMME-35MM',
      name: 'Kabelschuh 35 mm² verzinnt',
      description: 'Ringkabelschuh M10, Kupfer',
      category: 'Zubehör',
      manufacturer: 'Klauke',
      unit: 'Stück',
      price: 2.40,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'ZUB-MUFFE-150MM',
      name: 'Kabelmuffe 150 mm² 1 kV',
      description: 'Schrumpfmuffe 4-adrig, mit Füllmasse',
      category: 'Zubehör',
      manufacturer: '3M',
      unit: 'Stück',
      price: 68.50,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'ZUB-ERDUNGSBAND-30X3',
      name: 'Erdungsband CuZn 30x3 mm',
      description: 'Verzinkt, 25m Rolle',
      category: 'Zubehör',
      manufacturer: 'Dehn',
      unit: 'Meter',
      price: 4.80,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'ZUB-SICHERUNG-125A',
      name: 'NH-Sicherung 125A gL/gG',
      description: 'Größe 1, 500V AC, Keramik',
      category: 'Zubehör',
      manufacturer: 'Siemens',
      unit: 'Stück',
      price: 12.30,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      articleNumber: 'ZUB-SCHALTER-63A',
      name: 'Lasttrennschalter 63A 3-polig',
      description: 'Aufputz, IP65, mit Handgriff',
      category: 'Zubehör',
      manufacturer: 'ABB',
      unit: 'Stück',
      price: 89.00,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Platzhalter für weitere Demo-Daten (Assets, Kunden, etc.)
 * Diese werden über AdminTools separat generiert
 */
export function createDemoAssets() {
  return [];
}

export function createDemoCustomers() {
  return [];
}

export function createDemoLocations() {
  return [];
}

export function createDemoLocationCustomers() {
  return [];
}

export function createDemoContactPersons() {
  return [];
}

export function createDemoCustomerContactPersons() {
  return [];
}

export function createDemoLocationContactOverrides() {
  return [];
}

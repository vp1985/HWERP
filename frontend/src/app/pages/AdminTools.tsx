import { useState, useCallback } from 'react';
import { AlertTriangle, Trash2, Folder, Hash, Tag as TagIcon } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import DevTooltip from '../components/DevTooltip';
import Tooltip from '../components/Tooltip';
import TagPicker from '../components/TagPicker';
import { AssetNode, Customer } from '../lib/types';
import { Tag, TagContext } from '../types/tag';
import { uuid } from '../lib/utils';
import { useModalClose } from '../hooks/useModalClose';
import { createSyntheticCustomerFixtures, createSyntheticTransformerFixtures } from '../features/admin-tools/demoAssets';

// Verfügbare TagContexts für den Teststand
const TAG_CONTEXTS: { value: TagContext; label: string }[] = [
  { value: 'ASSETS', label: 'Assets' },
  { value: 'MATERIALS', label: 'Material' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'CALC_ITEMS', label: 'Kalk.-Positionen' },
  { value: 'CONTACTS', label: 'Kontakte' },
  { value: 'LOCATIONS', label: 'Standorte' },
];

export default function AdminTools() {
  const { repository, dispatch, state } = useAppStore();
  const [showResetStammdatenConfirm, setShowResetStammdatenConfirm] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [showDemoAssetsConfirm, setShowDemoAssetsConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // State für Kalkulationsnummern-Test
  const [generatedNumbers, setGeneratedNumbers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // State für TagPicker-Test
  const [testContext, setTestContext] = useState<TagContext>('ASSETS');
  const [testSelectedTagIds, setTestSelectedTagIds] = useState<string[]>([]);

  const handleCloseDemoAssetsConfirm = useCallback(() => setShowDemoAssetsConfirm(false), []);
  const handleCloseResetStammdatenConfirm = useCallback(() => setShowResetStammdatenConfirm(false), []);
  const handleCloseResetAllConfirm = useCallback(() => setShowResetAllConfirm(false), []);
  const handleDemoAssetsBackdropClick = useModalClose(showDemoAssetsConfirm, handleCloseDemoAssetsConfirm);
  const handleResetStammdatenBackdropClick = useModalClose(showResetStammdatenConfirm, handleCloseResetStammdatenConfirm);
  const handleResetAllBackdropClick = useModalClose(showResetAllConfirm, handleCloseResetAllConfirm);

  const handleResetStammdaten = async () => {
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      // Nur spezifische Entities löschen, nicht localStorage direkt manipulieren
      // Grund: Repository-Abstraktion ermöglicht späteren Wechsel zu Supabase
      await repository.clear('assets');
      await repository.clear('materials');
      await repository.clear('services');

      // State synchron halten mit Repository
      dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'materials', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'services', data: [] });

      setStatusMessage('✅ Stammdaten (Assets/Material/Services) wurden zurückgesetzt.');
      setShowResetStammdatenConfirm(false);
    } catch (error) {
      console.error('Failed to reset stammdaten:', error);
      setStatusMessage('❌ Fehler beim Zurücksetzen der Stammdaten.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAll = async () => {
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      // Kompletter Reset inkl. Metadata (nextCalcNumber)
      // Nutzt Repository-Methode statt direktem localStorage-Zugriff
      await repository.resetAll();

      // State komplett neu initialisieren
      dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'materials', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'services', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'tags', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'calculations', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'calculationDevices', data: [] });
      dispatch({ type: 'SET_ENTITIES', entity: 'calculationItems', data: [] });

      setStatusMessage('✅ Alle Daten wurden zurückgesetzt.');
      setShowResetAllConfirm(false);
    } catch (error) {
      console.error('Failed to reset all:', error);
      setStatusMessage('❌ Fehler beim Zurücksetzen aller Daten.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Erstellt Demo-Assets und Demo-Kunden inkl. Hierarchie und Tags
   *
   * Ablauf:
   * 1. Assets und Kunden vorher löschen (verhindert Duplikate)
   * 2. Benötigte Tags sicherstellen (TS, Tx, SA, LS)
   * 3. Demo-Assets mit Hierarchie anlegen
   * 4. Demo-Kunden anlegen (10 Stück)
   */
  const handleCreateDemoAssets = async () => {
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      // 1. Assets und Kunden vorher löschen
      await repository.clear('assets');
      await repository.clear('customers');

      // 2. Benötigte Tags sicherstellen
      const existingTags = await repository.list<Tag>('tags');

      // Tag-Hilfsfunktion: Finde oder erstelle Tag
      const ensureTag = async (name: string, code: string, color?: string): Promise<string> => {
        // Bevorzugt: Match auf code (case-insensitive)
        let tag = existingTags.find(
          (t) => t.code && t.code.toLowerCase() === code.toLowerCase()
        );

        // Fallback: Match auf name (case-insensitive)
        if (!tag) {
          tag = existingTags.find(
            (t) => t.name.toLowerCase() === name.toLowerCase()
          );
        }

        // Falls Tag nicht existiert: anlegen
        if (!tag) {
          const now = new Date().toISOString();
          const newTag: Tag = {
            id: uuid(),
            name,
            code,
            color,
            suggestedContexts: ['ASSETS'] as TagContext[],
            blockedContexts: [] as TagContext[],
            createdAt: now,
            updatedAt: now,
          };

          const saved = await repository.upsert<Tag>('tags', newTag);
          existingTags.push(saved); // Für spätere Lookups

          return saved.id;
        }

        return tag.id;
      };

      // Tags sicherstellen mit Farben
      const tagTS = await ensureTag('Trafostation', 'TS', '#3B82F6'); // Blau
      const tagTx = await ensureTag('Trafo', 'Tx', '#F59E0B'); // Orange
      const tagSA = await ensureTag('Schaltanlage', 'SA', '#10B981'); // Grün
      const tagLS = await ensureTag('Leistungsschalter', 'LS', '#EF4444'); // Rot

      // Tags in State aktualisieren
      const updatedTags = await repository.list<Tag>('tags');
      dispatch({ type: 'SET_ENTITIES', entity: 'tags', data: updatedTags });

      // 3. Demo-Assets erzeugen (ca. 16 Stück)
      const now = new Date().toISOString();
      const assets: AssetNode[] = [];

      // A) 13 Trafostationen (Root) - 3 bestehende + 10 neue
      const tsNord1: AssetNode = {
        id: uuid(),
        name: 'TS Nord 1',
        parentId: null,
        tagIds: [tagTS],
        notes: 'Demo',
        customerAssetId: 'KU-TS-N1',
        internalAssetId: 'TS-N1-001',
        buildYear: 2018,
        totalWeight: 3500,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsNord1);

      const tsNord2: AssetNode = {
        id: uuid(),
        name: 'TS Nord 2',
        parentId: null,
        tagIds: [tagTS],
        notes: 'Demo',
        customerAssetId: 'KU-TS-N2',
        internalAssetId: 'TS-N2-001',
        buildYear: 2020,
        totalWeight: 3200,
        manufacturer: 'ABB',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsNord2);

      const tsSued1: AssetNode = {
        id: uuid(),
        name: 'TS Süd 1',
        parentId: null,
        tagIds: [tagTS],
        notes: 'Demo',
        customerAssetId: 'KU-TS-S1',
        internalAssetId: 'TS-S1-001',
        buildYear: 2015,
        totalWeight: 3800,
        manufacturer: 'Schneider Electric',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsSued1);

      // 10 neue Trafostationen
      const tsWerkA: AssetNode = {
        id: uuid(),
        name: 'TS Werk A',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-WA-01',
        internalAssetId: 'TS-WA-001',
        buildYear: 2010,
        totalWeight: 4200,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsWerkA);

      const tsWerkB: AssetNode = {
        id: uuid(),
        name: 'TS Werk B',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-WB-01',
        internalAssetId: 'TS-WB-001',
        buildYear: 2012,
        totalWeight: 3900,
        manufacturer: 'ABB',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsWerkB);

      const tsHalle1: AssetNode = {
        id: uuid(),
        name: 'TS Halle 1',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-H1-01',
        internalAssetId: 'TS-H1-001',
        buildYear: 2008,
        totalWeight: 3600,
        manufacturer: 'Schneider Electric',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsHalle1);

      const tsHalle2: AssetNode = {
        id: uuid(),
        name: 'TS Halle 2',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-H2-01',
        internalAssetId: 'TS-H2-001',
        buildYear: 2014,
        totalWeight: 3700,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsHalle2);

      const tsLager: AssetNode = {
        id: uuid(),
        name: 'TS Lager',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-LG-01',
        internalAssetId: 'TS-LG-001',
        buildYear: 2016,
        totalWeight: 3300,
        manufacturer: 'ABB',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsLager);

      const tsVerwaltung: AssetNode = {
        id: uuid(),
        name: 'TS Verwaltung',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-VW-01',
        internalAssetId: 'TS-VW-001',
        buildYear: 2019,
        totalWeight: 3100,
        manufacturer: 'Schneider Electric',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsVerwaltung);

      const tsProduktion: AssetNode = {
        id: uuid(),
        name: 'TS Produktion',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-PR-01',
        internalAssetId: 'TS-PR-001',
        buildYear: 2017,
        totalWeight: 4500,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsProduktion);

      const tsOst: AssetNode = {
        id: uuid(),
        name: 'TS Ost',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-O-01',
        internalAssetId: 'TS-O-001',
        buildYear: 2013,
        totalWeight: 3400,
        manufacturer: 'ABB',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsOst);

      const tsWest: AssetNode = {
        id: uuid(),
        name: 'TS West',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-W-01',
        internalAssetId: 'TS-W-001',
        buildYear: 2011,
        totalWeight: 3550,
        manufacturer: 'Schneider Electric',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsWest);

      const tsZentrale: AssetNode = {
        id: uuid(),
        name: 'TS Zentrale',
        parentId: null,
        tagIds: [tagTS],
        customerAssetId: 'KU-Z-01',
        internalAssetId: 'TS-Z-001',
        buildYear: 2021,
        totalWeight: 3950,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(tsZentrale);

      // B) Je 1 Trafo als Kind der ersten 3 Trafostationen (Demo-Trafos)
      assets.push({
        id: uuid(),
        name: 'Tx 01',
        parentId: tsNord1.id,
        tagIds: [tagTx],
        notes: 'Demo',
        customerAssetId: 'KU-TX-01',
        internalAssetId: 'TX-001',
        buildYear: 2018,
        totalWeight: 2500,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Tx 02',
        parentId: tsNord2.id,
        tagIds: [tagTx],
        notes: 'Demo',
        customerAssetId: 'KU-TX-02',
        internalAssetId: 'TX-002',
        buildYear: 2020,
        totalWeight: 2400,
        manufacturer: 'ABB',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Tx 03',
        parentId: tsSued1.id,
        tagIds: [tagTx],
        notes: 'Demo',
        customerAssetId: 'KU-TX-03',
        internalAssetId: 'TX-003',
        buildYear: 2016,
        totalWeight: 2600,
        manufacturer: 'Schneider Electric',
        createdAt: now,
        updatedAt: now,
      });

      // C) Schaltanlage unter TS Nord 1
      const sa01: AssetNode = {
        id: uuid(),
        name: 'Schaltanlage Siemens 8DJH RRL',
        parentId: tsNord1.id,
        tagIds: [tagSA],
        notes: 'Demo',
        internalAssetId: 'SA-001',
        buildYear: 2019,
        totalWeight: 1200,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      };
      assets.push(sa01);

      // D) Leistungsschalter unter SA 01
      assets.push({
        id: uuid(),
        name: 'Leistungsschalter ABB VD4 24 kV',
        parentId: sa01.id,
        tagIds: [tagLS],
        notes: 'Demo',
        internalAssetId: 'LS-001',
        buildYear: 2019,
        totalWeight: 450,
        manufacturer: 'ABB',
        createdAt: now,
        updatedAt: now,
      });

      // E) Root-Geräte ohne Eltern (8 Stück)
      assets.push({
        id: uuid(),
        name: 'Tx A',
        parentId: null,
        tagIds: [tagTx],
        internalAssetId: 'TX-A-100',
        buildYear: 2021,
        totalWeight: 2700,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Tx B',
        parentId: null,
        tagIds: [tagTx],
        internalAssetId: 'TX-B-200',
        buildYear: 2022,
        totalWeight: 2550,
        manufacturer: 'ABB',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Tx C',
        parentId: null,
        tagIds: [tagTx],
        internalAssetId: 'TX-C-300',
        buildYear: 2017,
        totalWeight: 2800,
        manufacturer: 'Schneider Electric',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Schaltanlage Schneider Electric RM6',
        parentId: null,
        tagIds: [tagSA],
        internalAssetId: 'SA-A-100',
        buildYear: 2021,
        totalWeight: 1150,
        manufacturer: 'Schneider Electric',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Schaltanlage ABB SafeRing',
        parentId: null,
        tagIds: [tagSA],
        internalAssetId: 'SA-B-200',
        buildYear: 2023,
        totalWeight: 1100,
        manufacturer: 'ABB',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Schaltanlage Eaton Xiria',
        parentId: null,
        tagIds: [tagSA],
        internalAssetId: 'SA-C-300',
        buildYear: 2019,
        totalWeight: 1250,
        manufacturer: 'Eaton',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Leistungsschalter Siemens 3AH 12 kV',
        parentId: null,
        tagIds: [tagLS],
        internalAssetId: 'LS-A-100',
        buildYear: 2022,
        totalWeight: 420,
        manufacturer: 'Siemens',
        createdAt: now,
        updatedAt: now,
      });

      assets.push({
        id: uuid(),
        name: 'Leistungsschalter Schneider Electric Evolis 24 kV',
        parentId: null,
        tagIds: [tagLS],
        internalAssetId: 'LS-B-200',
        buildYear: 2020,
        totalWeight: 480,
        manufacturer: 'Schneider Electric',
        createdAt: now,
        updatedAt: now,
      });

      // F) Ausschließlich synthetische Transformator-Beispieldaten (24 Stück)
      const demoTransformers = createSyntheticTransformerFixtures([
        tsWerkA.id,
        tsWerkB.id,
        tsHalle1.id,
        tsHalle2.id,
        tsLager.id,
        tsVerwaltung.id,
        tsProduktion.id,
        tsOst.id,
        tsWest.id,
        tsZentrale.id,
        null,
      ]);

      demoTransformers.forEach((trafo) => {
        assets.push({
          id: uuid(),
          name: trafo.name,
          parentId: trafo.parentId || null,
          tagIds: [tagTx],
          internalAssetId: trafo.internalNumber,
          serialNumber: trafo.serialNumber,
          buildYear: trafo.buildYear,
          powerKva: trafo.powerKva,
          manufacturer: trafo.manufacturer,
          notes: '',
          createdAt: now,
          updatedAt: now,
        });
      });

      // Assets persistieren
      for (const asset of assets) {
        await repository.upsert<AssetNode>('assets', asset);
      }

      // 4. Ausschließlich synthetische Demo-Kunden erzeugen (10 Stück)
      const customers = createSyntheticCustomerFixtures(now, uuid);

      // Kunden persistieren
      for (const customer of customers) {
        await repository.upsert<Customer>('customers', customer);
      }

      // State aktualisieren
      const savedAssets = await repository.list<AssetNode>('assets');
      const savedCustomers = await repository.list<Customer>('customers');
      dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: savedAssets });
      dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: savedCustomers });

      setStatusMessage(`✅ Beispieldaten erstellt (${assets.length} Assets, ${customers.length} Kunden – vorher geleert).`);
      setShowDemoAssetsConfirm(false);
    } catch (error) {
      console.error('Failed to create demo assets:', error);
      setStatusMessage('❌ Fehler beim Erstellen der Beispieldaten.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Admin Tools</h1>
          <DevTooltip
            text="DEV: Diese Seite enthält Admin/Development-Tools. Alle Operationen nutzen das Repository-Interface (nicht direkt localStorage), damit später ein Wechsel zu Supabase ohne UI-Änderungen möglich ist."
            placement="right"
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          ⚠️ Development Tools – Änderungen sind dauerhaft
        </p>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">{statusMessage}</p>
        </div>
      )}

      {/* Beispieldaten Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Beispieldaten</h2>

        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">
                    Beispieldaten neu anlegen (Assets + Kunden)
                  </h3>
                  <Tooltip
                    text="Legt eine gemischte Teststruktur mit Trafostationen, Trafos, Schaltanlagen, Leistungsschaltern und 10 Beispiel-Kunden an."
                    placement="right"
                  />
                  <DevTooltip
                    text="DEV: Löscht vorher alle Assets und Kunden, um Duplikate zu vermeiden. Tags werden nur ergänzt, nicht gelöscht."
                    placement="right"
                  />
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Erzeugt 51 Demo-Assets mit hierarchischer Struktur:
                  <br />
                  • 13 Trafostationen (3 mit Demo-Trafos, 9 mit realen Trafos, 1 ohne Trafos)
                  <br />
                  • 1 Schaltanlage mit 1 Leistungsschalter
                  <br />
                  • 8 weitere Root-Geräte (Trafos, Schaltanlagen, Leistungsschalter)
                  <br />
                  • 24 synthetische Demo-Transformatoren (10 mit Parent, 14 Root-Level)
                  <br />
                  <br />
                  Zusätzlich 10 Demo-Kunden (Energieversorger, Elektrofirmen, etc.)
                  <br />
                  <br />
                  <strong>Vorher werden alle bestehenden Assets und Kunden gelöscht.</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDemoAssetsConfirm(true)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Folder size={18} />
              Beispieldaten neu anlegen
            </button>
          </div>
        </div>
      </div>

      {/* Kalkulationsnummern-Generator */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Hash size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold">Kalkulationsnummern-Generator</h2>
          <DevTooltip
            text="DEV: Testet getNextCalcNumber() aus dem Repository. Jeder Klick inkrementiert den Zähler (meta.nextCalcNumber) im localStorage-Root 'hwerp' und gibt das Format K-XXXXXX zurück. ACHTUNG: Generierte Nummern werden verbraucht – nach 'Reset Alles' startet der Zähler wieder bei K-000001."
            placement="right"
          />
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Generiert fortlaufende Kalkulationsnummern im Format <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">K-000001</code>.
          Jede generierte Nummer wird dauerhaft verbraucht.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={async () => {
              setIsGenerating(true);
              try {
                const num = await repository.getNextCalcNumber();
                setGeneratedNumbers(prev => [num, ...prev]);
              } catch (error) {
                console.error('Failed to generate calc number:', error);
                setStatusMessage('❌ Fehler beim Generieren der Kalkulationsnummer.');
              } finally {
                setIsGenerating(false);
              }
            }}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Hash size={16} />
            {isGenerating ? 'Generiere...' : 'Nächste Nummer generieren'}
          </button>
          {generatedNumbers.length > 0 && (
            <button
              onClick={() => setGeneratedNumbers([])}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Log leeren
            </button>
          )}
        </div>

        {generatedNumbers.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <span className="text-xs text-gray-500 font-medium">
                Generierte Nummern ({generatedNumbers.length}) – neueste zuerst
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {generatedNumbers.map((num, index) => (
                <div
                  key={`${num}-${index}`}
                  className={`px-4 py-2 text-sm font-mono flex items-center gap-2 ${
                    index === 0
                      ? 'bg-green-50 text-green-800 font-semibold'
                      : 'text-gray-700 border-t border-gray-100'
                  }`}
                >
                  {index === 0 && <span className="text-green-600">→</span>}
                  {num}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TagPicker-Teststand */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <TagIcon size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold">TagPicker-Teststand</h2>
          <DevTooltip
            text="DEV: Interaktiver Test für die TagPicker-Komponente. Context-Umschaltung zeigt, wie blockedContexts Tags ausblenden und suggestedContexts Tags priorisieren. Bereits ausgewählte, dann blockierte Tags bleiben mit 'gesperrt'-Badge sichtbar."
            placement="right"
          />
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Testet die context-aware Tag-Auswahl. Wechsle den Kontext, um zu sehen, wie sich die verfügbaren Tags ändern.
          {(state.tags as Tag[])?.length === 0 && (
            <span className="block mt-1 text-orange-600">
              ⚠ Keine Tags vorhanden – lege zuerst Tags unter <strong>Stammdaten → Tags</strong> an oder nutze „Beispieldaten neu anlegen\".
            </span>
          )}
        </p>

        {/* Context-Auswahl */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Kontext</label>
          <div className="flex flex-wrap gap-2">
            {TAG_CONTEXTS.map((ctx) => (
              <button
                key={ctx.value}
                onClick={() => {
                  setTestContext(ctx.value);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  testContext === ctx.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {ctx.label}
              </button>
            ))}
          </div>
        </div>

        {/* TagPicker */}
        <div className="mb-4">
          <TagPicker
            context={testContext}
            selectedTagIds={testSelectedTagIds}
            onChange={setTestSelectedTagIds}
            placeholder="Tags suchen oder auswählen..."
            label={`Tags für Kontext „${TAG_CONTEXTS.find(c => c.value === testContext)?.label}“`}
            showTooltip={true}
          />
        </div>

        {/* Debug-Ausgabe */}
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500">Debug-Info</span>
            <DevTooltip
              text="DEV: Zeigt die gespeicherten tagIds. In echten Entities werden genau diese IDs in das tagIds-Array geschrieben. Der TagPicker resolves die IDs zur Anzeige über den Tag-Katalog im State."
              placement="right"
            />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">Kontext:</span>{' '}
              <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs font-mono">{testContext}</code>
            </div>
            <div>
              <span className="text-gray-500">Anzahl Tags:</span>{' '}
              <span className="font-medium">{testSelectedTagIds.length}</span>
            </div>
            <div className="col-span-2 mt-1">
              <span className="text-gray-500">tagIds:</span>{' '}
              <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs font-mono break-all">
                {testSelectedTagIds.length > 0
                  ? `[${testSelectedTagIds.map(id => `"${id.slice(0, 8)}…"`).join(', ')}]`
                  : '[]'}
              </code>
            </div>
          </div>
          {testSelectedTagIds.length > 0 && (
            <button
              onClick={() => setTestSelectedTagIds([])}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Auswahl zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Reset Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Reset</h2>

        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">
                    Reset Stammdaten (Assets/Material/Services)
                  </h3>
                  <DevTooltip
                    text="DEV: Löscht nur Assets/Material/Services für schnelle Tests. Tags und Nummern-Zähler bleiben, damit Tag-Auswahl und Nummernlogik stabil getestet werden können."
                    placement="right"
                  />
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Löscht nur Assets, Material und Services.
                  <br />
                  <strong>Tags</strong> und <strong>Kalkulationsnummer</strong> bleiben erhalten.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowResetStammdatenConfirm(true)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <Trash2 size={18} />
              Reset Stammdaten
            </button>
          </div>

          <div className="border border-red-300 rounded-lg p-4 bg-red-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg text-red-800">
                    Reset Alles (inkl. Tags)
                  </h3>
                  <DevTooltip
                    text="DEV: Löscht ALLE Daten inkl. Tags und setzt nextCalcNumber=1. Nur für Entwicklungszwecke. Später entfernen oder hinter Admin-Auth schützen."
                    placement="right"
                  />
                </div>
                <p className="text-sm text-red-700 mb-4">
                  <strong>⚠️ ACHTUNG:</strong> Löscht ALLE Daten:
                  <br />
                  Kunden, Assets, Material, Services, Tags, Kalkulationen
                  <br />
                  Kalkulationsnummer wird auf 1 zurückgesetzt.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowResetAllConfirm(true)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <AlertTriangle size={18} />
              Reset Alles
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Dialog: Demo Assets */}
      {showDemoAssetsConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDemoAssetsBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Beispieldaten anlegen?</h2>
            <p className="text-gray-600 mb-6">
              Alle bestehenden <strong>Assets und Kunden</strong> werden gelöscht und danach werden ca. 16 Beispiel-Assets und 10 Beispiel-Kunden angelegt. Fortfahren?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDemoAssetsConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateDemoAssets}
                disabled={isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Erstelle...' : 'Fortfahren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog: Reset Stammdaten */}
      {showResetStammdatenConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleResetStammdatenBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Reset Stammdaten?</h2>
            <p className="text-gray-600 mb-6">
              Möchten Sie wirklich <strong>Assets, Material und Services</strong> löschen?
              <br />
              <br />
              Tags und die Kalkulationsnummer bleiben erhalten.
              <br />
              <br />
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetStammdatenConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleResetStammdaten}
                disabled={isProcessing}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Wird gelöscht...' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog: Reset All */}
      {showResetAllConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleResetAllBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-600" size={24} />
              <h2 className="text-xl font-bold text-red-800">Reset ALLES?</h2>
            </div>
            <p className="text-gray-600 mb-6">
              <strong className="text-red-600">⚠️ ACHTUNG:</strong>
              <br />
              <br />
              Dies löscht <strong>ALLE</strong> Daten:
              <br />
              • Kunden
              <br />
              • Assets
              <br />
              • Material
              <br />
              • Services
              <br />
              • Tags
              <br />
              • Kalkulationen
              <br />
              <br />
              Die Kalkulationsnummer wird auf 1 zurückgesetzt.
              <br />
              <br />
              <strong>Diese Aktion kann nicht rückgängig gemacht werden!</strong>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetAllConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleResetAll}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Wird gelöscht...' : 'Ja, ALLES löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

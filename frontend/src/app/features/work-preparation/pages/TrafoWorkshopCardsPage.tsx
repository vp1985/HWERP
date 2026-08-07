import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Hash, Plus, QrCode, Smartphone, Timer } from 'lucide-react';
import { useAppStore } from '../../../context/AppStoreContext';
import {
  DEFAULT_NUMBER_RANGES,
  EditableNumberRangeConfig,
  loadNumberRangesFromStorage,
  saveNumberRangesToStorage,
} from '../../../lib/numberRangeUtils';
import type {
  ChecklistRun,
  ChecklistRunItem,
  ChecklistRunLink,
  ChecklistTemplate,
  ChecklistTemplateGroup,
  ChecklistTemplateItem,
  Service,
  WorkshopCard,
  WorkshopCardTask,
} from '../../../lib/types';
import {
  createChecklistRunFromTemplate,
  getChecklistTemplatesForService,
} from '../../checklists/checklists';
import {
  buildNextWorkshopCardNumber,
  calculateWorkshopCardTotalMinutes,
  formatWorkshopMinutes,
  makeInitialWorkshopCardTasks,
  reserveNextWorkshopCardNumber,
} from '../workshopCards';

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeQrCodeToken(cardNumber: string): string {
  return `wk-${cardNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

const statusLabels: Record<WorkshopCard['status'], string> = {
  draft: 'Entwurf',
  prepared: 'vorbereitet',
  in_progress: 'in Arbeit',
  done: 'fertig',
  checked: 'geprüft',
  archived: 'archiviert',
};

export default function TrafoWorkshopCardsPage() {
  const { repository, dispatch } = useAppStore();
  const [cards, setCards] = useState<WorkshopCard[]>([]);
  const [tasks, setTasks] = useState<WorkshopCardTask[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [checklistTemplateGroups, setChecklistTemplateGroups] = useState<ChecklistTemplateGroup[]>([]);
  const [checklistTemplateItems, setChecklistTemplateItems] = useState<ChecklistTemplateItem[]>([]);
  const [numberRanges, setNumberRanges] = useState<EditableNumberRangeConfig[]>(() =>
    typeof window === 'undefined' ? DEFAULT_NUMBER_RANGES : loadNumberRangesFromStorage(),
  );
  const [orderNumber, setOrderNumber] = useState('');
  const [transformerSearch, setTransformerSearch] = useState('');
  const [selectedCardChecklistTemplateIds, setSelectedCardChecklistTemplateIds] = useState<string[]>([]);
  const [lastCreatedNumber, setLastCreatedNumber] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      const [nextCards, nextServices, nextTasks, nextChecklistTemplates, nextChecklistGroups, nextChecklistItems] = await Promise.all([
        repository.list<WorkshopCard>('workshopCards'),
        repository.list<Service>('services'),
        repository.list<WorkshopCardTask>('workshopCardTasks'),
        repository.list<ChecklistTemplate>('checklistTemplates'),
        repository.list<ChecklistTemplateGroup>('checklistTemplateGroups'),
        repository.list<ChecklistTemplateItem>('checklistTemplateItems'),
      ]);

      if (!active) return;
      setCards(nextCards);
      setServices(nextServices);
      setTasks(nextTasks);
      setChecklistTemplates(nextChecklistTemplates);
      setChecklistTemplateGroups(nextChecklistGroups);
      setChecklistTemplateItems(nextChecklistItems);
    }

    loadData();
    return () => {
      active = false;
    };
  }, [repository]);

  const nextCardNumber = useMemo(() => buildNextWorkshopCardNumber(numberRanges), [numberRanges]);
  const activeCardChecklistTemplates = checklistTemplates.filter((template) => template.status === 'active');

  const toggleCardChecklistTemplate = (templateId: string) => {
    setSelectedCardChecklistTemplateIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId],
    );
  };

  const createWorkshopCard = async () => {
    const reserved = reserveNextWorkshopCardNumber(numberRanges);
    const now = new Date().toISOString();
    const card: WorkshopCard = {
      id: newUuid(),
      cardNumber: reserved.cardNumber,
      title: `Auftrag + Trafo ${transformerSearch || reserved.cardNumber}`,
      orderNumber: orderNumber.trim(),
      assetId: null,
      customerId: null,
      status: 'draft',
      assigneeCodes: [],
      qrCodeToken: makeQrCodeToken(reserved.cardNumber),
      notes: transformerSearch.trim() ? `Trafo-Suche: ${transformerSearch.trim()}` : null,
      createdAt: now,
      updatedAt: now,
    };
    const initialTasks = makeInitialWorkshopCardTasks(card.id, services, now);
    const servicesForTasks = services.filter((service) =>
      (service.active ?? true) && service.availableInWorkshopCards,
    );
    const cardTemplateById = new Map(checklistTemplates.map((template) => [template.id, template]));
    const checklistRunsToCreate = [
      ...selectedCardChecklistTemplateIds
        .map((templateId) => cardTemplateById.get(templateId))
        .filter((template): template is ChecklistTemplate => Boolean(template))
        .map((template) => ({
          template,
          links: [{ targetType: 'workshop_card' as const, targetId: card.id }],
        })),
      ...servicesForTasks.flatMap((service) =>
        getChecklistTemplatesForService(service, checklistTemplates).map((template) => ({
          template,
          links: [
            { targetType: 'workshop_card' as const, targetId: card.id },
            { targetType: 'service' as const, targetId: service.id },
          ],
        })),
      ),
    ].map(({ template, links }) =>
      createChecklistRunFromTemplate({
        template,
        groups: checklistTemplateGroups.filter((group) => group.templateId === template.id),
        items: checklistTemplateItems.filter((item) => item.templateId === template.id),
        links,
        now,
        idFactory: newUuid,
      }),
    );

    const createdCard = await repository.create<WorkshopCard>('workshopCards', card);
    const createdTasks = await Promise.all(
      initialTasks.map((task) => repository.create<WorkshopCardTask>('workshopCardTasks', task)),
    );
    const createdChecklistRuns = await Promise.all(
      checklistRunsToCreate.map(({ run }) => repository.create<ChecklistRun>('checklistRuns', run)),
    );
    const createdChecklistRunLinks = await Promise.all(
      checklistRunsToCreate.flatMap(({ links }) =>
        links.map((link) => repository.create<ChecklistRunLink>('checklistRunLinks', link)),
      ),
    );
    const createdChecklistRunItems = await Promise.all(
      checklistRunsToCreate.flatMap(({ runItems }) =>
        runItems.map((item) => repository.create<ChecklistRunItem>('checklistRunItems', item)),
      ),
    );

    saveNumberRangesToStorage(reserved.numberRanges);
    setNumberRanges(reserved.numberRanges);
    setCards((current) => [createdCard, ...current]);
    setTasks((current) => [...createdTasks, ...current]);
    dispatch({ type: 'ADD_ENTITY', entity: 'workshopCards', data: createdCard });
    createdTasks.forEach((task) => dispatch({ type: 'ADD_ENTITY', entity: 'workshopCardTasks', data: task }));
    createdChecklistRuns.forEach((run) => dispatch({ type: 'ADD_ENTITY', entity: 'checklistRuns', data: run }));
    createdChecklistRunLinks.forEach((link) => dispatch({ type: 'ADD_ENTITY', entity: 'checklistRunLinks', data: link }));
    createdChecklistRunItems.forEach((item) => dispatch({ type: 'ADD_ENTITY', entity: 'checklistRunItems', data: item }));
    setLastCreatedNumber(createdCard.cardNumber);
    setOrderNumber('');
    setTransformerSearch('');
    setSelectedCardChecklistTemplateIds([]);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Arbeitsvorbereitung</p>
          <h1 className="text-2xl font-bold text-gray-900">Trafo-Werkstattkarten</h1>
          <p className="mt-1 text-sm text-gray-600">Auftrag + Trafo auswählen, Leistungen vorbereiten, Werkstatt digital oder per Druck führen.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-900">
          <Hash size={18} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Nächste Werkstattkarte</p>
            <p className="font-mono text-lg font-bold">{nextCardNumber}</p>
          </div>
        </div>
      </div>

      {lastCreatedNumber && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          ✓ Werkstattkarte {lastCreatedNumber} angelegt.
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="text-blue-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-900">Neue Karte</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder="Auftragsnummer"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <input
            value={transformerSearch}
            onChange={(event) => setTransformerSearch(event.target.value)}
            placeholder="Trafo-Nr. / Seriennummer suchen"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={createWorkshopCard}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Nummer übernehmen
          </button>
        </div>
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-800">Werkstattkarten-Checklisten</p>
          <p className="mt-1 text-xs text-gray-500">Für die ganze Karte auswählen; Leistungs-Checklisten werden automatisch aus den gewählten Leistungen erzeugt.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {activeCardChecklistTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">Keine aktiven Checklisten-Vorlagen vorhanden.</p>
            ) : activeCardChecklistTemplates.map((template) => (
              <label key={template.id} className="flex items-center gap-2 rounded border bg-white px-2 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedCardChecklistTemplateIds.includes(template.id)}
                  onChange={() => toggleCardChecklistTemplate(template.id)}
                />
                {template.name}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><Timer size={18} /> Gesamtzeit</div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatWorkshopMinutes(calculateWorkshopCardTotalMinutes(tasks))}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><Smartphone size={18} /> Werkstatt</div>
          <p className="mt-2 text-sm text-gray-600">Mitarbeiterkürzel, Zeiten, Fotos und Unterschrift je Leistung.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><QrCode size={18} /> QR-Code</div>
          <p className="mt-2 text-sm text-gray-600">Druckkarte führt zurück zur digitalen Karte.</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Aktuelle Werkstattkarten</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {cards.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">Noch keine Trafo-Werkstattkarten angelegt.</p>
          ) : (
            cards.map((card) => (
              <div key={card.id} className="grid gap-2 px-5 py-4 md:grid-cols-[160px_1fr_120px] md:items-center">
                <span className="font-mono text-sm font-semibold text-blue-700">{card.cardNumber}</span>
                <span className="text-sm text-gray-900">{card.title}</span>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-center text-xs font-medium text-gray-700">{statusLabels[card.status]}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Boxes, FileText, PackagePlus, Plus, Wrench } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import type { ChecklistTemplate, Material, Service, ServicePackage, ServicePackageItem, ServicePackagePriceMode } from '../lib/types';
import {
  buildServicePackageInfoItem,
  buildServicePackageItemFromMaterial,
  buildServicePackageItemFromService,
  calculateServicePackagePrice,
  sortServicePackageItems,
} from '../lib/servicePackageUtils';

function nextPackageNumber(packages: ServicePackage[]): string {
  const next = packages.length + 1;
  return `LP${String(next).padStart(5, '0')}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyPackage(packages: ServicePackage[]): ServicePackage {
  const now = nowIso();
  return {
    id: newId(),
    packageNumber: nextPackageNumber(packages),
    name: 'Neues Leistungspaket',
    description: null,
    category: null,
    active: true,
    priceMode: 'sum',
    fixedPrice: null,
    hintText: '',
    customerNote: '',
    checklistTemplateIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function ServicePackagesPage() {
  const { repository, dispatch } = useAppStore();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [items, setItems] = useState<ServicePackageItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [hintText, setHintText] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      const [nextPackages, nextItems, nextServices, nextMaterials, nextChecklistTemplates] = await Promise.all([
        repository.list<ServicePackage>('servicePackages'),
        repository.list<ServicePackageItem>('servicePackageItems'),
        repository.list<Service>('services'),
        repository.list<Material>('materials'),
        repository.list<ChecklistTemplate>('checklistTemplates'),
      ]);
      if (!active) return;
      setPackages(nextPackages);
      setItems(nextItems);
      setServices(nextServices);
      setMaterials(nextMaterials);
      setChecklistTemplates(nextChecklistTemplates);
      dispatch({ type: 'SET_ENTITIES', entity: 'servicePackages', data: nextPackages });
      dispatch({ type: 'SET_ENTITIES', entity: 'servicePackageItems', data: nextItems });
      dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplates', data: nextChecklistTemplates });
      setSelectedPackageId((current) => current ?? nextPackages[0]?.id ?? null);
    }

    loadData();
    return () => {
      active = false;
    };
  }, [repository, dispatch]);

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );

  const packageItems = useMemo(
    () => sortServicePackageItems(items.filter((item) => item.packageId === selectedPackageId)),
    [items, selectedPackageId],
  );

  const packagePrice = selectedPackage ? calculateServicePackagePrice(selectedPackage, packageItems) : 0;
  const activeChecklistTemplates = checklistTemplates.filter((template) => template.status === 'active');

  async function createPackage() {
    const draft = createEmptyPackage(packages);
    const saved = await repository.create<ServicePackage>('servicePackages', draft);
    setPackages((current) => [...current, saved]);
    setSelectedPackageId(saved.id);
    dispatch({ type: 'ADD_ENTITY', entity: 'servicePackages', data: saved });
  }

  async function updatePackage(patch: Partial<ServicePackage>) {
    if (!selectedPackage) return;
    const updated: ServicePackage = { ...selectedPackage, ...patch, updatedAt: nowIso() };
    await repository.update<ServicePackage>('servicePackages', updated.id, updated);
    setPackages((current) => current.map((pkg) => (pkg.id === updated.id ? updated : pkg)));
    dispatch({ type: 'UPDATE_ENTITY', entity: 'servicePackages', data: updated });
  }

  async function togglePackageChecklistTemplate(templateId: string) {
    if (!selectedPackage) return;
    const currentIds = selectedPackage.checklistTemplateIds ?? [];
    await updatePackage({
      checklistTemplateIds: currentIds.includes(templateId)
        ? currentIds.filter((id) => id !== templateId)
        : [...currentIds, templateId],
    });
  }

  async function addItem(item: ServicePackageItem) {
    const saved = await repository.create<ServicePackageItem>('servicePackageItems', {
      ...item,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    setItems((current) => [...current, saved]);
    dispatch({ type: 'ADD_ENTITY', entity: 'servicePackageItems', data: saved });
  }

  async function addService() {
    if (!selectedPackage) return;
    const service = services.find((entry) => entry.id === serviceId);
    if (!service) return;
    await addItem(buildServicePackageItemFromService(service, selectedPackage.id, 1, packageItems.length * 100 + 100));
    setServiceId('');
  }

  async function addMaterial() {
    if (!selectedPackage) return;
    const material = materials.find((entry) => entry.id === materialId);
    if (!material) return;
    await addItem(buildServicePackageItemFromMaterial(material, selectedPackage.id, 1, packageItems.length * 100 + 100));
    setMaterialId('');
  }

  async function addHintText() {
    if (!selectedPackage || !hintText.trim()) return;
    await addItem(buildServicePackageInfoItem(hintText, selectedPackage.id, packageItems.length * 100 + 100));
    setHintText('');
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leistungspakete</h1>
          <p className="text-sm text-gray-600">Wiederverwendbare Pakete aus Leistungen, Material und Hinweistexten.</p>
        </div>
        <button onClick={createPackage} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <PackagePlus size={16} />
          Leistungspaket anlegen
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border bg-white p-3 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Pakete</h2>
          <div className="space-y-2">
            {packages.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Leistungspakete angelegt.</p>
            ) : packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackageId(pkg.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${pkg.id === selectedPackageId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
              >
                <span className="block font-medium">{pkg.name}</span>
                <span className="text-xs text-gray-500">{pkg.packageNumber}</span>
              </button>
            ))}
          </div>
        </aside>

        {selectedPackage ? (
          <section className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Name
                <input value={selectedPackage.name} onChange={(event) => updatePackage({ name: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Kategorie
                <input value={selectedPackage.category ?? ''} onChange={(event) => updatePackage({ category: event.target.value || null })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Interner Hinweis
                <textarea value={selectedPackage.hintText ?? ''} onChange={(event) => updatePackage({ hintText: event.target.value })} className="mt-1 h-20 w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Kundentext
                <textarea value={selectedPackage.customerNote ?? ''} onChange={(event) => updatePackage({ customerNote: event.target.value })} className="mt-1 h-20 w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Preislogik
                <select value={selectedPackage.priceMode} onChange={(event) => updatePackage({ priceMode: event.target.value as ServicePackagePriceMode })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="sum">Summe aus Positionen</option>
                  <option value="fixed">Paket-Festpreis</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Paket-Festpreis
                <input type="number" value={selectedPackage.fixedPrice ?? ''} onChange={(event) => updatePackage({ fixedPrice: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Paket-Checklisten</h3>
                  <p className="text-xs text-gray-500">Diese Vorlagen hängen am gesamten Leistungspaket; Leistungs-Checklisten aus enthaltenen Leistungen kommen zusätzlich dazu.</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs text-gray-600">{selectedPackage.checklistTemplateIds?.length ?? 0} aktiv</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {activeChecklistTemplates.length === 0 ? (
                  <p className="text-sm text-gray-500">Keine aktiven Checklisten-Vorlagen vorhanden.</p>
                ) : activeChecklistTemplates.map((template) => (
                  <label key={template.id} className="flex items-center gap-2 rounded border bg-white px-2 py-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={(selectedPackage.checklistTemplateIds ?? []).includes(template.id)}
                      onChange={() => togglePackageChecklistTemplate(template.id)}
                    />
                    <span>{template.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border bg-gray-50 p-3 lg:grid-cols-3">
              <div className="flex gap-2">
                <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-sm">
                  <option value="">Leistung auswählen</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
                <button onClick={addService} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">
                  <Wrench size={14} /> Leistung hinzufügen
                </button>
              </div>
              <div className="flex gap-2">
                <select value={materialId} onChange={(event) => setMaterialId(event.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-sm">
                  <option value="">Material auswählen</option>
                  {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                </select>
                <button onClick={addMaterial} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">
                  <Boxes size={14} /> Material hinzufügen
                </button>
              </div>
              <div className="flex gap-2">
                <input value={hintText} onChange={(event) => setHintText(event.target.value)} placeholder="Hinweistext" className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-sm" />
                <button onClick={addHintText} className="inline-flex items-center gap-1 rounded-lg bg-slate-600 px-3 py-2 text-sm text-white">
                  <FileText size={14} /> Hinweistext hinzufügen
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[72px_120px_1fr_80px_80px] bg-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span>Sort</span><span>Typ</span><span>Beschreibung</span><span>Menge</span><span>Preis</span>
              </div>
              {packageItems.length === 0 ? (
                <p className="px-3 py-6 text-sm text-gray-500">Noch keine Positionen im Paket.</p>
              ) : packageItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[72px_120px_1fr_80px_80px] border-t px-3 py-2 text-sm">
                  <span className="text-gray-400">{item.sortOrder}</span>
                  <span>{item.type === 'service' ? 'Leistung' : item.type === 'material' ? 'Material' : 'Hinweistext'}</span>
                  <span className={item.type === 'info' ? 'italic text-gray-600' : ''}>{item.descriptionSnapshot}</span>
                  <span>{item.type === 'info' ? '—' : `${item.quantity} ${item.unitSnapshot}`}</span>
                  <span>{item.type === 'info' ? '—' : item.unitPriceSnapshot.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              ))}
            </div>

            <div className="text-right text-sm font-semibold text-gray-800">
              Paketwert: {packagePrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border bg-white p-8 text-center text-gray-500 shadow-sm">
            Bitte ein Leistungspaket anlegen.
          </section>
        )}
      </div>
    </main>
  );
}

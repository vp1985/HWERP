import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Camera, CheckCircle2, Clock3, Eye, FileText, PackagePlus, Sparkles, TriangleAlert } from 'lucide-react';
import { demoIncomingProducts } from '../data/demoData';
import type { IncomingProductIngestion, RecognitionJob } from '../types';
import { deriveIngestionSummary, photoLabelText, visibleJobStatus } from '../utils';

export default function IncomingProductsPage() {
  const [ingestions, setIngestions] = useState<IncomingProductIngestion[]>(demoIncomingProducts);
  const [selectedId, setSelectedId] = useState(ingestions[0]?.id ?? '');
  const selected = ingestions.find((item) => item.id === selectedId) ?? ingestions[0];
  const now = useMemo(() => new Date().toISOString(), []);

  const requestVision = (ingestionId: string) => {
    setIngestions((current) => current.map((ingestion) => {
      if (ingestion.id !== ingestionId) return ingestion;
      const hasVisionJob = ingestion.jobs.some((job) => job.kind === 'vision');
      const nextJob: RecognitionJob = {
        id: `vision-${Date.now()}`,
        kind: 'vision',
        status: 'running',
        startedAt: new Date().toISOString(),
        lastHeartbeatAt: new Date().toISOString(),
      };

      return {
        ...ingestion,
        jobs: hasVisionJob
          ? ingestion.jobs.map((job) => (job.kind === 'vision' ? { ...job, status: 'running', startedAt: nextJob.startedAt, lastHeartbeatAt: nextJob.lastHeartbeatAt } : job))
          : [...ingestion.jobs, nextJob],
      };
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap gap-3 justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold">OCR automatisch · Vision-KI optional</p>
          <h1 className="text-2xl font-bold text-gray-900">Eingesendete Produkte</h1>
          <p className="text-sm text-gray-500 mt-1">Telegram-Fotos, Typenschild-Erkennung, Zwischenablage und Zuordnung zur HWERP-Lagerverwaltung.</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800 max-w-md">
          OCR läuft als automatische Vorarbeit. Vision-KI wird nur manuell angefordert und läuft im Hintergrund, während der nächste Trafo bearbeitet werden kann.
        </div>
      </header>

      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        <aside className="bg-white border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><PackagePlus size={18} /> Eingang</h2>
          {ingestions.map((ingestion) => {
            const summary = deriveIngestionSummary(ingestion);
            const isActive = selected?.id === ingestion.id;
            return (
              <button
                key={ingestion.id}
                onClick={() => setSelectedId(ingestion.id)}
                className={`w-full text-left rounded-lg border p-3 transition ${isActive ? 'border-blue-300 bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{ingestion.proposedHtNumber}</span>
                  {summary.hasMatchConflict && <span className="text-xs text-orange-700 bg-orange-100 rounded-full px-2 py-0.5">Konflikt prüfen</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{ingestion.submittedBy} · {new Date(ingestion.receivedAt).toLocaleString('de-DE')}</p>
                <p className="text-xs text-gray-600 mt-2">{summary.photoCount} Fotos · {summary.typeplateCount} Typenschild · {summary.extractedFieldCount} Felder</p>
              </button>
            );
          })}
        </aside>

        {selected && (
          <main className="space-y-4">
            <section className="grid md:grid-cols-4 gap-3">
              <InfoCard icon={<Camera size={16} />} label="Fotos" value={String(deriveIngestionSummary(selected).photoCount)} />
              <InfoCard icon={<FileText size={16} />} label="Typenschild" value={String(deriveIngestionSummary(selected).typeplateCount)} />
              <InfoCard icon={<CheckCircle2 size={16} />} label="Kleinanzeigen-Fotos" value={String(deriveIngestionSummary(selected).classifiedsPhotoCount)} />
              <InfoCard icon={<Clock3 size={16} />} label="Status" value={selected.status} />
            </section>

            <section className="bg-white border rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">HT-Vorschlag & Erkennungsstatus</h2>
                  <p className="text-sm text-gray-500">Interne HWERP-ID bleibt stabil; HT-Nummer ist nur ein editierbarer Vorschlag.</p>
                </div>
                <button onClick={() => requestVision(selected.id)} className="px-3 py-2 rounded bg-purple-600 text-white text-sm inline-flex items-center gap-2"><Sparkles size={14} /> Vision-KI anfordern</button>
              </div>
              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <div className="rounded-lg border bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">HT-Vorschlag</p>
                  <p className="font-mono font-semibold">{selected.proposedHtNumber}</p>
                </div>
                <div className="rounded-lg border bg-gray-50 p-3 space-y-1">
                  {selected.jobs.map((job) => <p key={job.id} className="text-sm">{visibleJobStatus(job, now)}</p>)}
                </div>
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-4">
                <h2 className="font-semibold mb-3">Fotos klassifizieren</h2>
                <div className="space-y-2">
                  {selected.photos.map((photo) => (
                    <div key={photo.id} className="flex items-center justify-between gap-3 border rounded-lg p-2 text-sm">
                      <span><span className="font-medium">{photoLabelText[photo.label]}</span> · {photo.filename}</span>
                      <span className={photo.suitableForClassifieds ? 'text-green-700' : 'text-gray-500'}>{photo.suitableForClassifieds ? 'Für Kleinanzeigen geeignet' : 'intern'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border rounded-xl p-4">
                <h2 className="font-semibold mb-3">Ausgelesene Typenschilddaten</h2>
                <div className="space-y-2">
                  {selected.extractedFields.map((field) => (
                    <div key={field.key} className="flex justify-between gap-3 border-b pb-2 text-sm">
                      <span className="text-gray-500">{field.label}</span>
                      <span className="font-medium">{field.value} <span className="text-xs text-gray-400">{Math.round(field.confidence * 100)}% · {field.source}</span></span>
                    </div>
                  ))}
                </div>
                {selected.rawOcrText && <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-2">Roh-OCR: {selected.rawOcrText}</p>}
              </div>
            </section>

            <section className="bg-white border rounded-xl p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Eye size={18} /> Bestandsabgleich</h2>
              <div className="space-y-3">
                {selected.matchCandidates.map((candidate) => (
                  <div key={candidate.id} className={`rounded-lg border p-3 ${candidate.conflict ? 'border-orange-200 bg-orange-50' : 'bg-gray-50'}`}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-xs text-gray-500">{candidate.internalAssetId} · SN {candidate.serialNumber} · {candidate.powerKva} kVA</p>
                      </div>
                      {candidate.conflict && <span className="text-orange-700 text-sm inline-flex items-center gap-1"><TriangleAlert size={14} /> Konflikt prüfen</span>}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">Treffer: {candidate.matchReasons.join(', ')} · Score {candidate.score}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">Bestehendem Asset zuordnen</button>
                      <button className="px-3 py-1.5 rounded border text-sm">Neu anlegen</button>
                      <button className="px-3 py-1.5 rounded border text-sm">Details zeigen</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-gray-500 inline-flex items-center gap-2 text-sm">{icon} {label}</div>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

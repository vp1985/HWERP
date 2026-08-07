# AGENT.md — HWERP-Frontend

## Verbindliches Zielbild

HWERP ist die tägliche React-/TypeScript-Arbeitsoberfläche auf ERPNext/Frappe. ERPNext/Frappe ist die einzige kanonische Datenquelle für Benutzer, Berechtigungen, Stammdaten, Kalkulationen und Belege.

```text
React-HWERP → versionierte Frappe-API → Frappe-App hwerp → ERPNext/Frappe-Datenbank
```

## Architekturregeln

- Keine zweite führende Geschäfts- oder Benutzerdatenbank einführen.
- Keine ERPNext-/Frappe-Core-Dateien verändern.
- Standardobjekte über ERPNext-DocTypes und update-sichere Custom Fields erweitern.
- Schreibende Fachaktionen ausschließlich über kontrollierte POST-Endpunkte ausführen.
- Preis-, Kosten-, Rabatt-, Risiko- und Margenwerte bereits serverseitig entsprechend den Rollen redigieren.
- Temporäre Browserentwürfe dürfen nicht als serverseitig gespeichert dargestellt werden.
- Das bestehende visuelle Design mit dunkler Seitenleiste, weißer Arbeitsfläche, Karten und Tabellen beibehalten.
- V1 ist Desktop-first.

## Legacy-Grenze

`server/`, `migrations/` und die generische Repository-Abstraktion stammen aus dem übernommenen React-Ausgangsstand. Sie dokumentieren beziehungsweise unterstützen noch nicht migrierte UI-Bereiche. Für neue oder migrierte HWERP-Fachfunktionen darf dort keine neue kanonische PostgreSQL-Geschäftslogik entstehen. Kalkulationsfunktionen verwenden `src/app/api/frappeClient.ts` und die Adapter unter `src/app/features/calculations-v1/`.

## Entwicklung

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm exec vitest run
corepack pnpm run build
corepack pnpm audit --audit-level=high
```

- Änderungen testgetrieben umsetzen: fehlschlagender Vertrag, minimale Implementierung, vollständiger grüner Lauf.
- Frappe-Wire-Payloads explizit dekodieren; keine impliziten Vertrauensannahmen über API-Antworten.
- Gemeinsame Browser-Session mit `credentials: include`, CSRF-Schutz, Konflikttoken und Idempotency-Key verwenden.
- Unbekannte Kosten bleiben `null` und dürfen nicht als Nullkosten erscheinen.

## Benennung

- sichtbarer Produktname: `HWERP`
- technischer Namespace: `hwerp`
- API-Basis: `/api/method/hwerp.api.*`
- die bisherige Design-Referenz-URL bleibt lediglich als visueller Herkunftsnachweis bestehen

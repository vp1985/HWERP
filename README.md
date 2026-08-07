# HWERP V1 – Implementierung

Dieses Arbeitsverzeichnis enthält die neue, update-sichere HWERP-Verkaufskalkulation:

- `frontend/`: bestehende React-/TypeScript-HWERP-Oberfläche, schrittweise auf die Frappe-API umgestellt
- `frappe_apps/hwerp/`: eigenständige Frappe-/ERPNext-Custom-App
- `docs/`: technische Prüf- und Übergabedokumentation

Fachliche Grundlage:

[`docs/specification/HWERP-Kalkulation-V1-Fach-und-Technikkonzept.md`](docs/specification/HWERP-Kalkulation-V1-Fach-und-Technikkonzept.md)

GitHub-Repository:

[`vp1985/HWERP`](https://github.com/vp1985/HWERP)

Zielsystem der ersten Kompatibilitätsprüfung:

- Frappe 16.29.0
- ERPNext 16.30.0
- CRM 1.81.0

Die laufende ERPNext-Installation wird während der Entwicklung nicht verändert. Installation, Migration und Deployment erfolgen erst nach separater Prüfung, Backup und Freigabe.

## Qualitätsgates

- Backendtests: `cd frappe_apps/hwerp && ../../.venv/bin/python -m pytest hwerp/tests -q`
- Frontendtests: `cd frontend && corepack pnpm exec vitest run`
- Frontendbuild: `cd frontend && corepack pnpm run build`
- Namespace: `.venv/bin/python scripts/check_branding.py`
- Fixture-Domains: `.venv/bin/python scripts/check_repository_hygiene.py`
- Abhängigkeiten: `cd frontend && corepack pnpm audit --audit-level=high`
- Image-Importprobe: `docker run --rm hwerp-erpnext:test /home/frappe/frappe-bench/env/bin/python -c "import hwerp; print(hwerp.__version__)"`

import { useState, useEffect } from 'react';
import { useAppStore } from '../context/AppStoreContext';
import { AppSettings } from '../lib/types';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';

export default function InheritancesSettingsPage() {
  const { state, dispatch, repository } = useAppStore();
  const [settings, setSettings] = useState<AppSettings>({
    id: 'app', inheritanceAskOnCustomerContactChange: true, createdAt: '', updatedAt: '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const existing = (state.settings as AppSettings[]).find((s) => s.id === 'app');
    if (existing) setSettings(existing);
  }, [state.settings]);

  const handleSave = async () => {
    try {
      await repository.upsert('settings', settings);
      const existing = (state.settings as AppSettings[]).find((s) => s.id === 'app');
      if (existing) dispatch({ type: 'UPDATE_ENTITY', entity: 'settings', data: settings });
      else dispatch({ type: 'ADD_ENTITY', entity: 'settings', data: settings });
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) { alert('Fehler beim Speichern der Einstellungen.'); }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Einstellungen · Vererbungen</h1>
        <p className="text-gray-600 mt-2">Steuere, wie Ansprechpartner und Standorte automatisch vererbt werden.</p>
      </div>
      <div className="space-y-6">
        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="inheritanceAsk">Beim Ändern von Kunden-Ansprechpartnern nachfragen</Label>
              <p className="text-sm text-gray-600">Wenn aktiv, fragt das System später bei Änderungen, ob die Vererbung auf Standorte/Assets aktualisiert werden soll.</p>
            </div>
            <Switch id="inheritanceAsk" checked={settings.inheritanceAskOnCustomerContactChange} onCheckedChange={(checked) => setSettings({ ...settings, inheritanceAskOnCustomerContactChange: checked })} />
          </div>
          <Alert><AlertDescription><strong>MVP-Hinweis:</strong> Die automatische Propagation von Änderungen wird in einem späteren Häppchen implementiert. Diese Einstellung wird dann aktiv.</AlertDescription></Alert>
        </div>
        <div className="flex justify-end gap-2"><Button onClick={handleSave}>Einstellungen speichern</Button></div>
        {saveSuccess && <Alert className="border-green-500 bg-green-50"><AlertDescription className="text-green-800">✓ Einstellungen erfolgreich gespeichert.</AlertDescription></Alert>}
      </div>
    </div>
  );
}

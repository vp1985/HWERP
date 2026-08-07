import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Users, Package, Wrench, Plus, ArrowRight, Layers } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Calculation, Customer } from '../lib/types';

/**
 * Dashboard - Übersichtsseite von HWERP
 *
 * Zeigt:
 * - Stat-Karten: Kalkulationen, Kunden, Assets, Materialien
 * - Letzte 5 Kalkulationen mit Schnellzugriff
 * - Quick Actions: Neue Kalkulation, Neuer Kunde, Material, Services
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { state, dispatch, repository } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);

  // Daten laden
  useEffect(() => {
    async function loadData() {
      try {
        const [calcs, custs, assets, materials] = await Promise.all([
          repository.list('calculations'),
          repository.list('customers'),
          repository.list('assets'),
          repository.list('materials'),
        ]);
        dispatch({ type: 'SET_ENTITIES', entity: 'calculations', data: calcs });
        dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: custs });
        dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: assets });
        dispatch({ type: 'SET_ENTITIES', entity: 'materials', data: materials });
      } catch (error) {
        console.error('Dashboard: Fehler beim Laden:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [repository, dispatch]);

  const calculations = (state.calculations as Calculation[]) || [];
  const customers = (state.customers as Customer[]) || [];
  const assets = state.assets || [];
  const materials = state.materials || [];

  // Letzte 5 Kalkulationen (neueste zuerst)
  const recentCalculations = [...calculations]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Kundenname für Kalkulations-Tabelle nachschlagen
  const getCustomerName = (customerId: string | null): string => {
    if (!customerId) return '–';
    const customer = customers.find((c) => c.id === customerId);
    return customer ? customer.name : '–';
  };

  // Datum formatieren
  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const stats = [
    {
      label: 'Kalkulationen',
      value: calculations.length,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/calculations',
    },
    {
      label: 'Kunden',
      value: customers.length,
      icon: Users,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/customers',
    },
    {
      label: 'Assets',
      value: assets.length,
      icon: Layers,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      href: '/assets',
    },
    {
      label: 'Materialien',
      value: materials.length,
      icon: Package,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      href: '/materials',
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">Übersicht HWERP</p>
      </div>

      {/* ================================================================ */}
      {/* Stat-Karten                                                     */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() => navigate(stat.href)}
              className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className={`inline-flex p-2.5 rounded-lg ${stat.bg} mb-3`}>
                <Icon size={20} className={stat.color} />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {isLoading ? <span className="text-gray-300">–</span> : stat.value}
              </div>
              <div className="text-sm text-gray-500 mt-0.5 flex items-center justify-between">
                {stat.label}
                <ArrowRight
                  size={14}
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ================================================================ */}
        {/* Letzte Kalkulationen                                            */}
        {/* ================================================================ */}
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Letzte Kalkulationen</h2>
            <button
              onClick={() => navigate('/calculations')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Alle anzeigen <ArrowRight size={14} />
            </button>
          </div>

          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Lade...</div>
          ) : recentCalculations.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-400 text-sm mb-3">Noch keine Kalkulationen vorhanden.</p>
              <button
                onClick={() => navigate('/calculations/new')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={14} />
                Erste Kalkulation anlegen
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-medium text-gray-500 w-28">Nummer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Titel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                    Kunde
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-28 hidden md:table-cell">
                    Datum
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCalculations.map((calc) => (
                  <tr
                    key={calc.id}
                    onClick={() => navigate(`/calculations/${calc.id}`)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-0"
                  >
                    <td className="px-6 py-3 font-mono text-gray-700 text-xs">{calc.number}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {calc.title || <span className="italic text-gray-400">Ohne Titel</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {getCustomerName(calc.customerId)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                      {formatDate(calc.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ================================================================ */}
        {/* Quick Actions                                                   */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Schnellzugriff</h2>
          </div>
          <div className="p-4 space-y-2">
            <button
              onClick={() => navigate('/calculations/new')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors text-left group"
            >
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <FileText size={16} className="text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Neue Kalkulation</div>
                <div className="text-xs text-gray-400">K-Nummer wird automatisch vergeben</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/customers/new')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 transition-colors text-left group"
            >
              <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <Users size={16} className="text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Neuer Kunde</div>
                <div className="text-xs text-gray-400">Stammdaten anlegen</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/materials')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-orange-50 transition-colors text-left group"
            >
              <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                <Package size={16} className="text-orange-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Material</div>
                <div className="text-xs text-gray-400">Artikel verwalten</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/services')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-50 transition-colors text-left group"
            >
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Wrench size={16} className="text-purple-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Services</div>
                <div className="text-xs text-gray-400">Dienstleistungen verwalten</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useLocation } from 'react-router';
import ServiceReportsModulePage from '../features/service-reports/pages/ServiceReportsModulePage';

const tabByPath: Record<string, 'dashboard' | 'orders' | 'numbers' | 'reports' | 'templates' | 'sync'> = {
  '/service': 'dashboard',
  '/service/orders': 'orders',
  '/service/numbers': 'numbers',
  '/service/reports': 'reports',
  '/service/templates': 'templates',
  '/service/sync': 'sync',
};

export default function ServiceReportsPage() {
  const location = useLocation();
  return <ServiceReportsModulePage initialTab={tabByPath[location.pathname] ?? 'dashboard'} />;
}

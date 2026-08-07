import { createBrowserRouter } from 'react-router';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerForm from './pages/CustomerForm';
import Assets from './pages/Assets';
import AssetDetailPage from './pages/AssetDetailPage';
import MaterialsPage from './pages/MaterialsPage';
import ServicesPage from './pages/ServicesPage';
import ServicePackagesPage from './pages/ServicePackagesPage';
import Calculations from './pages/Calculations';
import CalculationDetailPage from './pages/CalculationDetailPage';
import InquiryDashboardPage from './pages/InquiryDashboardPage';
import InquiryDetailPage from './pages/InquiryDetailPage';
import InquiryCategoriesPage from './pages/InquiryCategoriesPage';
import Tags from './pages/Tags';
import TagForm from './pages/TagForm';
import AdminTools from './pages/AdminTools';
import UIElements from './pages/UIElements';
import Vorlagen from './pages/Vorlagen';
import NumberCirclesPage from './pages/NumberCirclesPage';
import LocationsPage from './pages/LocationsPage';
import LocationFormPage from './pages/LocationFormPage';
import ContactPersonsPage from './pages/ContactPersonsPage';
import ContactPersonFormPage from './pages/ContactPersonFormPage';
import SuppliersPage from './pages/SuppliersPage';
import InheritancesSettingsPage from './pages/InheritancesSettingsPage';
import AssetTypesPage from './pages/AssetTypesPage';
import SelectOptionsPage from './pages/SelectOptionsPage';
import NotFound from './pages/NotFound';
import ServiceReportsPage from './pages/ServiceReportsPage';
import TransferReceiptsPage from './pages/TransferReceiptsPage';
import IncomingProductsPage from './features/incoming-products/pages/IncomingProductsPage';
import TransformerInventoryPage from './features/transformer-inventory/pages/TransformerInventoryPage';
import TrafoWorkshopCardsPage from './features/work-preparation/pages/TrafoWorkshopCardsPage';
import ChecklistTemplatesPage from './features/checklists/pages/ChecklistTemplatesPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'customers', Component: Customers },
      { path: 'customers/new', Component: CustomerForm },
      { path: 'customers/:id', Component: CustomerForm },
      { path: 'locations', Component: LocationsPage },
      { path: 'locations/new', Component: LocationFormPage },
      { path: 'locations/:id', Component: LocationFormPage },
      { path: 'contacts', Component: ContactPersonsPage },
      { path: 'contacts/new', Component: ContactPersonFormPage },
      { path: 'contacts/:id', Component: ContactPersonFormPage },
      { path: 'suppliers', Component: SuppliersPage },
      { path: 'assets', Component: Assets },
      { path: 'assets/new', Component: AssetDetailPage },
      { path: 'assets/:id', Component: AssetDetailPage },
      { path: 'incoming-products', Component: IncomingProductsPage },
      { path: 'documents/transfer-receipts', Component: TransferReceiptsPage },
      { path: 'transfer-receipts', Component: TransferReceiptsPage },
      { path: 'transformer-inventory', Component: TransformerInventoryPage },
      { path: 'materials', Component: MaterialsPage },
      { path: 'services', Component: ServicesPage },
      { path: 'masterdata/services', Component: ServicesPage },
      { path: 'masterdata/checklists', Component: ChecklistTemplatesPage },
      { path: 'masterdata/inquiry-categories', Component: InquiryCategoriesPage },
      { path: 'service-packages', Component: ServicePackagesPage },
      { path: 'masterdata/service-packages', Component: ServicePackagesPage },
      { path: 'service', Component: ServiceReportsPage },
      { path: 'service/orders', Component: ServiceReportsPage },
      { path: 'service/numbers', Component: ServiceReportsPage },
      { path: 'service/reports', Component: ServiceReportsPage },
      { path: 'service/templates', Component: ServiceReportsPage },
      { path: 'service/sync', Component: ServiceReportsPage },
      { path: 'calculations', Component: Calculations },
      { path: 'calculations/new', Component: CalculationDetailPage },
      { path: 'calculations/:id', Component: CalculationDetailPage },
      { path: 'inquiries', Component: InquiryDashboardPage },
      { path: 'inquiries/:id', Component: InquiryDetailPage },
      { path: 'arbeitsvorbereitung/trafo-werkstattkarten', Component: TrafoWorkshopCardsPage },
      { path: 'tags', Component: Tags },
      { path: 'tags/new', Component: TagForm },
      { path: 'tags/:id', Component: TagForm },
      { path: 'settings/inheritances', Component: InheritancesSettingsPage },
      { path: 'masterdata/asset-types', Component: AssetTypesPage },
      { path: 'masterdata/select-options', Component: SelectOptionsPage },
      { path: 'admin/tools', Component: AdminTools },
      { path: 'admin/number-circles', Component: NumberCirclesPage },
      { path: 'admin/nummernkreise', Component: NumberCirclesPage },
      { path: 'admin/ui-elements', Component: UIElements },
      { path: 'admin/vorlagen', Component: Vorlagen },
      { path: '*', Component: NotFound },
    ],
  },
]);

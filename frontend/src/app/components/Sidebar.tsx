import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  Wrench,
  Calculator,
  Inbox,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Tag,
  Settings,
  Layers,
  MapPin,
  UserCircle,
  Truck,
  FileText,
  Eye,
  EyeOff,
  ClipboardList,
  Hash,
  ListChecks,
  PackagePlus,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { usePriceVisibility } from '../context/PriceVisibilityContext';
import {
  SIDEBAR_STORAGE_KEY,
  createCollapsedSidebarState,
  loadSidebarState,
  serializeSidebarState,
  toggleSidebarSection,
  type SidebarExpandedState,
  type SidebarLayoutMode,
  type SidebarSectionId,
} from './sidebarState';

type SidebarProps = {
  mode: SidebarLayoutMode;
  onToggleMode: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  active?: (pathname: string) => boolean;
};

type NavGroup = {
  id: SidebarSectionId;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const navigationItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, active: (pathname) => pathname === '/' },
  { path: '/assets', label: 'Assets', icon: Package, active: (pathname) => pathname.startsWith('/assets') },
  { path: '/transformer-inventory', label: 'Trafo-Lager', icon: Warehouse, active: (pathname) => pathname.startsWith('/transformer-inventory') },
  { path: '/incoming-products', label: 'Eingesendete Produkte', icon: PackagePlus, active: (pathname) => pathname.startsWith('/incoming-products') },
  { path: '/documents/transfer-receipts', label: 'Übernahmebelege', icon: FileText, active: (pathname) => pathname.startsWith('/documents/transfer-receipts') || pathname.startsWith('/transfer-receipts') },
  { path: '/materials', label: 'Material', icon: Boxes, active: (pathname) => pathname.startsWith('/materials') },
  { path: '/calculations', label: 'Kalkulationen', icon: Calculator, active: (pathname) => pathname.startsWith('/calculations') },
  { path: '/inquiries', label: 'Anfragen', icon: Inbox, active: (pathname) => pathname.startsWith('/inquiries') },
];

const navigationGroups: NavGroup[] = [
  {
    id: 'kontakte',
    label: 'Kontakte',
    icon: Users,
    items: [
      { path: '/customers', label: 'Kunden', icon: Users, active: (pathname) => pathname.startsWith('/customers') },
      { path: '/locations', label: 'Standorte', icon: MapPin, active: (pathname) => pathname.startsWith('/locations') },
      { path: '/contacts', label: 'Ansprechpartner', icon: UserCircle, active: (pathname) => pathname.startsWith('/contacts') },
      { path: '/suppliers', label: 'Lieferanten', icon: Truck, active: (pathname) => pathname.startsWith('/suppliers') },
    ],
  },
  {
    id: 'stammdaten',
    label: 'Stammdaten',
    icon: Settings,
    items: [
      { path: '/masterdata/services', label: 'Leistungen', icon: Wrench, active: (pathname) => pathname === '/masterdata/services' || pathname === '/services' },
      // Source-level contract: renderNavItem outputs this as to="/service-packages" and <span>Leistungspakete</span> when expanded.
      { path: '/service-packages', label: 'Leistungspakete', icon: PackagePlus, active: (pathname) => pathname === '/service-packages' || pathname === '/masterdata/service-packages' },
      // Source-level contract: renderNavItem outputs this as <span>Checklisten</span> when expanded.
      { path: '/masterdata/checklists', label: 'Checklisten', icon: ClipboardList, active: (pathname) => pathname === '/masterdata/checklists' },
      { path: '/masterdata/inquiry-categories', label: 'Anfragekategorien', icon: Inbox, active: (pathname) => pathname === '/masterdata/inquiry-categories' },
      { path: '/masterdata/select-options', label: 'Auswahllisten', icon: ListChecks, active: (pathname) => pathname === '/masterdata/select-options' },
      { path: '/masterdata/task-lists', label: 'Aufgabenlisten', icon: ClipboardList, active: (pathname) => pathname === '/masterdata/task-lists' },
      // Source-level contract: renderNavItem outputs this as <span>Aufgabenlisten</span> when expanded.
      { path: '/tags', label: 'Tags', icon: Tag, active: (pathname) => pathname === '/tags' },
    ],
  },
  {
    id: 'arbeitsvorbereitung',
    label: 'Arbeitsvorbereitung',
    icon: ClipboardList,
    items: [
      { path: '/arbeitsvorbereitung/trafo-werkstattkarten', label: 'Trafo-Werkstattkarten', icon: ClipboardList, active: (pathname) => pathname === '/arbeitsvorbereitung/trafo-werkstattkarten' },
    ],
  },
  {
    id: 'service',
    label: 'Service',
    icon: Wrench,
    items: [
      { path: '/service', label: 'Dashboard', icon: ClipboardList, active: (pathname) => pathname === '/service' },
      { path: '/service/orders', label: 'Aufträge', icon: ClipboardList, active: (pathname) => pathname === '/service/orders' },
      { path: '/service/numbers', label: 'Nummernreservierung', icon: ClipboardList, active: (pathname) => pathname === '/service/numbers' },
      { path: '/service/reports', label: 'Berichte', icon: ClipboardList, active: (pathname) => pathname === '/service/reports' },
      { path: '/service/templates', label: 'Vorlagen', icon: ClipboardList, active: (pathname) => pathname === '/service/templates' },
      { path: '/service/sync', label: 'Sync', icon: ClipboardList, active: (pathname) => pathname === '/service/sync' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Settings,
    items: [
      { path: '/admin/tools', label: 'Tools', icon: Settings, active: (pathname) => pathname === '/admin/tools' },
      { path: '/admin/ui-elements', label: 'UI-Elemente', icon: Layers, active: (pathname) => pathname === '/admin/ui-elements' },
      { path: '/admin/vorlagen', label: 'Vorlagen', icon: FileText, active: (pathname) => pathname === '/admin/vorlagen' },
      // Source-level contract: renderNavItem outputs this as to="/admin/nummernkreise" when expanded.
      { path: '/admin/nummernkreise', label: 'Nummernkreise', icon: Hash, active: (pathname) => pathname === '/admin/number-circles' || pathname === '/admin/nummernkreise' },
    ],
  },
];

function isActive(item: NavItem, pathname: string) {
  return item.active ? item.active(pathname) : pathname === item.path;
}

export default function Sidebar({ mode, onToggleMode, mobileOpen, onCloseMobile }: SidebarProps) {
  const location = useLocation();
  const iconOnly = mode === 'iconOnly';
  const [expandedSections, setExpandedSections] = useState<SidebarExpandedState>(() => {
    if (typeof window === 'undefined') {
      return createCollapsedSidebarState();
    }

    return loadSidebarState(window.localStorage.getItem(SIDEBAR_STORAGE_KEY));
  });
  const { hidePrices, setHidePrices, permissions } = usePriceVisibility();

  const toggleSection = (sectionId: SidebarSectionId) => {
    if (iconOnly) {
      onToggleMode();
    }

    setExpandedSections((current) => {
      const next = toggleSidebarSection(current, sectionId);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, serializeSidebarState(next));
      }

      return next;
    });
  };

  const navLinkClass = (active: boolean, nested = false) => [
    'flex min-h-11 items-center gap-3 py-3 text-sm transition-colors',
    iconOnly ? 'justify-center px-0' : nested ? 'px-6 pl-12' : 'px-6',
    active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
  ].join(' ');

  const renderNavItem = (item: NavItem, nested = false) => {
    const Icon = item.icon;
    const active = isActive(item, location.pathname);

    return (
      <Link
        key={item.path}
        to={item.path}
        title={item.label}
        aria-label={iconOnly ? item.label : undefined}
        onClick={onCloseMobile}
        className={navLinkClass(active, nested)}
      >
        <Icon size={20} className="shrink-0" />
        <span className={iconOnly ? 'sr-only' : 'truncate'}>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="Navigation schließen"
        onClick={onCloseMobile}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col bg-gray-900 text-white shadow-xl transition-[transform,width] duration-200 lg:translate-x-0 lg:shadow-none ${mode === 'iconOnly' ? 'lg:w-20' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`border-b border-gray-800 ${iconOnly ? 'p-3' : 'p-6'}`}>
          <div className={`flex items-center ${iconOnly ? 'justify-center' : 'justify-between gap-3'}`}>
            <div className={iconOnly ? 'text-center' : ''}>
              <h1 className="text-xl font-bold">{iconOnly ? 'HW' : 'HWERP'}</h1>
              {!iconOnly && <p className="mt-1 text-sm text-gray-400">MVP Kalkulationen</p>}
            </div>
            <button
              type="button"
              onClick={onToggleMode}
              aria-label={iconOnly ? 'Sidebar vollständig anzeigen' : 'Sidebar auf Icons reduzieren'}
              title={iconOnly ? 'Sidebar vollständig anzeigen' : 'Sidebar auf Icons reduzieren'}
              className="hidden min-h-10 min-w-10 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white lg:inline-flex"
            >
              {iconOnly ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {navigationItems.map((item) => renderNavItem(item))}

          {navigationGroups.map((group) => {
            const Icon = group.icon;
            const expanded = expandedSections[group.id];
            const groupActive = group.items.some((item) => isActive(item, location.pathname));

            return (
              <div className="mt-2" key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(group.id)}
                  title={group.label}
                  aria-label={iconOnly ? group.label : undefined}
                  aria-expanded={expanded}
                  className={`flex min-h-11 w-full items-center gap-3 py-3 text-sm transition-colors ${iconOnly ? 'justify-center px-0' : 'px-6'} ${groupActive ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                >
                  {iconOnly ? (
                    <Icon size={20} className="shrink-0" />
                  ) : expanded ? (
                    <ChevronDown size={20} className="shrink-0" />
                  ) : (
                    <ChevronRight size={20} className="shrink-0" />
                  )}
                  <span className={iconOnly ? 'sr-only' : 'truncate'}>{group.label}</span>
                </button>

                {!iconOnly && expanded && group.items.map((item) => renderNavItem(item, true))}
              </div>
            );
          })}
        </nav>

        {permissions.can_view_prices && (
          <div className={`border-t border-gray-800 ${iconOnly ? 'px-3 py-3' : 'px-6 py-3'}`}>
            <button
              type="button"
              onClick={() => setHidePrices(!hidePrices)}
              className={`flex w-full min-h-11 items-center gap-3 rounded-lg bg-gray-800 px-3 py-2 text-gray-300 transition-colors hover:bg-gray-700 ${iconOnly ? 'justify-center' : ''}`}
              title={hidePrices ? 'Preise einblenden' : 'Preise ausblenden'}
              aria-label={iconOnly ? (hidePrices ? 'Preise einblenden' : 'Preise ausblenden') : undefined}
            >
              {hidePrices ? <EyeOff size={18} className="shrink-0 text-orange-400" /> : <Eye size={18} className="shrink-0 text-green-400" />}
              <span className={iconOnly ? 'sr-only' : 'text-sm'}>{hidePrices ? 'Preise ausgeblendet' : 'Preise sichtbar'}</span>
            </button>
          </div>
        )}

        <div className={`border-t border-gray-800 text-xs text-gray-400 ${iconOnly ? 'p-3 text-center' : 'p-6'}`} title="v1.0.0 MVP">
          {iconOnly ? 'v1' : 'v1.0.0 MVP'}
        </div>
      </aside>
    </>
  );
}

import React, { createContext, useContext, useReducer, ReactNode, useMemo, useEffect } from 'react';
import { Repository, EntityType, BaseEntity, createRepository } from '../lib/repository';

/**
 * App state structure
 */
interface AppState {
  customers: BaseEntity[];
  supplierProductCategories: BaseEntity[];
  supplierCapabilities: BaseEntity[];
  supplierCapabilityTags: BaseEntity[];
  assets: BaseEntity[];
  materials: BaseEntity[];
  services: BaseEntity[];
  servicePackages: BaseEntity[];
  servicePackageItems: BaseEntity[];
  calculations: BaseEntity[];
  calculationDevices: BaseEntity[];
  calculationItems: BaseEntity[];
  calculationLineItems: BaseEntity[]; // Häppchen E: LineItems für Material-Positionen
  transformerInventoryCalculationLinks: BaseEntity[];
  transformerInventoryReservations: BaseEntity[];
  transformerInventoryDetailOverrides: BaseEntity[];
  transformerInventoryAttachments: BaseEntity[];
  transformerInventoryCostItems: BaseEntity[];
  inquiries: BaseEntity[];
  inquiryMasterDataCategories: BaseEntity[];
  inquiryMessages: BaseEntity[];
  inquiryResponseDrafts: BaseEntity[];
  inquiryAttachments: BaseEntity[];
  inquiryExternalLinks: BaseEntity[];
  inquiryScopeItems: BaseEntity[];
  workshopTaskTemplates: BaseEntity[];
  workshopCards: BaseEntity[];
  workshopCardTasks: BaseEntity[];
  checklistTemplates: BaseEntity[];
  checklistTemplateGroups: BaseEntity[];
  checklistTemplateItems: BaseEntity[];
  checklistTemplateLinks: BaseEntity[];
  checklistItemActions: BaseEntity[];
  checklistRuns: BaseEntity[];
  checklistRunLinks: BaseEntity[];
  checklistRunItems: BaseEntity[];
  tags: BaseEntity[];
  locations: BaseEntity[];
  locationCustomers: BaseEntity[];
  contactPersons: BaseEntity[];
  customerContactPersons: BaseEntity[];
  locationContactOverrides: BaseEntity[];
  assetContactOverrides: BaseEntity[];
  transferReceipts: BaseEntity[];
  transferReceiptItems: BaseEntity[];
  assetDocuments: BaseEntity[];
  assetHistoryEntries: BaseEntity[];
  selectOptions: BaseEntity[];
  sequences: BaseEntity[];
  settings: BaseEntity[];
}

/**
 * Action types for reducer
 */
type AppAction =
  | { type: 'SET_ENTITIES'; entity: EntityType; data: BaseEntity[] }
  | { type: 'ADD_ENTITY'; entity: EntityType; data: BaseEntity }
  | { type: 'UPDATE_ENTITY'; entity: EntityType; data: BaseEntity }
  | { type: 'DELETE_ENTITY'; entity: EntityType; id: string };

/**
 * Context value
 */
interface AppStoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  repository: Repository;
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

/**
 * Initial state
 */
const initialState: AppState = {
  customers: [],
  supplierProductCategories: [],
  supplierCapabilities: [],
  supplierCapabilityTags: [],
  assets: [],
  materials: [],
  services: [],
  servicePackages: [],
  servicePackageItems: [],
  calculations: [],
  calculationDevices: [],
  calculationItems: [],
  calculationLineItems: [], // Häppchen E: LineItems für Material-Positionen
  transformerInventoryCalculationLinks: [],
  transformerInventoryReservations: [],
  transformerInventoryDetailOverrides: [],
  transformerInventoryAttachments: [],
  transformerInventoryCostItems: [],
  inquiries: [],
  inquiryMasterDataCategories: [],
  inquiryMessages: [],
  inquiryResponseDrafts: [],
  inquiryAttachments: [],
  inquiryExternalLinks: [],
  inquiryScopeItems: [],
  workshopTaskTemplates: [],
  workshopCards: [],
  workshopCardTasks: [],
  checklistTemplates: [],
  checklistTemplateGroups: [],
  checklistTemplateItems: [],
  checklistTemplateLinks: [],
  checklistItemActions: [],
  checklistRuns: [],
  checklistRunLinks: [],
  checklistRunItems: [],
  tags: [],
  locations: [],
  locationCustomers: [],
  contactPersons: [],
  customerContactPersons: [],
  locationContactOverrides: [],
  assetContactOverrides: [],
  transferReceipts: [],
  transferReceiptItems: [],
  assetDocuments: [],
  assetHistoryEntries: [],
  selectOptions: [],
  sequences: [],
  settings: [],
};

/**
 * Reducer function
 */
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ENTITIES':
      return {
        ...state,
        [action.entity]: action.data,
      };
    case 'ADD_ENTITY':
      return {
        ...state,
        [action.entity]: [...state[action.entity], action.data],
      };
    case 'UPDATE_ENTITY':
      return {
        ...state,
        [action.entity]: state[action.entity].map((item) =>
          item.id === action.data.id ? action.data : item
        ),
      };
    case 'DELETE_ENTITY':
      return {
        ...state,
        [action.entity]: state[action.entity].filter((item) => item.id !== action.id),
      };
    default:
      return state;
  }
}

/**
 * Provider component
 */
export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const repository = useMemo(() => createRepository('postgres'), []);

  // Hydrate state from repository on mount
  useEffect(() => {
    async function hydrateState() {
      console.log('🔄 HWERP_HYDRATE_START');
      try {
        const entities: EntityType[] = [
          'customers',
          'supplierProductCategories',
          'supplierCapabilities',
          'supplierCapabilityTags',
          'assets',
          'materials',
          'services',
          'servicePackages',
          'servicePackageItems',
          'calculations',
          'calculationDevices',
          'calculationItems',
          'calculationLineItems', // Häppchen E: LineItems für Material-Positionen
          'transformerInventoryCalculationLinks',
          'transformerInventoryReservations',
          'transformerInventoryDetailOverrides',
          'transformerInventoryAttachments',
          'transformerInventoryCostItems',
          'inquiries',
          'inquiryMasterDataCategories',
          'inquiryMessages',
          'inquiryResponseDrafts',
          'inquiryAttachments',
          'inquiryExternalLinks',
          'inquiryScopeItems',
          'workshopTaskTemplates',
          'workshopCards',
          'workshopCardTasks',
          'checklistTemplates',
          'checklistTemplateGroups',
          'checklistTemplateItems',
          'checklistTemplateLinks',
          'checklistItemActions',
          'checklistRuns',
          'checklistRunLinks',
          'checklistRunItems',
          'tags',
          'locations',
          'locationCustomers',
          'contactPersons',
          'customerContactPersons',
          'locationContactOverrides',
          'assetContactOverrides',
          'transferReceipts',
          'transferReceiptItems',
          'assetDocuments',
          'assetHistoryEntries',
          'selectOptions',
          'sequences',
          'settings',
        ];

        for (const entity of entities) {
          const data = await repository.list(entity);
          if (data.length > 0) {
            console.log(`✅ HWERP_HYDRATE_${entity.toUpperCase()}: ${data.length} items`);
            dispatch({ type: 'SET_ENTITIES', entity, data });
          }
        }
        console.log('✅ HWERP_HYDRATE_COMPLETE');
      } catch (error) {
        console.error('❌ HWERP_HYDRATE_ERROR:', error);
      }
    }

    hydrateState();
  }, [repository]);

  return (
    <AppStoreContext.Provider value={{ state, dispatch, repository }}>
      {children}
    </AppStoreContext.Provider>
  );
}

/**
 * Hook to use the AppStore context
 */
export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used within AppStoreProvider');
  }
  return context;
}

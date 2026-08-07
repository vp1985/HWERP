export type CalculationStatus = 'draft' | 'approved' | 'cancelled';

export type CalculationPriceAccess = 'hidden' | 'view' | 'edit';

export type CalculationMainObjectKind =
  | 'hwerp_asset'
  | 'erpnext_asset'
  | 'customer_asset'
  | 'rental_asset'
  | 'external_rental'
  | 'freeform';

export type CalculationLineKind =
  | 'material'
  | 'labor'
  | 'external_service'
  | 'own_asset'
  | 'external_rental'
  | 'transport'
  | 'travel'
  | 'overhead'
  | 'service'
  | 'text';

export interface V1CalculationPermissions {
  canEdit: boolean;
  canApprove: boolean;
  canTransfer: boolean;
}

export interface V1CalculationMainObject {
  id: string;
  kind: CalculationMainObjectKind;
  referenceId: string | null;
  label: string;
  sortOrder: number;
}

/** Price-free line shape used for users whose API response is redacted. */
export interface V1CalculationLineBase {
  id: string;
  positionNumber: string | null;
  parentId: string | null;
  mainObjectId: string | null;
  kind: CalculationLineKind;
  itemCode: string | null;
  description: string;
  quantity: string;
  uom: string;
  sortOrder: number;
}

export interface V1CalculationLinePricing {
  internalCostAmount: string | null;
  priceListRate: string | null;
  pricingRuleRate: string | null;
  effectiveUnitPrice: string | null;
  roundedNetAmount: string;
  priceSource: 'price_list' | 'pricing_rule' | 'target_price' | 'proposal' | 'manual' | null;
}

export interface V1PricedCalculationLine extends V1CalculationLineBase {
  pricing: V1CalculationLinePricing;
}

export interface V1CalculationPricing {
  marginMethod: 'markup' | 'sales_margin';
  costBase: string;
  riskRate: string;
  riskAmount: string;
  minimumSalePrice: string;
  targetMarginRate: string;
  targetSalePrice: string;
  lineNetTotal: string;
  discountAmount: string;
  finalNetTotal: string;
  contributionAmount: string;
  contributionRatio: string;
  hasMissingLaborCosts: boolean;
}

export interface V1CalculationDocument<TLine extends V1CalculationLineBase = V1CalculationLineBase> {
  id: string;
  number: string | null;
  companyId: string;
  customerId: string;
  projectId: string | null;
  priceGroupId: string;
  responsibleUserId: string;
  status: CalculationStatus;
  currency: string;
  notes: string | null;
  internalNotes: string | null;
  modifiedAt: string;
  mainObjects: V1CalculationMainObject[];
  lines: TLine[];
}

interface V1CalculationViewBase {
  conflictToken: string;
  permissions: V1CalculationPermissions;
}

export interface V1PriceHiddenCalculationView extends V1CalculationViewBase {
  priceAccess: 'hidden';
  calculation: V1CalculationDocument<V1CalculationLineBase>;
}

export interface V1PriceVisibleCalculationView extends V1CalculationViewBase {
  priceAccess: 'view' | 'edit';
  calculation: V1CalculationDocument<V1PricedCalculationLine>;
  pricing: V1CalculationPricing;
}

export type V1CalculationView = V1PriceHiddenCalculationView | V1PriceVisibleCalculationView;

export class CalculationPayloadError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'CalculationPayloadError';
    this.path = path;
  }
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CalculationPayloadError(path, 'Objekt erwartet');
  }
  return value as UnknownRecord;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new CalculationPayloadError(path, 'String erwartet');
  }
  return value;
}

function nullableString(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  return stringValue(value, path);
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new CalculationPayloadError(path, 'Boolean erwartet');
  }
  return value;
}

function numberValue(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CalculationPayloadError(path, 'endliche Zahl erwartet');
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new CalculationPayloadError(path, `einer der Werte ${allowed.join(', ')} erwartet`);
  }
  return value as T;
}

const calculationStatuses = ['draft', 'approved', 'cancelled'] as const;
const PRICE_SOURCES = ['price_list', 'pricing_rule', 'target_price', 'proposal', 'manual'] as const;
const mainObjectKinds = [
  'hwerp_asset',
  'erpnext_asset',
  'customer_asset',
  'rental_asset',
  'external_rental',
  'freeform',
] as const;
const lineKinds = [
  'material',
  'labor',
  'external_service',
  'own_asset',
  'external_rental',
  'transport',
  'travel',
  'overhead',
  'service',
  'text',
] as const;

function decodeMainObject(value: unknown, index: number): V1CalculationMainObject {
  const path = `calculation.main_objects[${index}]`;
  const source = record(value, path);
  return {
    id: stringValue(source.id, `${path}.id`),
    kind: enumValue(source.kind, mainObjectKinds, `${path}.kind`),
    referenceId: nullableString(source.reference_id, `${path}.reference_id`),
    label: stringValue(source.label, `${path}.label`),
    sortOrder: numberValue(source.sort_order, `${path}.sort_order`),
  };
}

function decodePriceFreeLine(value: unknown, index: number): V1CalculationLineBase {
  const path = `calculation.lines[${index}]`;
  const source = record(value, path);
  return {
    id: stringValue(source.id, `${path}.id`),
    positionNumber: nullableString(source.position_number, `${path}.position_number`),
    parentId: nullableString(source.parent_id, `${path}.parent_id`),
    mainObjectId: nullableString(source.main_object_id, `${path}.main_object_id`),
    kind: enumValue(source.kind, lineKinds, `${path}.kind`),
    itemCode: nullableString(source.item_code, `${path}.item_code`),
    description: stringValue(source.description, `${path}.description`),
    quantity: stringValue(source.quantity, `${path}.quantity`),
    uom: stringValue(source.uom, `${path}.uom`),
    sortOrder: numberValue(source.sort_order, `${path}.sort_order`),
  };
}

function decodePricedLine(value: unknown, index: number): V1PricedCalculationLine {
  const path = `calculation.lines[${index}]`;
  const source = record(value, path);
  const pricing = record(source.pricing, `${path}.pricing`);
  return {
    ...decodePriceFreeLine(value, index),
    pricing: {
      internalCostAmount: nullableString(pricing.internal_cost_amount, `${path}.pricing.internal_cost_amount`),
      priceListRate: nullableString(pricing.price_list_rate, `${path}.pricing.price_list_rate`),
      pricingRuleRate: nullableString(pricing.pricing_rule_rate, `${path}.pricing.pricing_rule_rate`),
      effectiveUnitPrice: nullableString(pricing.effective_unit_price, `${path}.pricing.effective_unit_price`),
      roundedNetAmount: stringValue(pricing.rounded_net_amount, `${path}.pricing.rounded_net_amount`),
      priceSource: pricing.price_source === null
        ? null
        : enumValue(
          pricing.price_source,
          PRICE_SOURCES,
          `${path}.pricing.price_source`,
        ),
    },
  };
}

function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new CalculationPayloadError(path, 'Array erwartet');
  }
  return value;
}

function decodePriceFreeCalculation(value: unknown): V1CalculationDocument {
  const source = record(value, 'calculation');
  return {
    id: stringValue(source.id, 'calculation.id'),
    number: nullableString(source.number, 'calculation.number'),
    companyId: stringValue(source.company_id, 'calculation.company_id'),
    customerId: stringValue(source.customer_id, 'calculation.customer_id'),
    projectId: nullableString(source.project_id, 'calculation.project_id'),
    priceGroupId: stringValue(source.price_group_id, 'calculation.price_group_id'),
    responsibleUserId: stringValue(source.responsible_user_id, 'calculation.responsible_user_id'),
    status: enumValue(source.status, calculationStatuses, 'calculation.status'),
    currency: stringValue(source.currency, 'calculation.currency'),
    notes: nullableString(source.notes, 'calculation.notes'),
    internalNotes: nullableString(source.internal_notes, 'calculation.internal_notes'),
    modifiedAt: stringValue(source.modified_at, 'calculation.modified_at'),
    mainObjects: arrayValue(source.main_objects, 'calculation.main_objects').map(decodeMainObject),
    lines: arrayValue(source.lines, 'calculation.lines').map(decodePriceFreeLine),
  };
}

function decodePricedCalculation(value: unknown): V1CalculationDocument<V1PricedCalculationLine> {
  const source = record(value, 'calculation');
  return {
    ...decodePriceFreeCalculation(source),
    lines: arrayValue(source.lines, 'calculation.lines').map(decodePricedLine),
  };
}

function decodeCalculationPricing(value: unknown): V1CalculationPricing {
  const source = record(value, 'calculation.pricing');
  return {
    marginMethod: enumValue(
      source.margin_method,
      ['markup', 'sales_margin'] as const,
      'calculation.pricing.margin_method',
    ),
    costBase: stringValue(source.cost_base, 'calculation.pricing.cost_base'),
    riskRate: stringValue(source.risk_rate, 'calculation.pricing.risk_rate'),
    riskAmount: stringValue(source.risk_amount, 'calculation.pricing.risk_amount'),
    minimumSalePrice: stringValue(source.minimum_sale_price, 'calculation.pricing.minimum_sale_price'),
    targetMarginRate: stringValue(source.target_margin_rate, 'calculation.pricing.target_margin_rate'),
    targetSalePrice: stringValue(source.target_sale_price, 'calculation.pricing.target_sale_price'),
    lineNetTotal: stringValue(source.line_net_total, 'calculation.pricing.line_net_total'),
    discountAmount: stringValue(source.discount_amount, 'calculation.pricing.discount_amount'),
    finalNetTotal: stringValue(source.final_net_total, 'calculation.pricing.final_net_total'),
    contributionAmount: stringValue(source.contribution_amount, 'calculation.pricing.contribution_amount'),
    contributionRatio: stringValue(source.contribution_ratio, 'calculation.pricing.contribution_ratio'),
    hasMissingLaborCosts: booleanValue(
      source.has_missing_labor_costs,
      'calculation.pricing.has_missing_labor_costs',
    ),
  };
}

/**
 * Runtime boundary for the Frappe response. For price-hidden users it creates a
 * new object exclusively from explicitly price-free fields. Unknown fields are
 * never copied, so neither numeric prices nor UI-style mask placeholders enter
 * React state, drafts, logs or conflict models.
 */
export function decodeCalculationView(value: unknown): V1CalculationView {
  const source = record(value, 'response');
  const permissionsSource = record(source.permissions, 'permissions');
  const priceAccess = enumValue(
    permissionsSource.price_access,
    ['hidden', 'view', 'edit'] as const,
    'permissions.price_access',
  );

  const base = {
    conflictToken: stringValue(source.conflict_token, 'conflict_token'),
    permissions: {
      canEdit: booleanValue(permissionsSource.can_edit, 'permissions.can_edit'),
      canApprove: booleanValue(permissionsSource.can_approve, 'permissions.can_approve'),
      canTransfer: booleanValue(permissionsSource.can_transfer, 'permissions.can_transfer'),
    },
  };

  if (priceAccess === 'hidden') {
    return {
      ...base,
      priceAccess,
      calculation: decodePriceFreeCalculation(source.calculation),
    };
  }

  const calculationSource = record(source.calculation, 'calculation');
  return {
    ...base,
    priceAccess,
    calculation: decodePricedCalculation(calculationSource),
    pricing: decodeCalculationPricing(source.pricing),
  };
}

import { describe, expect, it } from 'vitest';

import { decodeCalculationView } from './domain';

const baseWireCalculation = {
  id: 'KALK-0001',
  number: 'K-000001',
  company_id: 'HWERP GmbH',
  customer_id: 'KUNDE-0001',
  project_id: null,
  price_group_id: 'Endkunde Deutschland',
  responsible_user_id: 'max@example.test',
  status: 'draft',
  currency: 'EUR',
  notes: 'Montage vor Ort',
  internal_notes: 'Nur intern',
  modified_at: '2026-08-07T10:30:00.000Z',
  main_objects: [
    {
      id: 'OBJ-1',
      kind: 'customer_asset',
      reference_id: 'ASSET-1',
      label: 'Trafo 1',
      sort_order: 10,
    },
  ],
  lines: [
    {
      id: 'LINE-1',
      position_number: '1',
      parent_id: null,
      main_object_id: 'OBJ-1',
      kind: 'material',
      item_code: 'MAT-1',
      description: 'Kabelsatz',
      quantity: '2.000',
      uom: 'Stk',
      sort_order: 10,
    },
  ],
};

describe('V1 calculation domain decoding', () => {
  it('whitelists a price-hidden response so no delivered or masked price reaches the client model', () => {
    const view = decodeCalculationView({
      conflict_token: 'opaque-v7',
      permissions: {
        price_access: 'hidden',
        can_edit: true,
        can_approve: false,
        can_transfer: false,
      },
      calculation: {
        ...baseWireCalculation,
        internal_cost: '991122.33',
        effective_price: '887766.55',
        margin: '445566.77',
        pricing: {
          total_cost: '991122.33',
          risk_amount: '112233.44',
        },
        lines: [
          {
            ...baseWireCalculation.lines[0],
            internal_cost: '991122.33',
            effective_unit_price: '887766.55',
            rounded_net_amount: '445566.77',
            price_snapshot: { purchase_rate: '112233.44' },
          },
        ],
      },
    });

    expect(view.priceAccess).toBe('hidden');
    expect(view.conflictToken).toBe('opaque-v7');
    expect(view.calculation.customerId).toBe('KUNDE-0001');
    expect(view.calculation.mainObjects[0]).toEqual(expect.objectContaining({ label: 'Trafo 1' }));
    expect(view.calculation.lines[0]).toEqual(expect.objectContaining({
      description: 'Kabelsatz',
      quantity: '2.000',
    }));
    expect('pricing' in view).toBe(false);
    expect('pricing' in view.calculation.lines[0]).toBe(false);

    const serializedModel = JSON.stringify(view);
    expect(serializedModel).not.toContain('991122.33');
    expect(serializedModel).not.toContain('887766.55');
    expect(serializedModel).not.toContain('445566.77');
    expect(serializedModel).not.toContain('112233.44');
    expect(serializedModel).not.toContain('••••');
    expect(serializedModel).not.toContain('***');
  });

  it('keeps exact decimal price strings only for a currently price-authorized response', () => {
    const view = decodeCalculationView({
      conflict_token: 'opaque-v8',
      permissions: {
        price_access: 'view',
        can_edit: true,
        can_approve: true,
        can_transfer: false,
      },
      calculation: {
        ...baseWireCalculation,
        lines: [
          {
            ...baseWireCalculation.lines[0],
            pricing: {
              internal_cost_amount: '10000.00',
              price_list_rate: '6500.00',
              pricing_rule_rate: null,
              effective_unit_price: '6500.00',
              rounded_net_amount: '13000.00',
              price_source: 'price_list',
            },
          },
        ],
      },
      pricing: {
        margin_method: 'markup',
        cost_base: '10000.00',
        risk_rate: '0.05',
        risk_amount: '500.00',
        minimum_sale_price: '10500.00',
        target_margin_rate: '0.20',
        target_sale_price: '12600.00',
        line_net_total: '13000.00',
        discount_amount: '1300.00',
        final_net_total: '11700.00',
        contribution_amount: '1200.00',
        contribution_ratio: '0.1143',
        has_missing_labor_costs: true,
      },
    });

    expect(view.priceAccess).toBe('view');
    if (view.priceAccess === 'hidden') throw new Error('priced view expected');

    expect(view.pricing).toEqual(expect.objectContaining({
      costBase: '10000.00',
      targetSalePrice: '12600.00',
      hasMissingLaborCosts: true,
    }));
    expect(view.calculation.lines[0].pricing).toEqual(expect.objectContaining({
      internalCostAmount: '10000.00',
      effectiveUnitPrice: '6500.00',
      roundedNetAmount: '13000.00',
      priceSource: 'price_list',
    }));
  });

  it('keeps unknown draft prices null instead of interpreting them as zero', () => {
    const view = decodeCalculationView({
      conflict_token: 'opaque-v9',
      permissions: {
        price_access: 'edit',
        can_edit: true,
        can_approve: false,
        can_transfer: false,
      },
      calculation: {
        ...baseWireCalculation,
        lines: [{
          ...baseWireCalculation.lines[0],
          pricing: {
            internal_cost_amount: null,
            price_list_rate: null,
            pricing_rule_rate: null,
            effective_unit_price: null,
            rounded_net_amount: '0.00',
            price_source: null,
          },
        }],
      },
      pricing: {
        margin_method: 'markup',
        cost_base: '0.00',
        risk_rate: '0',
        risk_amount: '0.00',
        minimum_sale_price: '0.00',
        target_margin_rate: '0',
        target_sale_price: '0.00',
        line_net_total: '0.00',
        discount_amount: '0.00',
        final_net_total: '0.00',
        contribution_amount: '0.00',
        contribution_ratio: '0',
        has_missing_labor_costs: true,
      },
    });

    if (view.priceAccess === 'hidden') throw new Error('priced view expected');
    expect(view.calculation.lines[0].pricing).toEqual(expect.objectContaining({
      internalCostAmount: null,
      priceListRate: null,
      effectiveUnitPrice: null,
      priceSource: null,
    }));
  });
});

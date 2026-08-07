import { describe, expect, it, vi } from 'vitest';

import type { FrappeClient } from '../../api/frappeClient';
import { createCalculationsV1Api } from './api';

const hiddenWireView = {
  conflict_token: 'v1',
  permissions: {
    price_access: 'hidden',
    can_edit: true,
    can_approve: false,
    can_transfer: false,
  },
  calculation: {
    id: 'KALK-1',
    number: 'KALK-1',
    company_id: 'HWERP GmbH',
    customer_id: 'CUST-1',
    project_id: null,
    price_group_id: 'Standard',
    responsible_user_id: 'user@example.com',
    status: 'draft',
    currency: 'EUR',
    notes: null,
    internal_notes: null,
    modified_at: 'v1',
    main_objects: [],
    lines: [],
  },
};

function client(overrides: Partial<FrappeClient> = {}): FrappeClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    setCsrfToken: vi.fn(),
    ...overrides,
  } as FrappeClient;
}

describe('calculations V1 API', () => {
  it('initializes from the current Frappe session and decodes calculation reads', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({
        user: 'user@example.com',
        roles: ['HWERP Calculation User'],
        price_level: 'C',
        csrf_token: 'csrf-v1',
      })
      .mockResolvedValueOnce(hiddenWireView);
    const frappe = client({ get });
    const api = createCalculationsV1Api(frappe);

    const session = await api.initializeSession();
    const view = await api.get('KALK/1');

    expect(session.user).toBe('user@example.com');
    expect(frappe.setCsrfToken).toHaveBeenCalledWith('csrf-v1');
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/api/method/hwerp.api.v1.calculations.get?name=KALK%2F1',
    );
    expect(view.calculation.id).toBe('KALK-1');
    expect(view.priceAccess).toBe('hidden');
  });

  it('saves the complete bundle in one POST with the optimistic conflict token', async () => {
    const post = vi.fn().mockResolvedValue(hiddenWireView);
    const frappe = client({ post });
    const api = createCalculationsV1Api(frappe);
    const bundle = { name: 'KALK-1', title: 'Neu', positions: [] };

    const view = await api.save(bundle, 'v1');

    expect(post).toHaveBeenCalledWith(
      '/api/method/hwerp.api.v1.calculations.save',
      { calculation: bundle },
      { conflictToken: 'v1' },
    );
    expect(view.conflictToken).toBe('v1');
  });

  it('uses controlled POST actions for approval and cancellation', async () => {
    const post = vi.fn().mockResolvedValue(hiddenWireView);
    const api = createCalculationsV1Api(client({ post }));

    await api.approve('KALK-1', 'v1');
    await api.cancel('KALK-1', 'v2');

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/method/hwerp.api.v1.calculations.approve',
      { calculation_name: 'KALK-1' },
      { conflictToken: 'v1' },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/method/hwerp.api.v1.calculations.cancel',
      { calculation_name: 'KALK-1' },
      { conflictToken: 'v2' },
    );
  });
});

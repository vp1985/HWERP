import type { FrappeClient } from '../../api/frappeClient';
import { decodeCalculationView, type V1CalculationView } from './domain';

const METHOD_BASE = '/api/method/hwerp.api.v1.calculations';

export interface HwerpSessionContext {
  user: string;
  roles: string[];
  priceLevel: 'A' | 'B' | 'C';
}

interface SessionWire {
  user: string;
  roles: string[];
  price_level: 'A' | 'B' | 'C';
  csrf_token: string;
}

export interface CalculationsV1Api {
  initializeSession(): Promise<HwerpSessionContext>;
  get(name: string): Promise<V1CalculationView>;
  save(bundle: Record<string, unknown>, conflictToken?: string): Promise<V1CalculationView>;
  approve(name: string, conflictToken?: string): Promise<V1CalculationView>;
  cancel(name: string, conflictToken?: string): Promise<V1CalculationView>;
}

export function createCalculationsV1Api(client: FrappeClient): CalculationsV1Api {
  return {
    async initializeSession(): Promise<HwerpSessionContext> {
      const session = await client.get<SessionWire>(`${METHOD_BASE}.session_context`);
      client.setCsrfToken(session.csrf_token);
      return {
        user: session.user,
        roles: [...session.roles],
        priceLevel: session.price_level,
      };
    },

    async get(name: string): Promise<V1CalculationView> {
      const wire = await client.get<unknown>(
        `${METHOD_BASE}.get?name=${encodeURIComponent(name)}`,
      );
      return decodeCalculationView(wire);
    },

    async save(
      bundle: Record<string, unknown>,
      conflictToken?: string,
    ): Promise<V1CalculationView> {
      const wire = await client.post<unknown, { calculation: Record<string, unknown> }>(
        `${METHOD_BASE}.save`,
        { calculation: bundle },
        { conflictToken },
      );
      return decodeCalculationView(wire);
    },

    async approve(name: string, conflictToken?: string): Promise<V1CalculationView> {
      const wire = await client.post<unknown, { calculation_name: string }>(
        `${METHOD_BASE}.approve`,
        { calculation_name: name },
        { conflictToken },
      );
      return decodeCalculationView(wire);
    },

    async cancel(name: string, conflictToken?: string): Promise<V1CalculationView> {
      const wire = await client.post<unknown, { calculation_name: string }>(
        `${METHOD_BASE}.cancel`,
        { calculation_name: name },
        { conflictToken },
      );
      return decodeCalculationView(wire);
    },
  };
}

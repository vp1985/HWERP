import { createRepository } from './repository';

/**
 * Get the next calculation number in format K-000001, K-000002, etc.
 */
export async function getNextCalcNumber(): Promise<string> {
  const repo = createRepository('local');
  return repo.getNextCalcNumber();
}

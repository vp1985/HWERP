import { describe, it, expect } from 'vitest';
import { haversineKm, estimateTravelHours } from './distanceUtils';

describe('haversineKm', () => {
  it('gibt 0 zurück wenn Start = Ziel', () => {
    expect(haversineKm(52.52, 13.405, 52.52, 13.405)).toBe(0);
  });

  it('berechnet Entfernung Berlin → Hamburg (~254 km)', () => {
    // Berlin: 52.52, 13.405 / Hamburg: 53.5511, 9.9937
    const km = haversineKm(52.52, 13.405, 53.5511, 9.9937);
    expect(km).toBeGreaterThan(240);
    expect(km).toBeLessThan(270);
  });

  it('berechnet Entfernung München → Frankfurt (~300 km)', () => {
    // München: 48.1351, 11.582 / Frankfurt: 50.1109, 8.6821
    const km = haversineKm(48.1351, 11.582, 50.1109, 8.6821);
    expect(km).toBeGreaterThan(280);
    expect(km).toBeLessThan(330);
  });

  it('ist symmetrisch (hin = zurück)', () => {
    const ab = haversineKm(52.52, 13.405, 48.1351, 11.582);
    const ba = haversineKm(48.1351, 11.582, 52.52, 13.405);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001);
  });

  it('gibt positive Werte bei negativen Koordinaten zurück', () => {
    // São Paulo → Buenos Aires (~1674 km Luftlinie)
    const km = haversineKm(-23.5505, -46.6333, -34.6037, -58.3816);
    expect(km).toBeGreaterThan(1600);
    expect(km).toBeLessThan(1750);
  });
});

describe('estimateTravelHours', () => {
  it('gibt 0 zurück für 0 km', () => {
    expect(estimateTravelHours(0)).toBe(0);
  });

  it('70 km → 1.0 h (70 km/h)', () => {
    expect(estimateTravelHours(70)).toBe(1.0);
  });

  it('35 km → 0.5 h', () => {
    expect(estimateTravelHours(35)).toBe(0.5);
  });

  it('rundet auf 0.25 h', () => {
    // 80 km / 70 = 1.142... → nächster 0.25-Schritt: 1.25
    expect(estimateTravelHours(80)).toBe(1.25);
  });

  it('17.5 km → 0.25 h (kleinste Einheit)', () => {
    expect(estimateTravelHours(17.5)).toBe(0.25);
  });

  it('140 km → 2.0 h', () => {
    expect(estimateTravelHours(140)).toBe(2.0);
  });

  it('105 km → 1.5 h', () => {
    expect(estimateTravelHours(105)).toBe(1.5);
  });
});

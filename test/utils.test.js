import { describe, it, expect } from 'vitest';
import { blackScholesPrice, greeks, impliedVolatility } from '../src/utils.js';

describe('options math', () => {
  it('blackScholesPrice returns positive values', () => {
    const c = blackScholesPrice({ S: 100, K: 100, T: 30 / 365, v: 0.5, r: 0.03, isCall: true });
    const p = blackScholesPrice({ S: 100, K: 100, T: 30 / 365, v: 0.5, r: 0.03, isCall: false });
    expect(c).toBeGreaterThan(0);
    expect(p).toBeGreaterThan(0);
  });

  it('greeks contains finite numbers', () => {
    const g = greeks({ S: 100, K: 100, T: 14 / 365, v: 0.6, r: 0.03, isCall: true });
    expect(Number.isFinite(g.delta)).toBe(true);
    expect(Number.isFinite(g.gamma)).toBe(true);
    expect(Number.isFinite(g.vega)).toBe(true);
    expect(Number.isFinite(g.theta)).toBe(true);
    expect(Number.isFinite(g.rho)).toBe(true);
  });

  it('implied volatility inversion is stable', () => {
    const market = blackScholesPrice({ S: 100, K: 100, T: 20 / 365, v: 0.45, r: 0.03, isCall: true });
    const iv = impliedVolatility({ marketPrice: market, S: 100, K: 100, T: 20 / 365, r: 0.03, isCall: true });
    expect(iv).toBeGreaterThan(0.1);
    expect(iv).toBeLessThan(2);
  });
});

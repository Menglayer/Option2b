export function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function labelByDays(days) {
  if (days <= 1) return '1D';
  if (days <= 2) return '2D';
  if (days <= 3) return '3D';
  if (days <= 8) return '7D';
  if (days <= 18) return '14D';
  if (days <= 40) return '30D';
  return `${days}D`;
}

export function parseDeribitDateToken(token) {
  const m = token?.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monMap = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const month = monMap[m[2]];
  const year = 2000 + parseInt(m[3], 10);
  if (month === undefined) return null;
  return new Date(Date.UTC(year, month, day, 8, 0, 0));
}

export function approxNormCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + 1.330274429 * t))));
  return x > 0 ? 1 - p : p;
}

export function calcDelta(S, K, T, v, isCall) {
  if (T <= 0 || v <= 0) return isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0);
  const d1 = (Math.log(S / K) + (0 + v * v / 2) * T) / (v * Math.sqrt(T));
  const cdf = approxNormCDF(d1);
  return isCall ? cdf : cdf - 1;
}

export function normPDF(x) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

function safeVol(v) {
  return Math.max(1e-4, Math.min(v, 6));
}

function safeT(T) {
  return Math.max(1e-8, T);
}

export function blackScholesPrice({ S, K, T, v, r = 0, isCall = true }) {
  const vol = safeVol(v);
  const t = safeT(T);
  if (S <= 0 || K <= 0) return 0;

  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(S / K) + (r + 0.5 * vol * vol) * t) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const df = Math.exp(-r * t);

  if (isCall) {
    return S * approxNormCDF(d1) - K * df * approxNormCDF(d2);
  }
  return K * df * approxNormCDF(-d2) - S * approxNormCDF(-d1);
}

export function greeks({ S, K, T, v, r = 0, isCall = true }) {
  const vol = safeVol(v);
  const t = safeT(T);
  if (S <= 0 || K <= 0) {
    return { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };
  }

  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(S / K) + (r + 0.5 * vol * vol) * t) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const pdf = normPDF(d1);
  const cdf1 = approxNormCDF(d1);
  const cdf2 = approxNormCDF(d2);
  const df = Math.exp(-r * t);

  const delta = isCall ? cdf1 : cdf1 - 1;
  const gamma = pdf / (S * vol * sqrtT);
  const vega = S * pdf * sqrtT / 100;

  const thetaRawCall = -((S * pdf * vol) / (2 * sqrtT)) - r * K * df * cdf2;
  const thetaRawPut = -((S * pdf * vol) / (2 * sqrtT)) + r * K * df * approxNormCDF(-d2);
  const theta = (isCall ? thetaRawCall : thetaRawPut) / 365;

  const rhoCall = (K * t * df * cdf2) / 100;
  const rhoPut = (-K * t * df * approxNormCDF(-d2)) / 100;
  const rho = isCall ? rhoCall : rhoPut;

  return { delta, gamma, vega, theta, rho };
}

export function impliedVolatility({ marketPrice, S, K, T, r = 0, isCall = true }) {
  if (!Number.isFinite(marketPrice) || marketPrice <= 0 || S <= 0 || K <= 0 || T <= 0) {
    return 0.5;
  }

  let lo = 1e-4;
  let hi = 4;
  let mid = 0.5;

  for (let i = 0; i < 100; i++) {
    mid = (lo + hi) / 2;
    const p = blackScholesPrice({ S, K, T, v: mid, r, isCall });
    const diff = p - marketPrice;
    if (Math.abs(diff) < 1e-5) break;
    if (diff > 0) hi = mid;
    else lo = mid;
  }

  return safeVol(mid);
}

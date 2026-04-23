import { blackScholesPrice } from '../utils.js';

function linePayoff(legs, spot, notional) {
  let pnl = 0;
  for (const leg of legs) {
    const qty = leg.qty || 1;
    const strike = leg.strike;
    const premium = leg.premium;
    const isCall = leg.type === 'CALL';
    const intrinsic = isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    const one = leg.side === 'BUY' ? (intrinsic - premium) : (premium - intrinsic);
    pnl += one * qty;
  }
  return pnl * notional;
}

function buildLegsFromUI() {
  const strategyType = document.getElementById('strategyType')?.value || 'call_spread';
  const k1 = parseFloat(document.getElementById('leg1Strike')?.value || '0');
  const k2 = parseFloat(document.getElementById('leg2Strike')?.value || '0');
  const v = parseFloat(document.getElementById('strategyIv')?.value || '60') / 100;
  const tDays = parseFloat(document.getElementById('strategyDays')?.value || '7');
  const s = parseFloat(document.getElementById('strategySpot')?.value || '0');
  const r = 0.03;
  const T = Math.max(1, tDays) / 365;

  if (!(s > 0 && k1 > 0 && k2 > 0)) return { strategyType, legs: [] };

  if (strategyType === 'call_spread') {
    const buyPremium = blackScholesPrice({ S: s, K: Math.min(k1, k2), T, v, r, isCall: true });
    const sellPremium = blackScholesPrice({ S: s, K: Math.max(k1, k2), T, v, r, isCall: true });
    return {
      strategyType,
      legs: [
        { side: 'BUY', type: 'CALL', strike: Math.min(k1, k2), premium: buyPremium, qty: 1 },
        { side: 'SELL', type: 'CALL', strike: Math.max(k1, k2), premium: sellPremium, qty: 1 },
      ],
    };
  }

  const c = blackScholesPrice({ S: s, K: k1, T, v, r, isCall: true });
  const p = blackScholesPrice({ S: s, K: k1, T, v, r, isCall: false });
  return {
    strategyType,
    legs: [
      { side: 'SELL', type: 'CALL', strike: k1, premium: c, qty: 1 },
      { side: 'SELL', type: 'PUT', strike: k1, premium: p, qty: 1 },
    ],
  };
}

export function runStrategyBuilder(state) {
  const result = document.getElementById('strategyResult');
  const canvas = document.getElementById('strategyCanvas');
  if (!result || !canvas) return;

  const spot = parseFloat(document.getElementById('strategySpot')?.value || String(state.price || 0));
  const notional = parseFloat(document.getElementById('strategyNotional')?.value || '1');
  const { strategyType, legs } = buildLegsFromUI();
  if (!legs.length || !(spot > 0)) {
    result.innerHTML = '<span class="negative">请先填写策略参数</span>';
    return;
  }

  const minS = spot * 0.7;
  const maxS = spot * 1.3;
  const points = [];
  for (let i = 0; i <= 180; i++) {
    const s = minS + (maxS - minS) * (i / 180);
    points.push({ s, pnl: linePayoff(legs, s, notional) });
  }

  const maxP = Math.max(...points.map(p => p.pnl));
  const minP = Math.min(...points.map(p => p.pnl));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const pad = 24;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'transparent';
  ctx.fillRect(0, 0, w, h);

  const yOf = (v) => h - pad - ((v - minP) / Math.max(maxP - minP, 1e-6)) * (h - pad * 2);
  const xOf = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);

  const y0 = yOf(0);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y0);
  ctx.lineTo(w - pad, y0);
  ctx.stroke();

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xOf(i);
    const y = yOf(p.pnl);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#0ea5a6';
  ctx.lineWidth = 2;
  ctx.stroke();

  const atSpot = linePayoff(legs, spot, notional);
  const best = maxP;
  const worst = minP;
  result.innerHTML = `策略：<strong>${strategyType === 'call_spread' ? '牛市看涨价差' : '卖出跨式'}</strong><br/>当前点位预估：<strong>$${atSpot.toFixed(2)}</strong> · 区间最优：$${best.toFixed(2)} · 最差：$${worst.toFixed(2)}`;
}

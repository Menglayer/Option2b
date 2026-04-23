import { labelByDays, parseDeribitDateToken, calcDelta, greeks, impliedVolatility } from './utils.js';

export function generateData(price, type, coin = 'BTC') {
  const p = Math.round(price);
  const isCall = type === 'CALL';
  
  const interval = coin === 'ETH' ? 50 : 1000;
  
  const strikes = isCall
    ? [Math.round((p * 1.02) / interval) * interval, Math.round((p * 1.04) / interval) * interval, Math.round((p * 1.06) / interval) * interval, Math.round((p * 1.08) / interval) * interval]
    : [Math.round((p * 0.96) / interval) * interval, Math.round((p * 0.94) / interval) * interval, Math.round((p * 0.92) / interval) * interval, Math.round((p * 0.90) / interval) * interval];

  const exchanges = [
    { name: 'Binance', tagClass: 'binance', spread: 0.32 },
    { name: 'OKX', tagClass: 'okx', spread: 0.28 },
    { name: 'Bybit', tagClass: 'bybit', spread: 0.26 },
  ];

  const expiries = [
    { label: '1D', days: 1, mult: 0.45 },
    { label: '2D', days: 2, mult: 0.6 },
    { label: '3D', days: 3, mult: 0.75 },
    { label: '7D', days: 7, mult: 1.0 },
    { label: '14D', days: 14, mult: 1.35 },
    { label: '30D', days: 30, mult: 1.7 },
  ];

  const products = [];
  exchanges.forEach(ex => {
    expiries.forEach((exp, ei) => {
      const strike = strikes[ei % strikes.length] || strikes[0];
      const otmPct = isCall ? (strike / p - 1) : (1 - strike / p);
      const baseApr = (otmPct * 800 + 8) * exp.mult;
      const optionApr = baseApr + (Math.random() * 6 - 3);
      const hiddenSpread = ex.spread + (Math.random() * 0.08);
      const dualApr = optionApr * (1 - hiddenSpread);
      const delta = calcDelta(p, strike, exp.days / 365, 0.5, isCall);
      products.push({
        exchange: ex.name,
        tagClass: ex.tagClass,
        investCoin: coin,
        strikePrice: strike,
        expiry: exp.label,
        expiryDays: exp.days,
        optionExpiry: exp.label,
        optionExpiryDays: exp.days,
        optionType: type,
        dualApr: Math.max(dualApr, 1),
        optionApr: Math.max(optionApr, 5),
        hiddenSpread,
        distance: ((strike / p - 1) * 100).toFixed(1) + '%',
        delta: Math.abs(delta)
      });
    });
  });

  const optSources = [
    { name: 'Coincall', tagClass: 'coincall', markup: 1.0 },
    { name: 'Deribit', tagClass: 'deribit', markup: 0.95 },
  ];
  const options = [];
  optSources.forEach(src => {
    expiries.forEach((exp, si) => {
      const strike = strikes[si % strikes.length] || strikes[0];
      const otmPct = isCall ? (strike / p - 1) : (1 - strike / p);
      const rawPremium = (otmPct * 0.5 + 0.01) * src.markup * (exp.days / 7);
      const bid = rawPremium * 0.94;
      const ask = rawPremium * 1.06;
      const mid = (bid + ask) / 2;
      const apr = (mid / exp.days) * 365 * 100;
      options.push({
        exchange: src.name,
        tagClass: src.tagClass,
        strikePrice: strike,
        expiry: exp.label,
        expiryDays: exp.days,
        optionType: type,
        bid,
        ask,
        mid,
        apr: Math.max(apr, 3),
      });
    });
  });

  return { products, options };
}

export function buildFromDeribit(rows, type, currentPrice, coin = 'BTC') {
  const now = Date.now();
  const typeLetter = type === 'CALL' ? 'C' : 'P';
  const parsed = rows.map(r => {
    const parts = (r.instrument_name || '').split('-');
    if (parts.length < 4) return null;
    const strike = parseFloat(parts[2]);
    const cp = parts[3];
    const expiryDate = parseDeribitDateToken(parts[1]);
    if (!strike || !expiryDate || cp !== typeLetter) return null;
    const days = (expiryDate.getTime() - now) / 86400000;
    if (days <= 0.8) return null;
    const und = Number(r.underlying_price) || Number(currentPrice) || 0;
    const bid = Number(r.bid_price || 0);
    const ask = Number(r.ask_price || 0);
    const mark = Number(r.mark_price || 0);
    const premiumPct = und > 0 ? mark : 0;
    const apr = premiumPct > 0 ? premiumPct * (365 / days) * 100 : 0;
      const markIv = Number(r.mark_iv) / 100;
      const marketPrice = Math.max(0, mark * (und > 0 ? und : currentPrice || 0));
      const iv = markIv > 0 ? markIv : impliedVolatility({
        marketPrice,
        S: und > 0 ? und : currentPrice,
        K: strike,
        T: days / 365,
        r: 0.03,
        isCall: type === 'CALL',
      });
      const g = greeks({
        S: und > 0 ? und : currentPrice,
        K: strike,
        T: days / 365,
        v: iv,
        r: 0.03,
        isCall: type === 'CALL',
      });
      const delta = calcDelta(und > 0 ? und : currentPrice, strike, days / 365, iv, type === 'CALL');
      return {
        exchange: 'Deribit',
        tagClass: 'deribit',
        strikePrice: strike,
        optionType: type,
        expiryDays: Math.max(1, Math.round(days)),
        expiry: labelByDays(Math.round(days)),
        bid,
        ask,
        mid: mark,
        apr: Math.max(0, apr),
        liquidity: Number(r.volume_usd || 0),
        distanceAbs: Math.abs(strike - und),
        underlying: und,
        iv,
        delta: Math.abs(delta),
        gamma: g.gamma,
        vega: g.vega,
        theta: g.theta,
        rho: g.rho,
      };
  }).filter(Boolean);

  const und = currentPrice || parsed[0]?.underlying || 0;
  const otmFiltered = parsed
    .filter(o => type === 'CALL' ? o.strikePrice >= und : o.strikePrice <= und)
    .sort((a, b) => (a.expiryDays - b.expiryDays) || (a.distanceAbs - b.distanceAbs) || (b.liquidity - a.liquidity));

  const ultraShort = otmFiltered.filter(o => o.expiryDays <= 3);
  const short = otmFiltered.filter(o => o.expiryDays > 3 && o.expiryDays <= 10);
  const mid = otmFiltered.filter(o => o.expiryDays > 10);
  const options = [...ultraShort, ...short, ...mid].slice(0, 24);

  const exchanges = [
    { name: 'Binance', tagClass: 'binance', spread: 0.33 },
    { name: 'OKX', tagClass: 'okx', spread: 0.29 },
    { name: 'Bybit', tagClass: 'bybit', spread: 0.26 },
  ];

  const products = [];
  const tenorPick = [];
  const pushByTenor = (arr, maxPerTenor = 4) => {
    const m = new Map();
    for (const it of arr) {
      const k = it.expiry || `${it.expiryDays}D`;
      if (!m.has(k)) m.set(k, 0);
      if (m.get(k) < maxPerTenor) {
        tenorPick.push(it);
        m.set(k, m.get(k) + 1);
      }
    }
  };
  pushByTenor(ultraShort, 5);
  pushByTenor(short, 4);
  pushByTenor(mid, 3);
  const seed = tenorPick.length ? tenorPick.slice(0, 18) : options.slice(0, 12);
  for (const s of seed) {
    for (const ex of exchanges) {
      const hidden = ex.spread;
      const dualApr = s.apr * (1 - hidden);
      const distance = und > 0 ? ((s.strikePrice / und - 1) * 100) : 0;
      products.push({
        exchange: ex.name,
        tagClass: ex.tagClass,
        investCoin: coin,
        strikePrice: s.strikePrice,
        expiry: s.expiry,
        expiryDays: s.expiryDays,
        optionExpiry: s.expiry,
        optionExpiryDays: s.expiryDays,
        optionType: type,
        dualApr: Math.max(0.5, dualApr),
        optionApr: Math.max(0.8, s.apr),
        hiddenSpread: hidden,
        distance: `${distance >= 0 ? '+' : ''}${distance.toFixed(1)}%`,
        delta: s.delta || 0,
        iv: s.iv || 0.5,
        gamma: s.gamma || 0,
        vega: s.vega || 0,
        theta: s.theta || 0,
        rho: s.rho || 0,
      });
    }
  }

  const mergedOptions = [];
  for (const o of options) {
    mergedOptions.push(o);
    mergedOptions.push({
      ...o,
      exchange: 'Coincall',
      tagClass: 'coincall',
      bid: o.bid * 0.97,
      ask: o.ask * 1.02,
      mid: o.mid * 0.995,
      apr: o.apr * 1.01,
    });
  }

  return {
    products,
    options: mergedOptions.slice(0, 30),
  };
}

// (Static-only GitHub Pages build) Keep data generation fully client-side.

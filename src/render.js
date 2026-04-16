import { setHtml } from './utils.js';

function normalizeTenorKey(v) {
  return String(v || '').trim().toUpperCase();
}

export function getTenorKey(item) {
  return normalizeTenorKey(item.expiry || `${item.expiryDays || 0}D`);
}

export function showLoading() {
  setHtml('mainBody', '<tr><td colspan="11" class="loading-cell"><div class="skeleton-text"></div></td></tr>');
}

export function updatePriceDisplay(state) {
  const el = document.getElementById('livePrice');
  const chg = document.getElementById('priceChange');
  el.textContent = '$' + (state.price ? state.price.toLocaleString() : '--');
  if (state.change24h !== null) {
    chg.textContent = (state.change24h >= 0 ? '+' : '') + state.change24h.toFixed(2) + '%';
    chg.className = 'price-change ' + (state.change24h >= 0 ? 'up' : 'down');
  }
}

export function renderSummary(state) {
  const P = state.products;
  if (!P.length) return;
  const avgDual = P.reduce((s, p) => s + p.dualApr, 0) / P.length;
  const avgOpt = P.reduce((s, p) => s + p.optionApr, 0) / P.length;
  const gap = avgOpt - avgDual;
  const days = state.targetDays || 7;
  const loss = state.notional * (gap / 100) * (days / 365);
  const rr = avgDual > 0 ? (avgOpt / avgDual) : 0;

  const gaps = P.map(p => (p.optionApr || 0) - (p.dualApr || 0)).sort((a, b) => a - b);
  const maxGap = gaps.length ? gaps[gaps.length - 1] : 0;
  const medianGap = gaps.length
    ? (gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2)
    : 0;
  const takeRate = avgOpt > 0 ? ((gap / avgOpt) * 100) : 0;

  setHtml('avgDualApr', avgDual.toFixed(1) + '%');
  setHtml('avgOptionApr', avgOpt.toFixed(1) + '%');
  setHtml('avgGap', (gap >= 0 ? '+' : '') + gap.toFixed(1) + '%');
  setHtml('annualLoss', '$' + loss.toFixed(0));
  setHtml('rrRatio', rr > 0 ? rr.toFixed(2) + 'x' : '--');
  setHtml('maxGap', (maxGap >= 0 ? '+' : '') + maxGap.toFixed(1) + '%');
  setHtml('medianGap', (medianGap >= 0 ? '+' : '') + medianGap.toFixed(1) + '%');
  setHtml('cexTakeRate', takeRate.toFixed(1) + '%');
  setHtml('productCount', `共 ${P.length} 个产品`);
}

export function renderMainTable(state) {
  const tbody = document.getElementById('mainBody');
  const activeKey = normalizeTenorKey(state.activeTenorTab || 'ALL');
  const base = state.activeTenorTab && state.activeTenorTab !== 'ALL'
    ? state.products.filter(p => getTenorKey(p) === activeKey)
    : state.products;

  const pre = [...base].filter(p => {
    if (state.moneynessFilter === 'ALL') return true;
    const dist = Math.abs(parseFloat(String(p.distance).replace('%', '').replace('+', '')) || 0);
    if (state.moneynessFilter === 'ATM') return dist <= 3.5;
    if (state.moneynessFilter === 'OTM') return dist > 3.5;
    return true;
  });

  const P = pre.sort((a, b) => {
    if (state.sortBy === 'apy') return (b.optionApr || 0) - (a.optionApr || 0);
    if (state.sortBy === 'distance') {
      const da = Math.abs(parseFloat(String(a.distance).replace('%', '').replace('+', '')) || 0);
      const db = Math.abs(parseFloat(String(b.distance).replace('%', '').replace('+', '')) || 0);
      return da - db;
    }
    const d = Math.abs((a.expiryDays || 7) - (state.targetDays || 1)) - Math.abs((b.expiryDays || 7) - (state.targetDays || 1));
    if (d !== 0) return d;
    return (a.hiddenSpread || 0) - (b.hiddenSpread || 0);
  });

  if (!P.length) {
    tbody.innerHTML = '<tr><td colspan="12" class="muted center">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = P.map(p => {
    const gap = p.optionApr - p.dualApr;
    const gapPct = (gap / p.optionApr) * 100;
    const dualDays = p.expiryDays || state.targetDays || 7;
    const optionDays = p.optionExpiryDays || dualDays;
    const usedDays = Math.min(dualDays, optionDays);
    const loss = state.notional * (gap / 100) * (usedDays / 365);

    let rating, rCls;
    if (gapPct <= 25) { rating = 'A'; rCls = 'green'; }
    else if (gapPct <= 32) { rating = 'B'; rCls = 'yellow'; }
    else if (gapPct <= 40) { rating = 'C'; rCls = 'red'; }
    else { rating = 'D'; rCls = 'red'; }

    const liqScore = Math.max(1, Math.min(99, Math.round(100 - Math.abs(gapPct - 25) * 1.6)));
    const liqLabel = liqScore > 70 ? '高' : liqScore > 45 ? '中' : '低';

    return `<tr>
      <td><span class="tag ${p.tagClass}">${p.exchange}</span></td>
      <td>${p.optionType}</td>
      <td>$${p.strikePrice.toLocaleString()}</td>
      <td class="muted">${p.distance}</td>
      <td>${p.expiry} (${dualDays}d)</td>
      <td>${p.optionExpiry || p.expiry} (${optionDays}d)</td>
      <td class="accent">${p.dualApr.toFixed(1)}%</td>
      <td class="positive">${p.optionApr.toFixed(1)}%</td>
      <td class="negative">${gap >= 0 ? '+' : ''}${gap.toFixed(1)}% <span class="muted">(${gapPct.toFixed(0)}%)</span></td>
      <td class="negative">$${loss.toFixed(2)}</td>
      <td><span class="tag ${liqScore > 70 ? 'green' : liqScore > 45 ? 'yellow' : 'red'}">${liqLabel} ${liqScore}</span></td>
      <td><span class="tag ${rCls}">${rating}</span></td>
    </tr>`;
  }).join('');
}

export function renderTenorTabs(state, onSelect) {
  const box = document.getElementById('tenorTabs');
  if (!box) return;

  const keys = Array.from(new Set(state.products.map(getTenorKey)))
    .filter(Boolean)
    .sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });

  const tabs = ['ALL', ...keys];
  const active = normalizeTenorKey(state.activeTenorTab || 'ALL');

  box.innerHTML = tabs.map(k => {
    const label = k === 'ALL' ? '全部' : k;
    const cls = k === active ? 'tenor-tab active' : 'tenor-tab';
    return `<button type="button" class="${cls}" data-tenor="${k}">${label}</button>`;
  }).join('');

  box.querySelectorAll('.tenor-tab').forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.getAttribute('data-tenor') || 'ALL'));
  });
}

export function renderOptionsTable(state) {
  const tbody = document.getElementById('optBody');
  const O = [...state.options].sort((a, b) => {
    const d = Math.abs((a.expiryDays || 7) - (state.targetDays || 1)) - Math.abs((b.expiryDays || 7) - (state.targetDays || 1));
    if (d !== 0) return d;
    return (a.strikePrice || 0) - (b.strikePrice || 0);
  });

  if (!O.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted center">等待数据</td></tr>';
    return;
  }

  tbody.innerHTML = O.map(o => `<tr>
    <td><span class="tag ${o.tagClass}">${o.exchange}</span></td>
    <td>${o.optionType}</td>
    <td>$${o.strikePrice.toLocaleString()}</td>
    <td>${o.expiry} (${o.expiryDays}d)</td>
    <td>${(o.bid * 100).toFixed(2)}%</td>
    <td>${(o.ask * 100).toFixed(2)}%</td>
    <td class="positive">${o.apr.toFixed(1)}%</td>
  </tr>`).join('');
}

export function updateTime(state) {
  const el = document.getElementById('lastUpdate');
  if (state.lastUpdate) {
    el.textContent = state.lastUpdate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

export function renderAll(state) {
  renderSummary(state);
  renderMainTable(state);
  renderOptionsTable(state);
  updateTime(state);
}

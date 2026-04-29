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

function animateValue(id, value, formatFn) {
  const el = document.getElementById(id);
  if (!el) return;
  const currentText = el.innerText.replace(/[^0-9.-]/g, '');
  const start = parseFloat(currentText) || 0;
  const end = value;
  const duration = 600;
  let startTimestamp = null;
  
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const cur = start + eased * (end - start);
    el.innerHTML = formatFn(cur);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
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

  animateValue('avgDualApr', avgDual, v => v.toFixed(1) + '%');
  animateValue('avgOptionApr', avgOpt, v => v.toFixed(1) + '%');
  animateValue('avgGap', gap, v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%');
  animateValue('annualLoss', loss, v => '$' + v.toFixed(0));
  animateValue('rrRatio', rr, v => v > 0 ? v.toFixed(2) + 'x' : '--');
  animateValue('maxGap', maxGap, v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%');
  animateValue('medianGap', medianGap, v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%');
  animateValue('cexTakeRate', takeRate, v => v.toFixed(1) + '%');
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
  }).filter(p => {
    const spreadPct = p.optionApr > 0 ? ((p.optionApr - p.dualApr) / p.optionApr) * 100 : 100;
    const liq = Number.isFinite(p.liquidity) ? p.liquidity : Math.max(1, Math.round(100 - Math.abs(spreadPct - 25) * 1.6));
    if (liq < (state.minLiquidity || 0)) return false;
    if ((p.optionApr || 0) < (state.minOptionApr || 0)) return false;
    if (spreadPct > (state.maxTakeRate ?? 100)) return false;
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

  const rows = P.map(p => {
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
    const atmDist = Math.abs(parseFloat(String(p.distance).replace('%', '').replace('+', '')) || 0);
    const distCls = atmDist <= 3 ? 'atm-emph' : atmDist <= 7 ? 'atm-mid' : '';

    return `<tr onclick="this.nextElementSibling.querySelector('.row-details-wrapper').classList.toggle('expanded')" title="点击查看详情">
      <td><span class="tag ${p.tagClass}">${p.exchange}</span></td>
      <td>${p.optionType}</td>
      <td>$${p.strikePrice.toLocaleString()}</td>
      <td class="muted ${distCls}">${p.distance}</td>
      <td>${p.expiry} <span class="muted" style="font-size:11px">(${dualDays}d)</span></td>
      <td>${p.optionExpiry || p.expiry} <span class="muted" style="font-size:11px">(${optionDays}d)</span></td>
      <td class="accent">${p.dualApr.toFixed(1)}%</td>
      <td class="positive">${p.optionApr.toFixed(1)}%</td>
      <td class="negative"><span class="spread-chip ${gapPct > 35 ? 'high' : gapPct > 25 ? 'mid' : 'low'}">${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%</span> <span class="muted">(${gapPct.toFixed(0)}%)</span></td>
      <td class="negative">$${loss.toFixed(2)}</td>
      <td><span class="tag ${liqScore > 70 ? 'green' : liqScore > 45 ? 'yellow' : 'red'}">${liqLabel} ${liqScore}</span></td>
      <td><span class="tag ${rCls}">${rating}</span></td>
    </tr>
    <tr class="row-divider"><td colspan="12">
      <div class="row-details-wrapper">
        <div class="row-details-inner">
          <div><strong>流动性分析:</strong> ${liqLabel} (参考值)</div>
          <div><strong>隐藏费率:</strong> 此交易所期权溢价率为 ${(gapPct).toFixed(1)}%。</div>
          <div><strong>收益差距:</strong> 如果用 ${state.notional.toLocaleString()} 刀，到期相差 $${loss.toFixed(2)}，年化缩水 ${gap.toFixed(1)}%。</div>
        </div>
      </div>
    </td></tr>`;
  }).join('');
  
  tbody.innerHTML = rows;

  // Add visual sorting cues
  document.querySelectorAll('th.sortable').forEach(th => {
    th.innerHTML = th.innerHTML.replace(' ↓', '');
    if (th.getAttribute('data-sort') === state.sortBy) {
      th.innerHTML += ' ↓';
    }
    // Also attach click listeners to headers for quick sort!
    th.style.cursor = 'pointer';
    th.onclick = () => {
      document.dispatchEvent(new CustomEvent('updateSortBy', { detail: th.getAttribute('data-sort') }));
    };
  });
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

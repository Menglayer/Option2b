import { state } from './src/state.js';
import { api } from './src/api.js';
import { generateData, buildFromDeribit } from './src/data.js';
import { applyUserTargets } from './src/filters.js';
import { renderAll, renderTenorTabs, showLoading, updatePriceDisplay } from './src/render.js';
import { calculateProfit } from './src/features/calculator.js';
import { renderRecommendations } from './src/features/recommend.js';
import { toggleOracle, sendOracleMsg } from './src/features/oracle.js';

const GREEKS_DATA = [
  { symbol: 'Δ Delta', name: '价格敏感度', desc: '标的价格每变化 1%，期权价格的变化倾向。常被视为近似行权概率。' },
  { symbol: 'Γ Gamma', name: 'Delta 变化率', desc: '价格变动时 Delta 变化的速度。临近 ATM 和到期时更敏感。' },
  { symbol: 'Θ Theta', name: '时间价值衰减', desc: '时间流逝导致期权价值衰减。卖方通常受益于 Theta。' },
  { symbol: 'V Vega', name: '波动率敏感度', desc: '隐含波动率变化对期权价格的影响。IV 上升通常抬升期权价格。' },
];

const FORMULAS = [
  { title: '到期损失折算', expr: '损失 = 本金 × (期权APY - 双币APY) × (到期天数 / 365)' },
  { title: '隐藏价差', expr: '隐藏价差% = (期权APY - 双币APY) / 期权APY' },
  { title: '期权年化估算', expr: 'APY ≈ Premium% × (365 / 到期天数)' },
  { title: '双币真实收益', expr: '真实收益 = 报价收益 - 隐含扣费(Spread)' },
];

const FAQ_DATA = [
  { q: '双币理财和直接卖出期权的核心差异？', a: '风险结构接近，但双币理财通常被交易所扣掉部分 premium，透明度也更低。' },
  { q: '为什么同样执行价与到期，双币 APY 往往更低？', a: '主要是 premium spread（隐藏价差），以及定价刷新频率与流动性差异。' },
  { q: '何时更适合 CALL？', a: '震荡或温和看涨、希望提升持币收益时。' },
  { q: '何时更适合 PUT？', a: '愿意在回调时接币，且希望先收取 premium 时。' },
];

function playEntrySplash() {
  const splash = document.getElementById('entrySplash');
  if (!splash) return;
  const metricEl = document.getElementById('entryMetricValue');

  // 每次进入页面触发，若想每天只触发一次可改 localStorage 控制
  splash.classList.add('show');
  requestAnimationFrame(() => {
    splash.classList.add('play');
  });

  if (metricEl) {
    const randomSplash = -(Math.random() * 20 + 20); // random between -20.0 and -40.0
    animateMetric(metricEl, randomSplash, 1050);
  }

  setTimeout(() => {
    splash.classList.add('exit');
  }, 2300);

  setTimeout(() => {
    splash.remove();
  }, 3150);
}

function animateMetric(el, target, durationMs) {
  const start = performance.now();
  const from = -1.2;

  const tick = now => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (target - from) * eased;
    el.textContent = `${v.toFixed(1)}%`;
    if (t < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}

async function init() {
  showLoading();
  try {
    try {
      const { price, change24h } = await api.btcPrice();
      state.price = price;
      state.change24h = change24h;
    } catch {
      const { price, change24h } = await api.coingeckoPrice();
      state.price = price;
      state.change24h = change24h;
    }

    updatePriceDisplay(state);
    syncMarketInputs();

    if (state.mode === 'online') {
      let deribitData = null;
      try {
        deribitData = await api.deribitOptions();
        state.deribitRaw = deribitData;
      } catch {
        state.deribitRaw = null;
      }

      if (deribitData && deribitData.length > 0) {
        const out = buildFromDeribit(deribitData, state.type, state.price);
        state.products = out.products;
        state.options = out.options;
      } else {
        const out = generateData(state.price, state.type);
        state.products = out.products;
        state.options = out.options;
      }

    } else {
      const out = generateData(state.price, state.type);
      state.products = out.products;
      state.options = out.options;
      state.deribitRaw = null;
    }

    state.rawProducts = [...state.products];
    state.rawOptions = [...state.options];
    applyUserTargets(state);

    state.lastUpdate = new Date();
    renderAll(state);
    renderTenorTabs(state, setTenorTab);
    renderRecommendations(state);
    renderKnowledgePanels();
    updateVolatilityInsights();
  } catch (err) {
    console.error('Init failed:', err);
    state.price = state.price || 97000;
    const out = generateData(state.price, state.type);
    state.products = out.products;
    state.options = out.options;
    state.rawProducts = [...state.products];
    state.rawOptions = [...state.options];
    applyUserTargets(state);
    state.lastUpdate = new Date();
    updatePriceDisplay(state);
    syncMarketInputs();
    renderAll(state);
    renderTenorTabs(state, setTenorTab);
    renderRecommendations(state);
    renderKnowledgePanels();
    updateVolatilityInsights();
  }
}

async function fetchAllData() {
  if (state.loading) return;
  state.loading = true;
  const btn = document.getElementById('refreshBtn');
  const expBtn = document.getElementById('exportBtn');
  btn.disabled = true;
  if(expBtn) expBtn.disabled = true;
  btn.textContent = '⏳...';

  await init();

  btn.disabled = false;
  if(expBtn) expBtn.disabled = false;
  btn.textContent = '🔄 刷新';
  state.loading = false;
}

function switchType(type) {
  state.type = type;
  document.getElementById('btnCall').classList.toggle('active', type === 'CALL');
  document.getElementById('btnCall').classList.toggle('put', false);
  document.getElementById('btnPut').classList.toggle('active', type === 'PUT');
  document.getElementById('btnPut').classList.toggle('put', true);

  if (state.price) {
    if (state.mode === 'online' && state.deribitRaw?.length) {
      const out = buildFromDeribit(state.deribitRaw, state.type, state.price);
      state.products = out.products;
      state.options = out.options;
    } else {
      const out = generateData(state.price, state.type);
      state.products = out.products;
      state.options = out.options;
    }
    state.rawProducts = [...state.products];
    state.rawOptions = [...state.options];
    applyUserTargets(state);
    state.lastUpdate = new Date();
    renderAll(state);
    renderTenorTabs(state, setTenorTab);
    renderRecommendations(state);
    updateVolatilityInsights();
  }
}

function onLockTargetChange() {
  state.lockTarget = !!document.getElementById('lockTarget')?.checked;
  applyUserTargets(state);
  state.activeTenorTab = 'ALL';
  state.lastUpdate = new Date();
  renderAll(state);
  renderTenorTabs(state, setTenorTab);
}

function handleTargetsChange() {
  applyUserTargets(state);
  state.activeTenorTab = 'ALL';
  state.lastUpdate = new Date();
  renderAll(state);
  renderTenorTabs(state, setTenorTab);
  renderRecommendations(state);
  updateVolatilityInsights();
}

function recalc() {
  state.notional = parseFloat(document.getElementById('notionalInput').value) || 1000;
  renderAll(state);
  renderRecommendations(state);
  updateVolatilityInsights();
}

function reportTenorDistribution() {
  const map = new Map();
  for (const p of state.products) {
    const k = p.expiry || `${p.expiryDays}D`;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${v}`).join(', ');
}

function setTenorTab(tab) {
  state.activeTenorTab = tab;
  renderAll(state);
  renderTenorTabs(state, setTenorTab);
}

function toggleMode() {
  state.mode = state.mode === 'online' ? 'local' : 'online';
  const btn = document.getElementById('modeToggle');
  const hint = document.getElementById('modeHint');
  if (btn) {
    btn.dataset.mode = state.mode;
    btn.textContent = state.mode === 'online' ? '在线模式' : '本地模式';
  }
  if (hint) {
    hint.textContent = state.mode === 'online' ? '实时接口优先' : '离线生成数据';
  }
  fetchAllData();
}

function exportToCSV() {
  if (!state.products || !state.products.length) return;
  const headers = ['Exchange', 'Type', 'Strike', 'Distance', 'Dual Expiry', 'Option Expiry', 'Dual APY', 'Option APY', 'Spread', 'Liquidity'];
  const rows = state.products.map(p => [
    p.exchange, p.optionType, p.strikePrice, p.distance,
    `${p.expiry} (${p.expiryDays}d)`, `${p.optionExpiry || p.expiry} (${p.optionExpiryDays || p.expiryDays}d)`,
    `${p.dualApr.toFixed(2)}%`, `${p.optionApr.toFixed(2)}%`, `${(p.optionApr - p.dualApr).toFixed(2)}%`,
    p.liquidity || 0
  ]);
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `2b_options_${state.type}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderKnowledgePanels() {
  const greeksGrid = document.getElementById('greeksGrid');
  if (greeksGrid) {
    greeksGrid.innerHTML = GREEKS_DATA.map(g => `
      <div class="panel" style="padding:12px;">
        <div class="kb-title">${g.symbol} · ${g.name}</div>
        <p class="muted" style="margin:0;">${g.desc}</p>
      </div>
    `).join('');
  }

  const formulaGrid = document.getElementById('formulaGrid');
  if (formulaGrid) {
    formulaGrid.innerHTML = FORMULAS.map(f => `
      <div class="panel" style="padding:12px;">
        <div class="kb-title">${f.title}</div>
        <code>${f.expr}</code>
      </div>
    `).join('');
  }

  const faqList = document.getElementById('faqList');
  if (faqList) {
    faqList.innerHTML = FAQ_DATA.map(item => `
      <div class="panel" style="padding:12px; margin-bottom:10px;">
        <div class="kb-title">Q: ${item.q}</div>
        <p class="muted" style="margin:6px 0 0;">A: ${item.a}</p>
      </div>
    `).join('');
  }
}

function updateVolatilityInsights() {
  const current = state.price || 0;
  const sample = state.options[0];
  const strike = sample?.strikePrice || current || 100000;
  const days = sample?.expiryDays || state.targetDays || 7;
  const optionApr = sample?.apr || 25;

  const iv = Math.min(220, Math.max(15, optionApr * 1.8));
  const moneyness = current > 0 ? Math.abs(strike - current) / current : 0.03;
  const t = days / 365;
  const prob = Math.max(5, Math.min(95, 50 - (moneyness * 120) + (Math.sqrt(t) * 18)));
  const breakEvenPx = state.type === 'CALL'
    ? strike * (1 + optionApr / 100 * (days / 365))
    : strike * (1 - optionApr / 100 * (days / 365));

  const ivEl = document.getElementById('ivValue');
  const probEl = document.getElementById('exerciseProb');
  const beEl = document.getElementById('breakEven');
  const insightEl = document.getElementById('marketInsightText');

  if (ivEl) ivEl.textContent = `${iv.toFixed(1)}%`;
  if (probEl) probEl.textContent = `${prob.toFixed(1)}%`;
  if (beEl) beEl.textContent = `$${breakEvenPx.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (insightEl) {
    insightEl.innerHTML = `
      当前模式：<strong>${state.mode === 'online' ? '在线实时' : '本地模拟'}</strong><br/>
      估算解释：IV 高代表权利金更贵；行权概率越高，策略被动成交的可能性越大。<br/>
      当前 ${state.type} 方向下，建议优先关注 ${days} 天附近合约与执行价 ${strike.toLocaleString()}。`;
  }
}

function drawPayoffCurve() {
  const canvas = document.getElementById('payoffCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const p0 = state.price || 98000;
  const strike = parseFloat(document.getElementById('calcStrike')?.value || String(p0));
  const premiumPct = parseFloat(document.getElementById('calcPremium')?.value || '3.5') / 100;
  const n = state.notional || 100000;
  const qty = n / Math.max(strike, 1);

  const minP = p0 * 0.75;
  const maxP = p0 * 1.25;
  const steps = 220;
  const values = [];

  for (let i = 0; i <= steps; i++) {
    const s = minP + (maxP - minP) * (i / steps);
    const premium = n * premiumPct;
    const payoff = state.type === 'CALL'
      ? (s <= strike ? qty * s + premium - n : qty * strike + premium - n)
      : (s >= strike ? premium : premium - (n - (n / strike) * s));
    values.push({ s, payoff });
  }

  const minY = Math.min(...values.map(v => v.payoff));
  const maxY = Math.max(...values.map(v => v.payoff));
  const pad = 20;
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const y0 = h - pad - ((0 - minY) / Math.max(maxY - minY, 1)) * (h - pad * 2);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y0);
  ctx.lineTo(w - pad, y0);
  ctx.stroke();

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + (i / steps) * (w - pad * 2);
    const y = h - pad - ((v.payoff - minY) / Math.max(maxY - minY, 1)) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  
  // Create gradient fill under curve
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(14, 165, 166, 0.4)');
  grad.addColorStop(1, 'rgba(14, 165, 166, 0.0)');
  
  ctx.lineTo(w - pad, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + (i / steps) * (w - pad * 2);
    const y = h - pad - ((v.payoff - minY) / Math.max(maxY - minY, 1)) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0ea5a6';
  ctx.stroke();
}

function renderScenarioMatrix() {
  const head = document.getElementById('scenarioHead');
  const body = document.getElementById('scenarioBody');
  if (!head || !body) return;

  const p0 = state.price || 98000;
  const strike = parseFloat(document.getElementById('simStrike')?.value || String(p0));
  const n = parseFloat(document.getElementById('simNotional')?.value || String(state.notional || 100000));
  const optionApr = parseFloat(document.getElementById('simOptionApr')?.value || '28');
  const daysBase = parseFloat(document.getElementById('simDays')?.value || '7');

  const priceMoves = [-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2];
  const dayScenarios = [Math.max(1, Math.round(daysBase * 0.3)), Math.max(1, Math.round(daysBase * 0.6)), Math.max(1, Math.round(daysBase))];

  head.innerHTML = `<tr><th>到期天数</th>${priceMoves.map(m => `<th>${m >= 0 ? '+' : ''}${(m * 100).toFixed(0)}%</th>`).join('')}</tr>`;

  body.innerHTML = dayScenarios.map(d => {
    const tds = priceMoves.map(m => {
      const s = p0 * (1 + m);
      const premium = n * (optionApr / 100) * (d / 365);
      const pnl = state.type === 'CALL'
        ? (s <= strike ? premium : premium - (s - strike) * (n / strike))
        : (s >= strike ? premium : premium - (strike - s) * (n / strike));
      const cls = pnl >= 0 ? 'positive' : 'negative';
      return `<td class="${cls}">$${pnl.toFixed(0)}</td>`;
    }).join('');
    return `<tr><td>${d}d</td>${tds}</tr>`;
  }).join('');
}

function runStrategyComparison() {
  const notional = parseFloat(document.getElementById('simNotional')?.value || '1000');
  const current = parseFloat(document.getElementById('simCurrent')?.value || String(state.price || 98000));
  const strike = parseFloat(document.getElementById('simStrike')?.value || '100000');
  const days = parseFloat(document.getElementById('simDays')?.value || '7');
  const dualApr = parseFloat(document.getElementById('simDualApr')?.value || '18');
  const optionApr = parseFloat(document.getElementById('simOptionApr')?.value || '28');

  const dualProfit = notional * (dualApr / 100) * (days / 365);
  const optionProfit = notional * (optionApr / 100) * (days / 365);
  const gap = optionProfit - dualProfit;
  const direction = gap >= 0 ? '期权多赚' : '双币多赚';

  const coinQty = notional / current;
  const theoreticalContracts = coinQty;
  const roundedContracts = Math.max(1, Math.round(theoreticalContracts));

  const resultEl = document.getElementById('simResult');
  if (resultEl) {
    resultEl.innerHTML = `
      方案A [双币理财]：预估收益 <strong>$${dualProfit.toFixed(2)}</strong><br/>
      方案B [卖出期权]：预估收益 <strong>$${optionProfit.toFixed(2)}</strong><br/>
      执行价：$${strike.toLocaleString()} · 到期：${days}天 · 理论合约数：${theoreticalContracts.toFixed(4)}（约 ${roundedContracts} 张）<br/>
      结果：<strong>${direction} $${Math.abs(gap).toFixed(2)}</strong>`;
  }

  renderScenarioMatrix();
  drawPayoffCurve();
}

function setupUxMotion() {
  const revealNodes = document.querySelectorAll('.panel, .summary-card, .control-bar');
  revealNodes.forEach(el => {
    el.classList.add('ux-reveal');
  });

  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  revealNodes.forEach(el => {
    io.observe(el);
  });

  const cards = document.querySelectorAll('.summary-card');
  cards.forEach(card => {
    card.classList.add('tilt-card');
    card.addEventListener('mousemove', e => {
      if (window.matchMedia('(max-width: 980px)').matches) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const rx = (0.5 - y) * 3.2;
      const ry = (x - 0.5) * 4.2;
      card.style.transform = `translateY(-1px) perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

function syncMarketInputs() {
  const p = Math.round(state.price || 0);
  if (!p) return;

  const calcPrice = document.getElementById('calcPrice');
  const calcStrike = document.getElementById('calcStrike');
  const simCurrent = document.getElementById('simCurrent');
  const simStrike = document.getElementById('simStrike');

  if (calcPrice && (!calcPrice.value || Number(calcPrice.value) <= 0)) calcPrice.value = String(p);
  if (calcStrike && (!calcStrike.value || Number(calcStrike.value) <= 0)) calcStrike.value = String(Math.round(p * (state.type === 'CALL' ? 1.03 : 0.97)));
  if (simCurrent && (!simCurrent.value || Number(simCurrent.value) <= 0)) simCurrent.value = String(p);
  if (simStrike && (!simStrike.value || Number(simStrike.value) <= 0)) simStrike.value = String(Math.round(p * (state.type === 'CALL' ? 1.03 : 0.97)));
}

document.addEventListener('DOMContentLoaded', () => {
  playEntrySplash();
  init();
  setupUxMotion();

  // Buttons
  document.getElementById('refreshBtn')?.addEventListener('click', fetchAllData);
  document.getElementById('exportBtn')?.addEventListener('click', exportToCSV);
  document.getElementById('modeToggle')?.addEventListener('click', toggleMode);
  document.getElementById('btnCall')?.addEventListener('click', () => switchType('CALL'));
  document.getElementById('btnPut')?.addEventListener('click', () => switchType('PUT'));
  document.getElementById('calcBtn')?.addEventListener('click', () => calculateProfit(state));
  document.getElementById('simCalcBtn')?.addEventListener('click', runStrategyComparison);
  document.getElementById('sortBySelect')?.addEventListener('change', e => {
    state.sortBy = e.target.value;
    renderAll(state);
  });
  document.getElementById('moneynessSelect')?.addEventListener('change', e => {
    state.moneynessFilter = e.target.value;
    renderAll(state);
  });
  document.getElementById('calcPremium')?.addEventListener('change', drawPayoffCurve);
  document.getElementById('calcStrike')?.addEventListener('change', drawPayoffCurve);
  document.getElementById('simDays')?.addEventListener('change', renderScenarioMatrix);
  document.getElementById('simOptionApr')?.addEventListener('change', renderScenarioMatrix);
  document.getElementById('oracleBtn')?.addEventListener('click', toggleOracle);
  document.getElementById('oracleClose')?.addEventListener('click', toggleOracle);
  document.getElementById('oracleSend')?.addEventListener('click', sendOracleMsg);

  const tDays = document.getElementById('targetDays');
  if (tDays) tDays.value = String(state.targetDays);
  const tPrice = document.getElementById('targetPrice');
  if (tPrice) tPrice.value = '';
  const lockEl = document.getElementById('lockTarget');
  if (lockEl) lockEl.checked = state.lockTarget;
  const modeBtn = document.getElementById('modeToggle');
  if (modeBtn) {
    modeBtn.dataset.mode = state.mode;
    modeBtn.textContent = state.mode === 'online' ? '在线模式' : '本地模式';
  }
  const modeHint = document.getElementById('modeHint');
  if (modeHint) modeHint.textContent = state.mode === 'online' ? '实时接口优先' : '离线生成数据';
  renderTenorTabs(state, setTenorTab);

  // default principal: 100000
  const n1 = document.getElementById('notionalInput');
  if (n1 && (!n1.value || Number(n1.value) < 100000)) n1.value = '100000';
  const n2 = document.getElementById('simNotional');
  if (n2 && (!n2.value || Number(n2.value) < 100000)) n2.value = '100000';
  state.notional = 100000;

  tDays?.addEventListener('change', handleTargetsChange);
  tPrice?.addEventListener('change', handleTargetsChange);
  document.getElementById('notionalInput')?.addEventListener('change', recalc);
  document.getElementById('lockTarget')?.addEventListener('change', onLockTargetChange);

  document.getElementById('oracleInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendOracleMsg();
    }
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'r') { e.preventDefault(); fetchAllData(); }
    if (k === 'e') { e.preventDefault(); exportToCSV(); }
    if (k === 'c') { e.preventDefault(); switchType('CALL'); }
    if (k === 'p') { e.preventDefault(); switchType('PUT'); }
  });

  setInterval(async () => {
    try {
      const { price, change24h } = await api.btcPrice();
      state.price = price;
      state.change24h = change24h;
      updatePriceDisplay(state);
      updateVolatilityInsights();
    } catch {
      // noop
    }
  }, 60000);

  // manual QA visibility in console
  setTimeout(() => {
    console.log('[QA] tenor distribution =>', reportTenorDistribution());
    renderScenarioMatrix();
    drawPayoffCurve();
  }, 1200);
});

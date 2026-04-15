import { state } from './src/state.js';
import { api } from './src/api.js';
import { generateData, buildFromDeribit } from './src/data.js';
import { applyUserTargets } from './src/filters.js';
import { renderAll, showLoading, updatePriceDisplay } from './src/render.js';
import { calculateProfit } from './src/features/calculator.js';
import { toggleOracle, sendOracleMsg } from './src/features/oracle.js';

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
    animateMetric(metricEl, -32.7, 1050);
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

    state.rawProducts = [...state.products];
    state.rawOptions = [...state.options];
    applyUserTargets(state);

    state.lastUpdate = new Date();
    renderAll(state);
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
    renderAll(state);
  }
}

async function fetchAllData() {
  if (state.loading) return;
  state.loading = true;
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = '⏳...';

  await init();

  btn.disabled = false;
  btn.textContent = '🔄 刷新数据';
  state.loading = false;
}

function switchType(type) {
  state.type = type;
  document.getElementById('btnCall').classList.toggle('active', type === 'CALL');
  document.getElementById('btnCall').classList.toggle('put', false);
  document.getElementById('btnPut').classList.toggle('active', type === 'PUT');
  document.getElementById('btnPut').classList.toggle('put', true);

  if (state.price) {
    if (state.deribitRaw?.length) {
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
  }
}

function onLockTargetChange() {
  state.lockTarget = !!document.getElementById('lockTarget')?.checked;
  applyUserTargets(state);
  state.lastUpdate = new Date();
  renderAll(state);
}

function handleTargetsChange() {
  applyUserTargets(state);
  state.lastUpdate = new Date();
  renderAll(state);
}

function recalc() {
  state.notional = parseFloat(document.getElementById('notionalInput').value) || 1000;
  renderAll(state);
}

document.addEventListener('DOMContentLoaded', () => {
  playEntrySplash();
  init();

  // Buttons
  document.getElementById('refreshBtn')?.addEventListener('click', fetchAllData);
  document.getElementById('btnCall')?.addEventListener('click', () => switchType('CALL'));
  document.getElementById('btnPut')?.addEventListener('click', () => switchType('PUT'));
  document.getElementById('calcBtn')?.addEventListener('click', () => calculateProfit(state));
  document.getElementById('oracleBtn')?.addEventListener('click', toggleOracle);
  document.getElementById('oracleClose')?.addEventListener('click', toggleOracle);
  document.getElementById('oracleSend')?.addEventListener('click', sendOracleMsg);

  const tDays = document.getElementById('targetDays');
  if (tDays) tDays.value = String(state.targetDays);
  const tPrice = document.getElementById('targetPrice');
  if (tPrice) tPrice.value = '';
  const lockEl = document.getElementById('lockTarget');
  if (lockEl) lockEl.checked = state.lockTarget;

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

  setInterval(async () => {
    try {
      const { price, change24h } = await api.btcPrice();
      state.price = price;
      state.change24h = change24h;
      updatePriceDisplay(state);
    } catch {
      // noop
    }
  }, 60000);
});

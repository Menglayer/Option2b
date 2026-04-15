import { state } from './src/state.js';
import { api } from './src/api.js';
import { generateData, buildFromDeribit } from './src/data.js';
import { applyUserTargets } from './src/filters.js';
import { renderAll, showLoading, updatePriceDisplay } from './src/render.js';
import { setHtml } from './src/utils.js';

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

function calculateProfit() {
  const expiryPrice = parseFloat(document.getElementById('calcPrice').value);
  const strike = parseFloat(document.getElementById('calcStrike').value);
  const premPct = parseFloat(document.getElementById('calcPremium').value) / 100;
  const N = state.notional;

  if (!expiryPrice || !strike || !premPct) {
    setHtml('calcResult', '<span class="negative">请填写完整参数</span>');
    return;
  }

  const premium = N * premPct;
  const coins = N / strike;

  let callProfit, callDesc;
  if (expiryPrice <= strike) {
    callProfit = coins * expiryPrice + premium - N;
    callDesc = '未行权 · 保留币 + premium';
  } else {
    const proceeds = coins * strike + premium;
    const missed = coins * (expiryPrice - strike);
    callProfit = proceeds - N;
    callDesc = `已行权 · $${strike.toLocaleString()} 卖出 · 错失 $${missed.toFixed(0)}`;
  }

  let putProfit, putDesc;
  if (expiryPrice >= strike) {
    putProfit = premium;
    putDesc = '未行权 · 保留 USDT + premium';
  } else {
    const coinsGot = N / strike;
    const val = coinsGot * expiryPrice;
    putProfit = premium - (N - val);
    putDesc = `已行权 · $${strike.toLocaleString()} 接入 · 币值 $${val.toFixed(0)}`;
  }

  setHtml('calcResult', `
    <div style="margin-bottom:8px;color:var(--text)"><strong>参数:</strong> 到期 $${expiryPrice.toLocaleString()} · 执行 $${strike.toLocaleString()} · Prem ${(premPct*100).toFixed(1)}% · 本金 $${N}</div>
    <div style="margin-bottom:6px"><span style="color:var(--blue)">▶ CALL:</span> <span class="${callProfit >= 0 ? 'positive' : 'negative'}">$${callProfit.toFixed(2)}</span> (${callProfit >= 0 ? '+' : ''}${(callProfit/N*100).toFixed(2)}%)<br/><span class="muted" style="font-size:7px">${callDesc}</span></div>
    <div><span style="color:var(--green)">▶ PUT:</span> <span class="${putProfit >= 0 ? 'positive' : 'negative'}">$${putProfit.toFixed(2)}</span> (${putProfit >= 0 ? '+' : ''}${(putProfit/N*100).toFixed(2)}%)<br/><span class="muted" style="font-size:7px">${putDesc}</span></div>
  `);
}

const KB = [
  { k: ['双币理财','dual','是什么','原理','包装'], a: '**双币理财 = 卖出期权的包装品。交易所通常扣留 15-40% premium 作为隐藏费用。' },
  { k: ['隐藏成本','hidden','spread','价差'], a: '**隐藏价差 = 期权APY - 双币APY**。本页主表即用于量化该差距。' },
  { k: ['风险','risk'], a: '主要风险：转换风险、机会成本、交易对手风险。' },
  { k: ['call','put','看涨','看跌'], a: 'CALL 更偏震荡/温和上涨；PUT 更偏震荡/温和回调并希望低价接币。' },
  { k: ['hello','你好','help','帮助'], a: '你好，我可以解答双币理财、期权对比、APY差异和风险问题。' },
];

function md(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function findAnswer(q) {
  const ql = q.toLowerCase();
  for (const e of KB) if (e.k.some(k => ql.includes(k.toLowerCase()))) return e.a;
  return '可以试试问：双币理财是什么？隐藏成本怎么算？CALL 和 PUT 怎么选？';
}

function addMsg(role, text) {
  const c = document.getElementById('oracleMessages');
  const div = document.createElement('div');
  div.className = `oracle-msg ${role}`;
  const tag = document.createElement('div');
  tag.className = 'oracle-tag';
  tag.textContent = role === 'user' ? 'YOU' : 'ORACLE';
  const bubble = document.createElement('div');
  bubble.className = 'oracle-bubble';
  bubble.innerHTML = md(text);
  div.append(tag, bubble);
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

function toggleOracle() {
  const drawer = document.getElementById('oracleDrawer');
  drawer.classList.toggle('open');
  if (drawer.classList.contains('open') && !document.querySelector('.oracle-msg.ai')) {
    addMsg('ai', '你好！我是 Oracle 助手。可以问我双币理财和期权对比问题。');
  }
}

function sendOracleMsg() {
  const input = document.getElementById('oracleInput');
  const text = input.value.trim();
  if (!text) return;
  addMsg('user', text);
  input.value = '';
  setTimeout(() => addMsg('ai', findAnswer(text)), 280);
}

// expose to inline handlers in HTML
window.fetchAllData = fetchAllData;
window.switchType = switchType;
window.onLockTargetChange = onLockTargetChange;
window.applyUserTargets = handleTargetsChange;
window.recalc = recalc;
window.calculateProfit = calculateProfit;
window.toggleOracle = toggleOracle;
window.sendOracleMsg = sendOracleMsg;

document.addEventListener('DOMContentLoaded', () => {
  init();

  const tDays = document.getElementById('targetDays');
  if (tDays) tDays.value = String(state.targetDays);
  const tPrice = document.getElementById('targetPrice');
  if (tPrice) tPrice.value = '';
  const lockEl = document.getElementById('lockTarget');
  if (lockEl) lockEl.checked = state.lockTarget;

  tDays?.addEventListener('change', handleTargetsChange);
  tPrice?.addEventListener('change', handleTargetsChange);

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

const KEY = 'opt2b_portfolio_v1';

export function loadPortfolio(state) {
  try {
    const raw = localStorage.getItem(KEY);
    state.portfolio = raw ? JSON.parse(raw) : [];
  } catch {
    state.portfolio = [];
  }
}

function savePortfolio(state) {
  localStorage.setItem(KEY, JSON.stringify(state.portfolio));
}

export function addPosition(state) {
  const side = document.getElementById('pfSide')?.value || 'SELL';
  const type = document.getElementById('pfType')?.value || 'CALL';
  const strike = parseFloat(document.getElementById('pfStrike')?.value || '0');
  const qty = parseFloat(document.getElementById('pfQty')?.value || '0');
  const premium = parseFloat(document.getElementById('pfPremium')?.value || '0');
  if (!(strike > 0 && qty > 0 && premium >= 0)) return false;
  state.portfolio.push({ id: Date.now(), side, type, strike, qty, premium, coin: state.coin });
  savePortfolio(state);
  return true;
}

export function removePosition(state, id) {
  state.portfolio = state.portfolio.filter(p => p.id !== id);
  savePortfolio(state);
}

export function renderPortfolio(state) {
  const tbody = document.getElementById('portfolioBody');
  const sum = document.getElementById('portfolioSummary');
  if (!tbody || !sum) return;
  if (!state.portfolio.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted center">暂无持仓</td></tr>';
    sum.textContent = '持仓 0 条';
    return;
  }

  const spot = state.price || 0;
  let pnl = 0;
  tbody.innerHTML = state.portfolio.map(p => {
    const intrinsic = p.type === 'CALL' ? Math.max(0, spot - p.strike) : Math.max(0, p.strike - spot);
    const one = p.side === 'SELL' ? (p.premium - intrinsic) : (intrinsic - p.premium);
    const rowPnl = one * p.qty;
    pnl += rowPnl;
    return `<tr>
      <td>${p.coin}</td><td>${p.side}</td><td>${p.type}</td>
      <td>$${p.strike.toLocaleString()}</td><td>${p.qty}</td><td>$${p.premium.toFixed(2)}</td>
      <td class="${rowPnl >= 0 ? 'positive' : 'negative'}">$${rowPnl.toFixed(2)} <button data-del="${p.id}" class="mini-btn" type="button">删</button></td>
    </tr>`;
  }).join('');

  sum.textContent = `持仓 ${state.portfolio.length} 条 · 以当前价估算 PnL ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
  tbody.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      removePosition(state, Number(btn.getAttribute('data-del')));
      renderPortfolio(state);
    });
  });
}

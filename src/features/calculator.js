import { setHtml } from '../utils.js';

export function calculateProfit(state) {
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
    <div style="margin-bottom:6px"><span style="color:var(--brand)">▶ CALL:</span> <span class="${callProfit >= 0 ? 'positive' : 'negative'}">$${callProfit.toFixed(2)}</span> (${callProfit >= 0 ? '+' : ''}${(callProfit/N*100).toFixed(2)}%)<br/><span class="muted" style="font-size:7px">${callDesc}</span></div>
    <div><span style="color:var(--green)">▶ PUT:</span> <span class="${putProfit >= 0 ? 'positive' : 'negative'}">$${putProfit.toFixed(2)}</span> (${putProfit >= 0 ? '+' : ''}${(putProfit/N*100).toFixed(2)}%)<br/><span class="muted" style="font-size:7px">${putDesc}</span></div>
  `);
}

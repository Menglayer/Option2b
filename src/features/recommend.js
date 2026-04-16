import { setHtml } from '../utils.js';

export function renderRecommendations(state) {
  const container = document.getElementById('recommendGrid');
  if (!container) return;

  if (!state.products || state.products.length === 0) {
    container.innerHTML = '<div class="muted center" style="grid-column: 1 / -1; padding: 20px;">暂无满足条件的推荐</div>';
    return;
  }

  // Helper
  const distVal = p => Math.abs(parseFloat(String(p.distance).replace('%', '').replace('+', '')) || 0);

  // Strategy 1: Safe and Stable (稳健收租)
  // Target: Most conservative (largest distance from current price)
  const safeSorted = [...state.products].sort((a, b) => distVal(b) - distVal(a));
  const safePick = safeSorted[0];

  // Strategy 2: High Yield (高息摸奖)
  // Target: Highest APY, naturally these are closer to ATM
  const yieldSorted = [...state.products].sort((a, b) => b.optionApr - a.optionApr);
  // Pick one that is noticeably closer to the money compared to the safe pick
  const yieldPick = yieldSorted.find(p => distVal(p) < distVal(safePick) - 2.0) || yieldSorted.find(p => p.strikePrice !== safePick.strikePrice) || yieldSorted[0];

  // Strategy 3: Lowest Fee / Smart Option (良心真期权)
  // Target: Lowest CEX markup (gap), ideally finding a middle-ground distance
  const smartSorted = [...state.products].sort((a, b) => {
    const gapPctA = ((a.optionApr - a.dualApr) / Math.max(a.optionApr, 0.1)) * 100;
    const gapPctB = ((b.optionApr - b.dualApr) / Math.max(b.optionApr, 0.1)) * 100;
    return gapPctA - gapPctB;
  });
  // Prefer a product that falls somewhere between safe and yield distances, guaranteeing different strikes
  const smartPick = smartSorted.find(p => p.strikePrice !== safePick.strikePrice && p.strikePrice !== yieldPick.strikePrice) || smartSorted.find(p => p !== safePick && p !== yieldPick) || smartSorted[0];

  const cards = [
    { pick: safePick, type: 'safe', label: '🛡️ 深潜收租', desc: '距深水区最远，防守空间极大，极度保守稳健' },
    { pick: smartPick, type: 'smart', label: '💎 性价比之王', desc: '中等距离且隐藏抽水最低，收益风险最均衡' },
    { pick: yieldPick, type: 'yield', label: '🔥 激进博弈', desc: '距平值最近，被行权概率明显，追求极致收益' }
  ];

  container.innerHTML = cards.map(c => {
    const p = c.pick;
    if (!p) return '';
    const premiumPct = ((p.optionApr/100) * (p.expiryDays/365) * 100).toFixed(2);
    // Escape string values just in case
    const clickHandler = `
      document.getElementById('calcStrike').value='${p.strikePrice}';
      document.getElementById('calcPremium').value='${premiumPct}';
      document.getElementById('calcPrice').value='${p.strikePrice}';
      const calcBtn = document.getElementById('calcBtn');
      if(calcBtn) calcBtn.click();
      setTimeout(()=>{window.scrollTo({top: document.querySelector('.calc-panel').offsetTop - 20, behavior: 'smooth'});}, 100);
    `.replace(/\n\s+/g, '');

    return `
      <div class="recommend-card">
        <div class="rc-badge ${c.type}">${c.label}</div>
        <div class="rc-title">卖出 ${p.optionType} @ $${p.strikePrice.toLocaleString()}</div>
        <div class="rc-meta">${p.exchange} · 到期: ${p.expiryDays}天 · 价差 ${p.distance}</div>
        <div class="rc-apy">${p.optionApr.toFixed(1)}% APY</div>
        <p class="muted" style="margin-top:-10px;margin-bottom:14px;font-size:11px">${c.desc}</p>
        <button class="rc-btn" onclick="${clickHandler}">🎯 试算并应用</button>
      </div>
    `;
  }).join('');
}

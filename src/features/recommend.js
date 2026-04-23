export function renderRecommendations(state) {
  const container = document.getElementById('recommendGrid');
  if (!container) return;

  if (!state.products || state.products.length === 0) {
    container.innerHTML = '<div class="muted center" style="grid-column: 1 / -1; padding: 20px;">暂无满足条件的推荐</div>';
    return;
  }

  // Helper
  const getClosestByDelta = (targetDelta, exclude) => {
    const sorted = [...state.products]
      .filter(p => !exclude.includes(p.strikePrice))
      .sort((a, b) => Math.abs((a.delta || 0) - targetDelta) - Math.abs((b.delta || 0) - targetDelta));
    return sorted[0];
  };

  const safePick = getClosestByDelta(0.15, []);
  const smartPick = getClosestByDelta(0.25, safePick ? [safePick.strikePrice] : []);
  const yieldPick = getClosestByDelta(0.35, safePick && smartPick ? [safePick.strikePrice, smartPick.strikePrice] : []);

  const cards = [
    { pick: safePick, type: 'safe', label: '🛡️ 稳健收租', desc: '保守之选（胜率较高，防守空间充足）' },
    { pick: smartPick, type: 'smart', label: '💎 均衡之选', desc: '中等距离缓冲，收益与风险配置合理' },
    { pick: yieldPick, type: 'yield', label: '🔥 进阶博弈', desc: '距平值较近，被行权概率增加，追求更高回报' }
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

export function addAlert(state) {
  const type = document.getElementById('alertType')?.value || 'price_above';
  const value = parseFloat(document.getElementById('alertValue')?.value || '0');
  const aux = parseFloat(document.getElementById('alertAuxValue')?.value || '0');
  if (!(value > 0)) return false;
  state.alerts.push({ id: Date.now(), type, value, aux: Number.isFinite(aux) && aux > 0 ? aux : null, triggered: false });
  return true;
}

export function renderAlerts(state) {
  const box = document.getElementById('alertList');
  if (!box) return;
  if (!state.alerts.length) {
    box.innerHTML = '<div class="muted">暂无预警</div>';
    return;
  }
  const labels = {
    price_above: '价格高于',
    price_below: '价格低于',
    iv_above: 'IV高于',
    combo_iv_price: 'IV高且接近平值',
  };
  box.innerHTML = state.alerts.map(a => `<div class="alert-item ${a.triggered ? 'triggered' : ''}">${labels[a.type] || a.type} ${a.value}${a.aux ? ` / ${a.aux}` : ''} ${a.triggered ? '✅' : ''}</div>`).join('');
}

export function checkAlerts(state, notify) {
  const liveText = document.getElementById('livePrice')?.textContent || '';
  const liveParsed = Number(String(liveText).replace(/[^0-9.]/g, ''));
  const price = state.price || (Number.isFinite(liveParsed) ? liveParsed : 0);
  const iv = Number(document.getElementById('ivValue')?.textContent?.replace('%', '') || '0');
  const nearAtmDistance = state.products?.length
    ? Math.min(...state.products.map(p => Math.abs(parseFloat(String(p.distance).replace('%', '').replace('+', '')) || 0)))
    : 999;
  for (const a of state.alerts) {
    if (a.triggered) continue;
    if (a.type === 'price_above' && price >= a.value) {
      a.triggered = true;
      notify(`价格触发：已高于 ${a.value}`);
    }
    if (a.type === 'price_below' && price <= a.value) {
      a.triggered = true;
      notify(`价格触发：已低于 ${a.value}`);
    }
    if (a.type === 'iv_above' && iv >= a.value) {
      a.triggered = true;
      notify(`IV触发：已高于 ${a.value}%`);
    }
    if (a.type === 'combo_iv_price' && iv >= a.value && nearAtmDistance <= (a.aux ?? 3)) {
      a.triggered = true;
      notify(`组合触发：IV>${a.value}% 且距ATM<${a.aux ?? 3}%`);
    }
  }
}

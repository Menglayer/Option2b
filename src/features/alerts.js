export function addAlert(state) {
  const type = document.getElementById('alertType')?.value || 'price_above';
  const value = parseFloat(document.getElementById('alertValue')?.value || '0');
  if (!(value > 0)) return false;
  state.alerts.push({ id: Date.now(), type, value, triggered: false });
  return true;
}

export function renderAlerts(state) {
  const box = document.getElementById('alertList');
  if (!box) return;
  if (!state.alerts.length) {
    box.innerHTML = '<div class="muted">暂无预警</div>';
    return;
  }
  box.innerHTML = state.alerts.map(a => `<div class="alert-item ${a.triggered ? 'triggered' : ''}">${a.type} ${a.value} ${a.triggered ? '✅' : ''}</div>`).join('');
}

export function checkAlerts(state, notify) {
  const price = state.price || 0;
  const iv = Number(document.getElementById('ivValue')?.textContent?.replace('%', '') || '0');
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
  }
}

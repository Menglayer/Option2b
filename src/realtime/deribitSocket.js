export function connectDeribitWs({ coin = 'BTC', onTick, onStatus }) {
  const ccy = coin.toLowerCase();
  const ws = new WebSocket('wss://www.deribit.com/ws/api/v2');

  ws.addEventListener('open', () => {
    onStatus?.(true);
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'public/subscribe',
      params: { channels: [`ticker.${ccy}-perpetual.raw`] },
    }));
  });

  ws.addEventListener('message', (ev) => {
    try {
      const d = JSON.parse(ev.data);
      const p = d?.params?.data?.last_price;
      if (Number.isFinite(p)) onTick?.(p);
    } catch {
      // ignore malformed payload
    }
  });

  ws.addEventListener('close', () => onStatus?.(false));
  ws.addEventListener('error', () => onStatus?.(false));
  return ws;
}

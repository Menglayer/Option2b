export const api = {
  async btcPrice() {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    const d = await res.json();
    return {
      price: parseFloat(d.lastPrice),
      change24h: parseFloat(d.priceChangePercent),
    };
  },

  async coingeckoPrice() {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const d = await res.json();
    const p = d?.bitcoin?.usd;
    const c = d?.bitcoin?.usd_24h_change;
    if (typeof p !== 'number') throw new Error('CoinGecko invalid payload');
    return { price: p, change24h: typeof c === 'number' ? c : 0 };
  },

  async deribitOptions() {
    const res = await fetch('https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option');
    if (!res.ok) throw new Error(`Deribit ${res.status}`);
    const d = await res.json();
    if (d.result) return d.result;
    throw new Error('No result');
  },
};

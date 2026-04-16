export const api = {
  async cryptoPrice(coin = 'BTC') {
    const symbol = `${coin}USDT`;
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    const d = await res.json();
    return {
      price: parseFloat(d.lastPrice),
      change24h: parseFloat(d.priceChangePercent),
    };
  },

  async coingeckoPrice(coin = 'BTC') {
    const id = coin === 'ETH' ? 'ethereum' : 'bitcoin';
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const d = await res.json();
    const p = d[id]?.usd;
    const c = d[id]?.usd_24h_change;
    if (typeof p !== 'number') throw new Error('CoinGecko invalid payload');
    return { price: p, change24h: typeof c === 'number' ? c : 0 };
  },

  async deribitOptions(coin = 'BTC') {
    const res = await fetch(`https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${coin}&kind=option`);
    if (!res.ok) throw new Error(`Deribit ${res.status}`);
    const d = await res.json();
    if (d.result) return d.result;
    throw new Error('No result');
  },
};

export const state = {
  coin: 'BTC',
  type: 'CALL',
  notional: 100000,
  targetDays: 1,
  targetPrice: null,
  lockTarget: false,
  price: null,
  change24h: 0,
  products: [],
  options: [],
  deribitRaw: null,
  rawProducts: [],
  rawOptions: [],
  activeTenorTab: 'ALL',
  sortBy: 'spread',
  moneynessFilter: 'ALL',
  lastUpdate: null,
  loading: false,
  mode: 'online', // online | local
  theme: 'light', // light | dark
  notifications: [],
  realtimeConnected: false,
  portfolio: [],
  alerts: [],
  oracleMode: 'kb', // kb | ai
  riskFreeRate: 0.03,
};

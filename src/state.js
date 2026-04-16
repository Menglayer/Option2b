export const state = {
  type: 'CALL',
  notional: 1000,
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
  lastUpdate: null,
  loading: false,
  mode: 'online', // online | local
};

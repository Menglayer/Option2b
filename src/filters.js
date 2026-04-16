export function applyUserTargets(state) {
  const td = parseInt(document.getElementById('targetDays')?.value || '7', 10);
  const tp = parseFloat(document.getElementById('targetPrice')?.value || '');
  state.targetDays = Number.isFinite(td) ? Math.min(90, Math.max(1, td)) : 1;
  state.targetPrice = Number.isFinite(tp) && tp > 0 ? tp : null;

  const baseProducts = state.rawProducts?.length ? [...state.rawProducts] : [...state.products];
  const baseOptions = state.rawOptions?.length ? [...state.rawOptions] : [...state.options];
  if (!baseProducts.length) return;

  const targetP = state.targetPrice ?? state.price ?? 0;

  const diversifyByTenor = (arr, maxTotal, perTenor = 10) => {
    const buckets = new Map();
    for (const item of arr) {
      const key = item.expiry || `${item.expiryDays || 0}D`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    }
    const out = [];
    for (const [, items] of buckets) {
      out.push(...items.slice(0, perTenor));
    }
    return out.slice(0, maxTotal);
  };

  if (state.lockTarget) {
    const strictProductPool = baseProducts.filter(p => {
      const dayOk = state.targetDays <= 3
        ? Math.abs((p.expiryDays || 7) - state.targetDays) <= 1
        : Math.abs((p.expiryDays || 7) - state.targetDays) <= 2;
      const priceOk = state.targetPrice
        ? Math.abs((p.strikePrice || 0) - targetP) <= Math.max(1000, targetP * 0.02)
        : true;
      return dayOk && priceOk;
    });

    const strictOptionPool = baseOptions.filter(o => {
      const dayOk = state.targetDays <= 3
        ? Math.abs((o.expiryDays || 7) - state.targetDays) <= 1
        : Math.abs((o.expiryDays || 7) - state.targetDays) <= 2;
      const priceOk = state.targetPrice
        ? Math.abs((o.strikePrice || 0) - targetP) <= Math.max(1000, targetP * 0.02)
        : true;
      return dayOk && priceOk;
    });

    const useProducts = strictProductPool.length ? strictProductPool : baseProducts;
    const useOptions = strictOptionPool.length ? strictOptionPool : baseOptions;

    const rankedProducts = [...useProducts].sort((a, b) => {
      const da = Math.abs((a.expiryDays || 7) - state.targetDays);
      const db = Math.abs((b.expiryDays || 7) - state.targetDays);
      if (da !== db) return da - db;
      const pa = Math.abs((a.strikePrice || 0) - targetP);
      const pb = Math.abs((b.strikePrice || 0) - targetP);
      if (pa !== pb) return pa - pb;
      return (a.hiddenSpread || 0) - (b.hiddenSpread || 0);
    });

    const rankedOptions = [...useOptions].sort((a, b) => {
      const da = Math.abs((a.expiryDays || 7) - state.targetDays);
      const db = Math.abs((b.expiryDays || 7) - state.targetDays);
      if (da !== db) return da - db;
      const pa = Math.abs((a.strikePrice || 0) - targetP);
      const pb = Math.abs((b.strikePrice || 0) - targetP);
      return pa - pb;
    });

    state.products = diversifyByTenor(rankedProducts, 60, 10);
    state.options = diversifyByTenor(rankedOptions, 36, 8);
    return;
  }

  const sortedProducts = baseProducts.sort((a, b) => {
    const da = Math.abs((a.expiryDays || 7) - state.targetDays);
    const db = Math.abs((b.expiryDays || 7) - state.targetDays);
    if (da !== db) return da - db;
    const pa = Math.abs((a.strikePrice || 0) - targetP);
    const pb = Math.abs((b.strikePrice || 0) - targetP);
    return pa - pb;
  });
  state.products = diversifyByTenor(sortedProducts, 60, 10);

  const sortedOptions = baseOptions.sort((a, b) => {
    const da = Math.abs((a.expiryDays || 7) - state.targetDays);
    const db = Math.abs((b.expiryDays || 7) - state.targetDays);
    if (da !== db) return da - db;
    const pa = Math.abs((a.strikePrice || 0) - targetP);
    const pb = Math.abs((b.strikePrice || 0) - targetP);
    return pa - pb;
  });
  state.options = diversifyByTenor(sortedOptions, 36, 8);
}

export function applyUserTargets(state) {
  const td = parseInt(document.getElementById('targetDays')?.value || '7', 10);
  const tp = parseFloat(document.getElementById('targetPrice')?.value || '');
  state.targetDays = Number.isFinite(td) ? Math.min(90, Math.max(1, td)) : 1;
  state.targetPrice = Number.isFinite(tp) && tp > 0 ? tp : null;

  const baseProducts = state.rawProducts?.length ? [...state.rawProducts] : [...state.products];
  const baseOptions = state.rawOptions?.length ? [...state.rawOptions] : [...state.options];
  if (!baseProducts.length) return;

  const targetP = state.targetPrice ?? state.price ?? 0;

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

    state.products = rankedProducts.slice(0, 60);
    state.options = rankedOptions.slice(0, 36);
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
  state.products = sortedProducts.slice(0, 60);

  const sortedOptions = baseOptions.sort((a, b) => {
    const da = Math.abs((a.expiryDays || 7) - state.targetDays);
    const db = Math.abs((b.expiryDays || 7) - state.targetDays);
    if (da !== db) return da - db;
    const pa = Math.abs((a.strikePrice || 0) - targetP);
    const pb = Math.abs((b.strikePrice || 0) - targetP);
    return pa - pb;
  });
  state.options = sortedOptions.slice(0, 36);
}

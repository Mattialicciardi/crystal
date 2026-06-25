// Sfera — motore di calcolo del mercato (puro, testabile). Nessun import UI.
// I range sono oggetti { low, base, high }; le quote sono frazioni (0.05 = 5%).

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x))
}

export function tamFromSectors(sumFatt, mode, spendRatio) {
  if (mode === 'sellinto' && spendRatio) {
    return { low: sumFatt * spendRatio.low, base: sumFatt * spendRatio.base, high: sumFatt * spendRatio.high }
  }
  return { low: sumFatt, base: sumFatt, high: sumFatt }
}

export function applyFraction(range, frac) {
  return { low: range.low * frac.low, base: range.base * frac.base, high: range.high * frac.high }
}

// quota catturabile suggerita: mercato concentrato (quota_grandi alta) -> bassa; frammentato -> alta.
export function somSuggestion(quotaGrandi) {
  const base = clamp(0.15 * (1 - (quotaGrandi ?? 0)), 0.01, 0.20)
  return { low: base * 0.5, base, high: base * 1.5 }
}

export function weighted(items, valueOf, weightOf) {
  let num = 0, den = 0
  for (const it of items) {
    const w = weightOf(it), v = valueOf(it)
    if (w != null && v != null) { num += v * w; den += w }
  }
  return den ? num / den : null
}

export function computeMarket({ sumFatt, mode, spendRatio, addressable, capturable }) {
  const tam = tamFromSectors(sumFatt, mode, spendRatio)
  const sam = applyFraction(tam, addressable)
  const som = applyFraction(sam, capturable)
  return { tam, sam, som }
}

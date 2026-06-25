import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clamp, tamFromSectors, applyFraction, somSuggestion, weighted, computeMarket } from '../src/market.js'

test('clamp', () => {
  assert.equal(clamp(5, 0, 10), 5)
  assert.equal(clamp(-1, 0, 10), 0)
  assert.equal(clamp(99, 0, 10), 10)
})

test('tamFromSectors compete = numero unico', () => {
  assert.deepEqual(tamFromSectors(100, 'compete', null), { low: 100, base: 100, high: 100 })
})

test('tamFromSectors sellinto scala per spend ratio', () => {
  assert.deepEqual(
    tamFromSectors(100, 'sellinto', { low: 0.01, base: 0.02, high: 0.05 }),
    { low: 1, base: 2, high: 5 },
  )
})

test('applyFraction moltiplica scenari allineati', () => {
  assert.deepEqual(
    applyFraction({ low: 100, base: 100, high: 100 }, { low: 0.2, base: 0.3, high: 0.4 }),
    { low: 20, base: 30, high: 40 },
  )
})

test('somSuggestion: concentrato -> bassa, frammentato -> alta, con clamp', () => {
  assert.ok(Math.abs(somSuggestion(0).base - 0.15) < 1e-9)
  assert.equal(somSuggestion(1).base, 0.01)
  const s = somSuggestion(0.9)
  assert.ok(s.base > 0.01 && s.base < 0.05)
  assert.ok(Math.abs(s.low - s.base * 0.5) < 1e-9)
  assert.ok(Math.abs(s.high - s.base * 1.5) < 1e-9)
})

test('weighted: media ponderata, null se nessun peso', () => {
  const items = [{ v: 10, w: 1 }, { v: 20, w: 3 }]
  assert.equal(weighted(items, (i) => i.v, (i) => i.w), 17.5)
  assert.equal(weighted([], (i) => i.v, (i) => i.w), null)
})

test('computeMarket: esempio dello spec (100 x 0.3 x 0.05 -> SOM 1.5)', () => {
  const m = computeMarket({
    sumFatt: 100, mode: 'compete', spendRatio: null,
    addressable: { low: 0.3, base: 0.3, high: 0.3 },
    capturable: { low: 0.05, base: 0.05, high: 0.05 },
  })
  assert.deepEqual(m.tam, { low: 100, base: 100, high: 100 })
  assert.deepEqual(m.sam, { low: 30, base: 30, high: 30 })
  assert.ok(Math.abs(m.som.base - 1.5) < 1e-9)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { accountFacts, locationQuotient, rankAmong, share, sizeSnapshot } from '../src/sbsInsights.js'

const dataset = JSON.parse(readFileSync(new URL('../public/sbs-it.json', import.meta.url)))

test('la quota usa solo i valori ufficiali', () => {
  assert.equal(share(50, 200), 0.25)
  assert.equal(share(50, null), null)
  assert.equal(share(50, 0), null)
})

test('il rango non tratta i mancanti come zero', () => {
  assert.deepEqual(rankAmong(10, [30, null, 10, 5]), { rank: 2, of: 3 })
  assert.equal(rankAmong(null, [1, 2]), null)
})

test('il quoziente di localizzazione è il rapporto delle quote', () => {
  assert.equal(locationQuotient(20, 100, 50, 500), 2)
  assert.equal(locationQuotient(20, null, 50, 500), null)
})

test('la manifattura 2023 ha quota di VA e microimprese ufficiali', () => {
  const manufacturing = dataset.sectors.find((sector) => sector.code === 'C')
  const sections = dataset.sectors.filter((sector) => sector.level === 'section')
  const facts = accountFacts(manufacturing, {
    total: dataset.total,
    parent: null,
    siblings: sections,
    year: '2023',
    years: dataset.meta.years,
  })
  const shareFact = facts.find((item) => item.id === 'quota-va')
  const expected = manufacturing.years['2023'].AV_MEUR.v / dataset.total.years['2023'].AV_MEUR.v
  assert.equal(shareFact.text, new Intl.NumberFormat('it-IT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(expected))
  const size = sizeSnapshot(manufacturing, '2023', 'ENT_NR')
  assert.equal(size.rows.find((row) => row.code === '0-9').value, 284161)
  const klass = dataset.sectors.find((sector) => sector.code === 'C1011')
  assert.equal(sizeSnapshot(klass, '2023', 'ENT_NR'), null)
})

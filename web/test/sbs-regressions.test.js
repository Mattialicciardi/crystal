import test from 'node:test'
import assert from 'node:assert/strict'
import { accountFacts, regionalRows } from '../src/sbsInsights.js'

const cell = (v) => ({ s: 'v', v })
const reserved = { s: 'c' }
const year = '2023'

test('la produttività Italia richiede il valore aggiunto pubblicato', () => {
  const sector = { years: { [year]: { AV_MEUR: cell(1), EMP_NR: cell(10) } } }
  const total = { years: { [year]: { AV_MEUR: reserved, EMP_NR: cell(100) } } }
  const fact = accountFacts(sector, { total, year, years: [year] })
    .find((item) => item.id === 'produttivita')
  assert.ok(fact)
  assert.equal(fact.detail, null)
})

test('l’indice regionale usa lo stesso perimetro anche con celle riservate', () => {
  const areas = [{ code: 'X' }, { code: 'Y' }]
  const series = (x, y) => ({
    X: { [year]: { EMP_LOC_NR: x } },
    Y: { [year]: { EMP_LOC_NR: y } },
  })
  const A = series(cell(10), cell(10))
  const B = series(cell(90), reserved)
  const rows = regionalRows(A, areas, year, { A, B }, 'A01', 'TOTAL')
  assert.deepEqual(rows.map((row) => row.quotient), [1, 1])

  const TOTAL = series(cell(100), cell(200))
  const official = regionalRows(A, areas, year, { A, B, TOTAL }, 'A01', 'TOTAL')
  assert.deepEqual(official.map((row) => row.quotient), [1.5, 0.75])
})

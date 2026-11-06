import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  columnById,
  displayCell,
  indexDataset,
  rootReading,
  sortSectors,
} from '../src/sbsModel.js'

const dataset = JSON.parse(readFileSync(new URL('../public/sbs-it.json', import.meta.url)))
const { byCode, children } = indexDataset(dataset)

test('il totale Italia 2023 mostra i conti ufficiali', () => {
  const firms = displayCell(dataset.total, '2023', columnById('ENT_NR'))
  const turnover = displayCell(dataset.total, '2023', columnById('NETTUR_MEUR'))
  const valueAdded = displayCell(dataset.total, '2023', columnById('AV_MEUR'))
  const purchases = displayCell(dataset.total, '2023', columnById('PUR_MEUR'))
  const wages = displayCell(dataset.total, '2023', columnById('WAGE_MEUR'))
  const gos = displayCell(dataset.total, '2023', columnById('GOS_MEUR'))
  const investment = displayCell(dataset.total, '2023', columnById('GRSINV_TNCA_MEUR'))
  const labour = displayCell(dataset.total, '2023', columnById('LC_EMP_TEUR'))
  const gor = displayCell(dataset.total, '2023', columnById('GOR_PC'))
  assert.equal(firms.text, '4.625.476')
  assert.equal(turnover.text, '4.274.532,51')
  assert.equal(valueAdded.text, '1.178.245,41')
  assert.equal(purchases.text, '3.162.235,51')
  assert.equal(wages.text, '411.155,43')
  assert.equal(gos.text, '612.468,18')
  assert.equal(investment.text, '157.312,04')
  assert.equal(labour.text, '22,06')
  assert.equal(gor.text, '14,33')
})

test('2024 tiene imprese, fatturato e valore aggiunto ufficiali', () => {
  assert.equal(displayCell(dataset.total, '2024', columnById('ENT_NR')).text, '4.652.416')
  assert.equal(displayCell(dataset.total, '2024', columnById('NETTUR_MEUR')).text, '4.282.294,49')
  assert.equal(displayCell(dataset.total, '2024', columnById('AV_MEUR')).text, '1.212.883,22')
})

test('una cella riservata non diventa zero e blocca il rapporto calcolato', () => {
  const finance = byCode.get('K')
  assert.equal(displayCell(finance, '2023', columnById('NETTUR_MEUR')).text, 'riservato')
  assert.equal(displayCell(finance, '2023', columnById('ENT_NR')).text, '116.685')
  assert.equal(displayCell(finance, '2023', columnById('fatturato_per_impresa_eur')).text, 'riservato')
  assert.equal(displayCell(byCode.get('B05'), '2023', columnById('ENT_NR')).text, '0')
})

test('la gerarchia scende fino alla classe e il fatturato per impresa è calcolato', () => {
  const sections = children.get('__root__').map((sector) => sector.code)
  assert.ok(sections.includes('C'))
  assert.ok(sections.includes('S'))
  assert.equal(sections.includes('A'), false)
  const divisions = children.get('C').map((sector) => sector.code)
  assert.ok(divisions.includes('C10'))
  const groups = children.get('C10').map((sector) => sector.code)
  assert.ok(groups.includes('C101'))
  const classes = children.get('C101')
  assert.ok(classes.some((sector) => sector.code === 'C1011'))
  const perFirm = displayCell(dataset.total, '2023', columnById('fatturato_per_impresa_eur'))
  assert.equal(perFirm.kind, 'calculated')
  assert.equal(perFirm.text, '924.128')
  assert.equal(displayCell(byCode.get('C101'), '2023', columnById('ENT_NR')).text, '3.161')
})

test('ordinare non tratta il riservato come zero', () => {
  const sorted = sortSectors(children.get('B'), '2023', { key: 'NETTUR_MEUR', dir: 'desc' })
  assert.notEqual(sorted[0].code, 'B06')
  assert.equal(sorted.at(-1).years['2023'].NETTUR_MEUR.s === 'c' || sorted.at(-1).code === 'B05', true)
  const reservedIndex = sorted.findIndex((sector) => sector.years['2023'].NETTUR_MEUR?.s === 'c')
  const zeroIndex = sorted.findIndex((sector) => sector.years['2023'].NETTUR_MEUR?.v === 0)
  assert.ok(reservedIndex > sorted.findIndex((sector) => (sector.years['2023'].NETTUR_MEUR?.v || 0) > 0))
  assert.ok(zeroIndex < reservedIndex)
})

test('la lettura di commercio e immobiliari usa i numeri del file', () => {
  const notes = rootReading(byCode, '2023')
  assert.equal(notes.length, 2)
  assert.match(notes[0], /1\.258\.950,42 mln €/)
  assert.match(notes[0], /7,58%/)
  assert.match(notes[1], /44\.854,98 mln €/)
  assert.match(notes[1], /44,38%/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tokenize, buildIndex, suggestSectors } from '../src/match.js'

const SECTORS = [
  { code: '6201', name: "produzione di software non connesso all'edizione" },
  { code: '5610', name: 'ristoranti e attività di ristorazione con somministrazione' },
  { code: '4791', name: 'commercio al dettaglio per corrispondenza o via internet' },
  { code: '1071', name: 'produzione di pane e prodotti di pasticceria freschi' },
]
const idx = buildIndex(SECTORS)

test('tokenize: minuscolo, niente accenti, niente parole corte/stopword', () => {
  const t = tokenize('Voglio costruire un Software gestionale')
  assert.ok(t.includes('software'))
  assert.ok(t.includes('gestionale'))
  assert.ok(!t.includes('un'))
})

test('software → settore software in cima', () => {
  const r = suggestSectors('voglio costruire un software gestionale per le imprese', idx)
  assert.equal(r[0].code, '6201')
})

test('ristorante → ristorazione in cima (via sinonimo)', () => {
  const r = suggestSectors('apro un ristorante con cucina e somministrazione', idx)
  assert.equal(r[0].code, '5610')
})

test('e-commerce online → commercio via internet', () => {
  const r = suggestSectors('una piattaforma e-commerce per vendere online', idx)
  assert.equal(r[0].code, '4791')
})

test('PRD vuoto o troppo corto → nessun suggerimento', () => {
  assert.deepEqual(suggestSectors('', idx), [])
  assert.deepEqual(suggestSectors('ab', idx), [])
})

test('rispetta topN e ordina per punteggio decrescente', () => {
  const r = suggestSectors('software e ristorazione e pane', idx, 2)
  assert.ok(r.length <= 2)
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score)
})

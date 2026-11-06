import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { displayCell, formatShare, titleIt } from '../sbsModel.js'
import {
  EXTRA_ACCOUNTS,
  NUTS_ACCOUNTS,
  SIZE_LABEL,
  accountFacts,
  regionalRows,
  sizeSnapshot,
} from '../sbsInsights.js'

const BAR = ['bg-primary', 'bg-primary/75', 'bg-primary/55', 'bg-primary/40', 'bg-primary/25']

export default function InsightPanel({ sector, parent, siblings, total, year, years, nuts, byCode }) {
  const facts = accountFacts(sector, { total, parent, siblings, year, years })
  const sizeNode = carrier(sector, byCode, (node) => node.size)
  const regionCode = carrier(sector, byCode, (node) => nuts?.series?.[node.code])
  const firms = sizeNode ? sizeSnapshot(sizeNode, year, 'ENT_NR') : null
  const valueAdded = sizeNode ? sizeSnapshot(sizeNode, year, 'AV_MEUR') : null
  const employed = sizeNode ? sizeSnapshot(sizeNode, year, 'EMP_NR') : null
  const regions = regionCode
    ? regionalRows(nuts.series[regionCode.code], nuts.areas, year, nuts.series)
    : []
  const extra = EXTRA_ACCOUNTS.filter((column) => sector.years?.[year]?.[column.id])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Insight · {sector.code}</CardTitle>
          <Badge variant="outline">calcolato</Badge>
        </div>
        <CardDescription>
          {titleIt(sector.name)}. Quote e rapporti usano solo valori ufficiali pubblicati.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {facts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {facts.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-base font-medium tabular-nums">{item.text}</p>
                {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
              </div>
            ))}
          </div>
        )}

        {extra.length > 0 && (
          <Collapsible className="flex flex-col items-start gap-3">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">Altri conti ufficiali</Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="w-full">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {extra.map((column) => {
                  const cell = displayCell(sector, year, column)
                  return (
                    <div key={column.id} className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">{column.label}</p>
                      <p className="tabular-nums">{cell.text}{cell.kind === 'value' || cell.kind === 'estimated' ? ` ${column.unit}` : ''}</p>
                    </div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <Collapsible className="flex flex-col items-start gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">Dimensione d’impresa</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex w-full flex-col gap-3">
            <SizeBlock sector={sector} sizeNode={sizeNode} year={year} firms={firms} employed={employed} valueAdded={valueAdded} />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible className="flex flex-col items-start gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">Regioni</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex w-full flex-col gap-3">
            <RegionBlock sector={sector} regionCode={regionCode} regions={regions} nuts={nuts} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

function carrier(sector, byCode, present) {
  let cursor = sector
  while (cursor) {
    if (present(cursor)) return cursor
    cursor = cursor.parent ? byCode.get(cursor.parent) : null
  }
  return null
}

function levelPhrase(level, code) {
  if (level === 'group') return `del gruppo ${code}`
  if (level === 'division') return `della divisione ${code}`
  if (level === 'section') return `della sezione ${code}`
  return `di ${code}`
}

function shareText(row) {
  if (!row || row.share == null) return 'n.d.'
  return formatShare(row.share)
}

function SizeBlock({ sector, sizeNode, year, firms, employed, valueAdded }) {
  if (!sizeNode) {
    return <p className="text-sm text-muted-foreground">Nessuna classe di addetti pubblicata per questo codice.</p>
  }
  const microFirms = firms?.rows.find((row) => row.code === '0-9')
  const largeValue = valueAdded?.rows.find((row) => row.code === 'GE250')
  const same = sizeNode.code === sector.code
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {same ? 'Fonte sbs_sc_ovw, fino al gruppo NACE.' : `Queste classi sono ${levelPhrase(sizeNode.level, sizeNode.code)}, non di ${sector.code}.`}
        {firms?.partial ? ' Le quote sono sul totale delle classi pubblicate.' : ''}
      </p>
      <p className="text-sm">
        Micro 0–9: {shareText(microFirms)} delle imprese. 250 e più: {shareText(largeValue)} del valore aggiunto.
      </p>
      <SizeBars title="Imprese" snapshot={firms} digits={0} />
      <SizeBars title="Addetti" snapshot={employed} digits={0} />
      <SizeBars title="Valore aggiunto" snapshot={valueAdded} digits={2} />
    </div>
  )
}

function SizeBars({ title, snapshot, digits }) {
  if (!snapshot) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {snapshot.rows.map((row, index) => (
          row.share ? <div key={row.code} className={BAR[index]} style={{ width: `${row.share * 100}%` }} /> : null
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {snapshot.rows.map((row) => (
          <p key={row.code} className="text-xs text-muted-foreground">
            {SIZE_LABEL[row.code]}
            <span className="block text-foreground tabular-nums">
              {row.status === 'reserved' ? 'riservato' : row.value == null ? 'n.d.' : formatCompact(row.value, digits)}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}

function formatCompact(value, digits) {
  return new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

function RegionBlock({ sector, regionCode, regions, nuts }) {
  if (!regionCode) {
    return <p className="text-sm text-muted-foreground">Il dataset regionale non pubblica questo codice.</p>
  }
  const same = regionCode.code === sector.code
  const top = regions.find((row) => row.employed != null)
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {nuts.note} {same ? 'Livello di questo codice.' : `Dati ${levelPhrase(regionCode.level, regionCode.code)}, non di ${sector.code}.`}
        {top ? ` Prima per addetti: ${top.name}.` : ''}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Regione</TableHead>
            {NUTS_ACCOUNTS.slice(0, 3).map((column) => (
              <TableHead key={column.id} className="text-right">{column.label}</TableHead>
            ))}
            <TableHead className="text-right">LQ addetti</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regions.slice(0, 8).map((row) => (
            <TableRow key={row.code}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{show(row.localUnits, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.reserved ? 'riservato' : show(row.employed, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{show(row.wages, 2)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.quotient == null ? 'n.d.' : row.quotient.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function show(value, digits) {
  if (value == null) return 'n.d.'
  return formatCompact(value, digits)
}

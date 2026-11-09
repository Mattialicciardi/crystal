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

export default function InsightPanel({ sector, parent, siblings, total, year, years, nuts, byCode, totalCode }) {
  const facts = accountFacts(sector, { total, parent, siblings, year, years })
  const primaryFacts = facts.slice(0, 4)
  const additionalFacts = facts.slice(4)
  const insightGroups = [
    { title: 'Posizione tra attività simili', ids: ['rango-va', 'rango-fatt'] },
    { title: 'Produttività e struttura dei conti', ids: ['produttivita', 'mol-va', 'gor'] },
    { title: 'Acquisti e costo del lavoro', ids: ['acquisti', 'rivendita', 'rivendita-acquisti', 'lavoro-wage', 'lavoro-costo'] },
    { title: 'Andamento del fatturato', ids: ['var-2324', 'var-2124'] },
    { title: 'Confronto con l’Unione europea', ids: ['ue-prod', 'ue-quota'] },
  ].map((group) => ({
    ...group,
    items: additionalFacts.filter((item) => group.ids.includes(item.id)),
  })).filter((group) => group.items.length > 0)
  const sizeNode = carrier(sector, byCode, (node) => node.size)
  const regionCode = carrier(sector, byCode, (node) => nuts?.series?.[node.code])
  const firms = sizeNode ? sizeSnapshot(sizeNode, year, 'ENT_NR') : null
  const valueAdded = sizeNode ? sizeSnapshot(sizeNode, year, 'AV_MEUR') : null
  const employed = sizeNode ? sizeSnapshot(sizeNode, year, 'EMP_NR') : null
  const regions = regionCode
    ? regionalRows(nuts.series[regionCode.code], nuts.areas, year, nuts.series, regionCode.code, totalCode)
    : []
  const extra = EXTRA_ACCOUNTS.filter((column) => sector.years?.[year]?.[column.id])

  return (
    <Card className="gap-3 border-0 bg-transparent py-0 ring-0">
      <CardHeader className="px-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Indicatori · {sector.code}</CardTitle>
          <Badge variant="outline">calcolato</Badge>
        </div>
        <CardDescription>
          {titleIt(sector.name)}. Quote e rapporti usano solo valori ufficiali pubblicati.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        {primaryFacts.length > 0 && (
          <FactsGrid items={primaryFacts} />
        )}

        {additionalFacts.length > 0 && (
          <Collapsible className="flex flex-col items-start gap-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">Confronti e indicatori calcolati ({additionalFacts.length})</Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="w-full">
              <div className="flex flex-col gap-5">
                <p className="text-sm text-muted-foreground">
                  Rapporti, confronti e variazioni calcolati sui dati ufficiali. Ogni voce indica il periodo o la base di confronto.
                </p>
                {insightGroups.map((group) => (
                  <section key={group.title} className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium">{group.title}</h3>
                    <FactsGrid items={group.items} />
                  </section>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {extra.length > 0 && (
          <Collapsible className="flex flex-col items-start gap-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">Altre voci economiche</Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="w-full">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Altri valori pubblicati nei conti economici, con l’unità di misura indicata accanto a ciascun dato.
                </p>
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
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <Collapsible className="flex flex-col items-start gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">Imprese per fascia di addetti</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex w-full flex-col gap-3">
            <SizeBlock sector={sector} sizeNode={sizeNode} year={year} firms={firms} employed={employed} valueAdded={valueAdded} />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible className="flex flex-col items-start gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">Distribuzione nelle regioni</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex w-full flex-col gap-3">
            <RegionBlock sector={sector} regionCode={regionCode} regions={regions} nuts={nuts} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

function FactsGrid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-1 border-b border-border/50 py-2">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-base font-medium tabular-nums">{item.text}</p>
          {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
        </div>
      ))}
    </div>
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
    return <p className="text-sm text-muted-foreground">Per questo livello non è disponibile una ripartizione delle imprese per fascia di addetti.</p>
  }
  const same = sizeNode.code === sector.code
  const snapshots = [
    { title: 'Imprese', description: 'Numero di imprese in ciascuna fascia.', unit: 'imprese', snapshot: firms, digits: 0 },
    { title: 'Addetti', description: 'Addetti impiegati dalle imprese di ciascuna fascia.', unit: 'addetti', snapshot: employed, digits: 0 },
    { title: 'Valore aggiunto', description: 'Valore aggiunto prodotto dalle imprese di ciascuna fascia.', unit: 'mln €', snapshot: valueAdded, digits: 2 },
  ]
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {same
          ? `Fonte sbs_sc_ovw · dati per ${sizeLevelName(sizeNode.level)} ${sizeNode.code}.`
          : `La ripartizione disponibile è ${levelPhrase(sizeNode.level, sizeNode.code)}: descrive quel livello, non il solo codice ${sector.code}.`}
      </p>
      <p className="text-sm text-muted-foreground">
        Ogni riga raggruppa le imprese in base ai loro addetti; le quote mostrano il peso della fascia sul totale delle fasce pubblicate per ciascun indicatore.
      </p>
      {snapshots.map((item) => (
        <SizeDistribution key={item.title} {...item} />
      ))}
    </div>
  )
}

function sizeLevelName(level) {
  if (level === 'group') return 'il gruppo NACE'
  if (level === 'division') return 'la divisione'
  if (level === 'section') return 'la sezione'
  return 'il livello'
}

function SizeDistribution({ title, description, unit, snapshot, digits }) {
  if (!snapshot) return null
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Table aria-label={`Distribuzione di ${title.toLowerCase()} per fascia di addetti`}>
        <TableHeader>
          <TableRow>
            <TableHead>Fascia di addetti</TableHead>
            <TableHead className="text-right">{unit}</TableHead>
            <TableHead className="text-right">Quota delle fasce pubblicate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshot.rows.map((row) => (
            <TableRow key={row.code}>
              <TableCell>{SIZE_LABEL[row.code]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.status === 'reserved' ? 'riservato' : row.value == null ? 'non disponibile' : formatCompact(row.value, digits)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{shareText(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {snapshot.partial && (
        <p className="text-xs text-muted-foreground">
          Ripartizione parziale: le quote sono calcolate solo sulle fasce disponibili e non rappresentano il totale del settore.
        </p>
      )}
    </div>
  )
}

function formatCompact(value, digits) {
  return new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: true }).format(value)
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
            <TableHead className="text-right">Indice addetti</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regions.slice(0, 8).map((row) => (
            <TableRow key={row.code}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{show(row.localUnits, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.reserved ? 'riservato' : show(row.employed, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{show(row.wages, 2)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.quotient == null ? 'n.d.' : row.quotient.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        L’indice confronta il peso del settore con quello delle aree confrontabili, usando lo stesso perimetro di attività. Sopra 1, il settore pesa di più nella regione.
      </p>
    </div>
  )
}

function show(value, digits) {
  if (value == null) return 'n.d.'
  return formatCompact(value, digits)
}

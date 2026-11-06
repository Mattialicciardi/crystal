import { useEffect, useMemo, useState } from 'react'
import { InfoIcon, SearchIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TooltipProvider } from '@/components/ui/tooltip'
import InsightPanel from './components/InsightPanel.jsx'
import SectorTable from './components/SectorTable.jsx'
import SbsTreemap from './components/SbsTreemap.jsx'
import {
  COLUMNS,
  DEFAULT_SIZE,
  GLOSSARY,
  KPI_IDS,
  LEVEL_LABEL,
  LEVEL_PLURAL,
  SIZE_METRICS,
  ancestorsOf,
  collectDescendants,
  collectLevel,
  columnById,
  displayCell,
  indexDataset,
  formatVariation,
  levelsBelow,
  matchesView,
  normalize,
  parseBound,
  publishedValue,
  rootReading,
  sortSectors,
  titleIt,
} from './sbsModel.js'

const BASE = import.meta.env.BASE_URL

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [year, setYear] = useState('2023')
  const [path, setPath] = useState([])
  const [sizeKey, setSizeKey] = useState(DEFAULT_SIZE)
  const [sort, setSort] = useState({ key: 'AV_MEUR', dir: 'desc' })
  const [query, setQuery] = useState('')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [rowLevel, setRowLevel] = useState('auto')
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setRowLevel('auto')
    setSectionFilter('all')
  }, [path])

  useEffect(() => {
    fetch(`${BASE}sbs-it.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(setData)
      .catch((reason) => setError(String(reason)))
  }, [])

  const indexed = useMemo(() => (data ? indexDataset(data) : null), [data])

  if (error) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center px-4">
        <Alert variant="destructive">
          <AlertTitle>I dati non si caricano</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    )
  }

  if (!data || !indexed) return <LoadingState />

  const { byCode, children } = indexed
  const focusCode = path.length ? path[path.length - 1] : null
  const focus = focusCode ? byCode.get(focusCode) : data.total
  const levelOptions = levelsBelow(focusCode ? focus.level : null)
  const activeLevel = rowLevel !== 'auto' && levelOptions.includes(rowLevel) ? rowLevel : levelOptions[0]
  const levelRows = activeLevel ? collectLevel(children, focusCode, activeLevel) : []
  const normalizedQuery = normalize(query.trim())
  const searchPool = normalizedQuery && rowLevel === 'auto'
    ? collectDescendants(children, focusCode)
    : levelRows
  const sectionOptions = [...new Set(levelRows.map((sector) => sector.section))].sort()
  const sizeColumn = columnById(sizeKey)
  const filtered = searchPool.filter((sector) => matchesView(sector, {
    year,
    column: sizeColumn,
    query: normalizedQuery,
    section: sectionFilter,
    publishedOnly,
    min: parseBound(minText),
    max: parseBound(maxText),
  }))
  const sorted = sortSectors(filtered, year, sort)
  const level = sorted.length && sorted.every((sector) => sector.level === sorted[0].level) ? sorted[0].level : activeLevel
  const globalHits = normalizedQuery.length < 2 ? [] : data.sectors
    .filter((sector) => normalize(`${sector.code} ${sector.name} ${titleIt(sector.name)}`).includes(normalizedQuery))
    .filter((sector) => !searchPool.some((row) => row.code === sector.code))
    .slice(0, 6)

  const openSector = (code) => {
    const kids = children.get(code) || []
    if (kids.length) {
      setPath([...ancestorsOf(byCode, code), code])
      setSelected(null)
    } else {
      setPath(ancestorsOf(byCode, code))
      setSelected(code)
    }
    setQuery('')
  }

  const clickHeader = (key) => {
    setSort((current) => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }))
  }

  const crumbs = [{ label: 'Italia', length: 0 }]
  path.forEach((code, index) => {
    const sector = byCode.get(code)
    crumbs.push({ label: `${code} · ${titleIt(sector?.name)}`, length: index + 1 })
  })

  const selectedSector = selected ? byCode.get(selected) : null
  const reading = rootReading(byCode, year)
  const turnoverNote = data.meta.coverage.class_turnover[year]
  const yearIndex = data.meta.years.indexOf(year)
  const previousYear = yearIndex > 0 ? data.meta.years[yearIndex - 1] : null

  return (
    <TooltipProvider>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10">
        <header className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Crystal</p>
            <h1 className="text-3xl font-medium tracking-tight">Mappa dei settori italiani</h1>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={year}
                onValueChange={(value) => { if (value) setYear(value) }}
                aria-label="Anno"
              >
                {data.meta.years.map((item) => (
                  <ToggleGroupItem key={item} value={item}>{item}</ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-sm text-muted-foreground">NACE Rev. 2 · ATECO 2007 · non ATECO 2025</p>
            </div>
            <ReadingGuide data={data} year={year} reading={reading} turnoverNote={turnoverNote} />
          </div>
        </header>

        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => {
              const current = index === crumbs.length - 1
              return (
                <BreadcrumbItem key={crumb.length}>
                  {index > 0 && <BreadcrumbSeparator />}
                  {current ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button type="button" onClick={() => { setPath(path.slice(0, crumb.length)); setSelected(null); setQuery('') }}>
                        {crumb.label}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <KpiCard sector={focus} year={year} previousYear={previousYear} isTotal={!focusCode} totalCode={data.meta.total_code} />

        {(selectedSector || focusCode) && (
          <InsightPanel
            sector={selectedSector || focus}
            parent={((selectedSector || focus).parent ? byCode.get((selectedSector || focus).parent) : null)}
            siblings={children.get((selectedSector || focus).parent || '__root__') || []}
            total={data.total}
            year={year}
            years={data.meta.years}
            nuts={data.nuts}
            byCode={byCode}
          />
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Panoramica</CardTitle>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <InfoIcon data-icon="inline-start" />
                    Area e colore
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  L’area segue la metrica scelta. Il colore distingue la sezione e non è un giudizio. Il commercio (G) include la merce rivenduta: col fatturato, G occupa più spazio del valore creato.
                </HoverCardContent>
              </HoverCard>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={2}
              value={sizeKey}
              onValueChange={(value) => { if (value) setSizeKey(value) }}
              aria-label="Metrica dell’area"
              className="w-full flex-wrap justify-start"
            >
              {SIZE_METRICS.map((metric) => metric.rate ? (
                <HoverCard key={metric.id}>
                  <HoverCardTrigger asChild>
                    <ToggleGroupItem value={metric.id}>{metric.label}</ToggleGroupItem>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-72">
                    Rapporto calcolato, non un totale. L’area confronta la retribuzione media per addetto. Non è il costo del lavoro per addetto.
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <ToggleGroupItem key={metric.id} value={metric.id}>{metric.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="flex flex-wrap items-end gap-3">
              <Field className="w-56">
                <FieldLabel htmlFor="map-search">Cerca</FieldLabel>
                <Input id="map-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Codice o nome" />
              </Field>
              <Field className="w-40">
                <FieldLabel>Sezione</FieldLabel>
                <Select value={sectionOptions.includes(sectionFilter) || sectionFilter === 'all' ? sectionFilter : 'all'} onValueChange={setSectionFilter}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Tutte" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Tutte</SelectItem>
                      {sectionOptions.map((section) => (
                        <SelectItem key={section} value={section}>{section}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {levelOptions.length > 1 && (
                <Field className="w-44">
                  <FieldLabel>Livello</FieldLabel>
                  <Select value={rowLevel === 'auto' ? 'auto' : activeLevel} onValueChange={setRowLevel}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="auto">Livello attuale</SelectItem>
                        {levelOptions.map((item) => (
                          <SelectItem key={item} value={item}>{LEVEL_PLURAL[item]}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Button type="button" size="sm" variant={publishedOnly ? 'secondary' : 'outline'} onClick={() => setPublishedOnly((current) => !current)}>
                Solo pubblicati
              </Button>
              <Field className="w-28">
                <FieldLabel htmlFor="metric-min">Min {sizeColumn?.unit}</FieldLabel>
                <Input id="metric-min" inputMode="decimal" value={minText} onChange={(event) => setMinText(event.target.value)} placeholder="min" />
              </Field>
              <Field className="w-28">
                <FieldLabel htmlFor="metric-max">Max {sizeColumn?.unit}</FieldLabel>
                <Input id="metric-max" inputMode="decimal" value={maxText} onChange={(event) => setMaxText(event.target.value)} placeholder="max" />
              </Field>
            </div>
            {sizeKey === 'NETTUR_MEUR' && (
              <p className="text-sm text-muted-foreground">G include la merce rivenduta: l’area è più grande del valore creato.</p>
            )}
            {sizeColumn?.rate && (
              <p className="text-sm text-muted-foreground">Rapporto calcolato: l’area non è un totale del settore.</p>
            )}
            <SbsTreemap items={filtered} year={year} sizeKey={sizeKey} onOpen={openSector} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tabella {level ? LEVEL_PLURAL[level] : ''}</CardTitle>
            <CardDescription>
              {filtered.length} {level ? (filtered.length === 1 ? LEVEL_LABEL[level] : LEVEL_PLURAL[level]) : 'voci'}
              {normalizedQuery ? ` su ${searchPool.length}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {globalHits.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Altrove nella mappa</span>
                {globalHits.map((sector) => (
                  <Button key={sector.code} variant="outline" size="sm" onClick={() => openSector(sector.code)}>
                    {sector.code} · {titleIt(sector.name)}
                  </Button>
                ))}
              </div>
            )}
            {sorted.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><SearchIcon /></EmptyMedia>
                  <EmptyTitle>Nessuna voce</EmptyTitle>
                  <EmptyDescription>Nessun settore corrisponde ai filtri.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <SectorTable
                rows={sorted}
                year={year}
                sort={sort}
                onSort={clickHeader}
                selected={selected}
                childrenOf={children}
                onOpen={(sector, kids) => (kids ? openSector(sector.code) : setSelected(sector.code))}
              />
            )}
          </CardContent>
          {selectedSector && (
            <CardContent>
              <SectorNote sector={selectedSector} year={year} />
            </CardContent>
          )}
        </Card>

        <footer className="text-sm text-muted-foreground">
          <a className="text-primary underline-offset-4 hover:underline" href={data.meta.source_url}>Eurostat sbs_ovw_act</a>
          {' · '}
          <a className="text-primary underline-offset-4 hover:underline" href="https://www.istat.it/">ISTAT</a>
          {' · '}
          aggiornamento {data.meta.last_update_label}
        </footer>
      </main>
    </TooltipProvider>
  )
}

function LoadingState() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 w-full max-w-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}
      </div>
      <p className="text-sm text-muted-foreground">Carico i conti delle imprese italiane…</p>
    </main>
  )
}

function definitionFor(column) {
  const direct = GLOSSARY.find((item) => item.code === column.id)
  if (direct) return direct.body
  if (column.derived) return GLOSSARY.find((item) => item.code === 'calcolati')?.body || null
  return null
}

function CellValue({ cell }) {
  if (cell.kind === 'reserved') return <Badge variant="outline">riservato</Badge>
  if (cell.kind === 'unpublished') return <Badge variant="secondary">non pubblicato</Badge>
  if (cell.kind === 'missing') return <span className="text-muted-foreground">n.d.</span>
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span>{cell.text}</span>
      {cell.kind === 'estimated' && <Badge variant="secondary">stima</Badge>}
    </span>
  )
}

function KpiCard({ sector, year, previousYear, isTotal, totalCode }) {
  return (
    <section className="flex flex-col gap-4" aria-label="Indicatori del livello corrente">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-xl font-medium tracking-tight">
          {isTotal ? 'Italia' : `${sector.code} · ${titleIt(sector.name)}`}
        </h2>
        {isTotal && <Badge variant="outline">{totalCode}</Badge>}
        {!sector.published && <Badge variant="secondary">totale non pubblicato</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {KPI_IDS.map((id) => {
          const column = columnById(id)
          const cell = displayCell(sector, year, column)
          const variation = previousYear
            ? formatVariation(publishedValue(sector, year, id), publishedValue(sector, previousYear, id))
            : null
          const numeric = cell.kind === 'value' || cell.kind === 'estimated'
          return (
            <Card key={id} size="sm">
              <CardHeader>
                <CardDescription>
                  <TermHint column={column} />
                </CardDescription>
                <CardTitle>
                  {numeric ? (
                    <span className="tabular-nums">{cell.text}{column.unit === '%' ? '%' : ''}</span>
                  ) : (
                    <CellValue cell={cell} />
                  )}
                </CardTitle>
              </CardHeader>
              {(variation || (numeric && column.unit !== '%') || cell.kind === 'estimated') && (
                <CardContent className="flex flex-wrap items-center gap-2">
                  {numeric && column.unit !== '%' && <span className="text-muted-foreground">{column.unit}</span>}
                  {cell.kind === 'estimated' && <Badge variant="secondary">stima</Badge>}
                  {variation && <Badge variant="outline">vs {previousYear}: {variation}</Badge>}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function TermHint({ column }) {
  const definition = definitionFor(column)
  if (!definition) return column.label
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button type="button" className="text-left underline-offset-4 hover:underline">{column.label}</button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">{definition}</HoverCardContent>
    </HoverCard>
  )
}

function ReadingGuide({ data, year, reading, turnoverNote }) {
  return (
    <Collapsible className="flex flex-col items-start gap-3">
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm">
          <InfoIcon data-icon="inline-start" />
          Come leggere i dati
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="w-full">
        <div className="flex max-w-3xl flex-col gap-4 rounded-xl bg-muted/50 p-4">
          <p>{data.meta.classification_note} I titoli sono quelli italiani di ATECO 2007.</p>
          <p>
            Mancano le sezioni A (agricoltura) e O (pubblica amministrazione). S non ha il totale di sezione; alcune divisioni sì.
            K ha imprese e addetti, i conti di bilancio sono riservati. Il totale è l’aggregato {data.meta.total_code}.
            La classe di addetti (sbs_sc_ovw) arriva al gruppo. Le regioni (sbs_r_nuts2021) arrivano alla divisione e contano le unità locali, non i conti nazionali.
          </p>
          <p>
            Nel {year} il fatturato di classe è pubblicato per {turnoverNote.published} classi, riservato per {turnoverNote.reserved}, assente per {turnoverNote.absent}.
            «Riservato» non è zero. I rapporti segnati come calcolati usano solo valori ufficiali pubblicati.
          </p>
          {reading.length > 0 && <Separator />}
          {reading.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <Separator />
          <div className="flex flex-col gap-3">
            {GLOSSARY.map((item) => (
              <div key={item.title} className="flex flex-col gap-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            {data.meta.producer_note} {data.meta.total_name}. {data.meta.total_name_en}. Questi conti descrivono la struttura. Non sono un consiglio di investimento.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function withUnit(cell, unit) {
  if (cell.kind === 'value' || cell.kind === 'estimated' || cell.kind === 'calculated') {
    return unit === '%' ? `${cell.text}%` : `${cell.text} ${unit}`
  }
  return cell.text
}

function SectorNote({ sector, year }) {
  const turnover = displayCell(sector, year, columnById('NETTUR_MEUR'))
  const valueAdded = displayCell(sector, year, columnById('AV_MEUR'))
  const gor = displayCell(sector, year, columnById('GOR_PC'))
  const firms = displayCell(sector, year, columnById('ENT_NR'))
  return (
    <Alert>
      <AlertTitle>{sector.code} · {titleIt(sector.name)}</AlertTitle>
      <AlertDescription>
        {year} · {firms.text} imprese · fatturato {withUnit(turnover, 'mln €')} · valore aggiunto {withUnit(valueAdded, 'mln €')} · GOR {withUnit(gor, '%')}
      </AlertDescription>
    </Alert>
  )
}

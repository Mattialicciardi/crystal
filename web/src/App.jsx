import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { InfoIcon, MoonIcon, SearchIcon, SunIcon } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TooltipProvider } from '@/components/ui/tooltip'
import InsightPanel from './components/InsightPanel.jsx'
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
  columnById,
  displayCell,
  indexDataset,
  formatVariation,
  normalize,
  publishedValue,
  rootReading,
  sortSectors,
  titleIt,
} from './sbsModel.js'

const BASE = import.meta.env.BASE_URL
const PRIMARY_KPI_IDS = ['NETTUR_MEUR', 'AV_MEUR', 'EMP_NR', 'ENT_NR']
const SECONDARY_KPI_IDS = KPI_IDS.filter((id) => !PRIMARY_KPI_IDS.includes(id))
const THEME_STORAGE_KEY = 'crystal-theme'

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [theme, setTheme] = useState(getInitialTheme)
  const [year, setYear] = useState('2023')
  const [path, setPath] = useState([])
  const [sizeKey, setSizeKey] = useState(DEFAULT_SIZE)
  const [sort, setSort] = useState({ key: 'AV_MEUR', dir: 'desc' })
  const [view, setView] = useState('table')
  const [showAllMetrics, setShowAllMetrics] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

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

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

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
  const rows = children.get(focusCode || '__root__') || []
  const normalizedQuery = normalize(query.trim())
  const filtered = normalizedQuery
    ? rows.filter((sector) => normalize(`${sector.code} ${sector.name} ${titleIt(sector.name)}`).includes(normalizedQuery))
    : rows
  const visibleColumns = showAllMetrics ? COLUMNS : COLUMNS.filter((column) => PRIMARY_KPI_IDS.includes(column.id))
  const visibleSort = visibleColumns.some((column) => column.id === sort.key) || sort.key === 'name'
    ? sort
    : { key: 'AV_MEUR', dir: 'desc' }
  const sorted = sortSectors(filtered, year, visibleSort)
  const level = sorted[0]?.level || rows[0]?.level
  const globalHits = normalizedQuery.length < 2 ? [] : data.sectors
    .filter((sector) => normalize(`${sector.code} ${sector.name} ${titleIt(sector.name)}`).includes(normalizedQuery))
    .filter((sector) => !rows.some((row) => row.code === sector.code))
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
    setSort({ key, dir: visibleSort.key === key && visibleSort.dir === 'desc' ? 'asc' : 'desc' })
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
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-medium tracking-tight">Mappa dei settori italiani</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Attiva tema ${theme === 'dark' ? 'chiaro' : 'scuro'}`}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <SunIcon data-icon="inline-start" /> : <MoonIcon data-icon="inline-start" />}
              {theme === 'dark' ? 'Chiaro' : 'Scuro'}
            </Button>
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
          <FieldGroup className="max-w-xl">
            <Field>
              <FieldLabel htmlFor="sector-search">Cerca un settore</FieldLabel>
              <div className="relative">
                <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sector-search"
                  type="search"
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Codice ATECO o nome dell’attività"
                />
              </div>
            </Field>
          </FieldGroup>
          {globalHits.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              <span className="text-sm text-muted-foreground">Altri livelli</span>
              {globalHits.map((sector) => (
                <Button key={sector.code} variant="outline" size="sm" onClick={() => openSector(sector.code)}>
                  {sector.code} · {titleIt(sector.name)}
                </Button>
              ))}
            </div>
          )}
        </header>

        {path.length > 0 && (
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
        )}

        <KpiCard sector={selectedSector || focus} year={year} previousYear={previousYear} isTotal={!focusCode && !selectedSector} totalCode={data.meta.total_code} />

        {(selectedSector || focusCode) && (
          <details key={(selectedSector || focus).code} className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">Analisi del settore</summary>
              <InsightPanel
                sector={selectedSector || focus}
                parent={((selectedSector || focus).parent ? byCode.get((selectedSector || focus).parent) : null)}
                siblings={children.get((selectedSector || focus).parent || '__root__') || []}
                total={data.total}
                year={year}
                years={data.meta.years}
                totalCode={data.meta.total_code}
                nuts={data.nuts}
                byCode={byCode}
              />
          </details>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">Esplora i settori</h2>
          <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value) setView(value) }} aria-label="Vista settori" variant="outline">
            <ToggleGroupItem value="table">Tabella</ToggleGroupItem>
            <ToggleGroupItem value="map">Mappa</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {view === 'map' ? (
          <Card className="gap-3 border-0 bg-transparent py-0 ring-0">
            <CardHeader className="px-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Mappa {level ? LEVEL_PLURAL[level] : ''}</CardTitle>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Informazioni sulla mappa">
                      <InfoIcon />
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    Il colore identifica la sezione e non esprime un giudizio. Il commercio (G) include la merce rivenduta: col fatturato occupa più spazio del valore creato.
                  </HoverCardContent>
                </HoverCard>
              </div>
              <CardDescription>Seleziona un riquadro per esplorare i livelli; area e colore aiutano a confrontare i settori.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-0">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="treemap-size" className="text-sm font-medium">Area proporzionale a</label>
                <select
                  id="treemap-size"
                  value={sizeKey}
                  onChange={(event) => setSizeKey(event.target.value)}
                  className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {SIZE_METRICS.map((metric) => (
                    <option key={metric.id} value={metric.id}>{metric.label}</option>
                  ))}
                </select>
                {sizeKey === 'NETTUR_MEUR' && (
                  <p className="text-sm text-muted-foreground">G include la merce rivenduta: l’area supera il valore creato.</p>
                )}
              </div>
              <SbsTreemap items={filtered} year={year} sizeKey={sizeKey} onOpen={openSector} />
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-3 border-0 bg-transparent py-0 ring-0">
            <CardHeader className="px-0">
              <CardTitle>Tabella {level ? LEVEL_PLURAL[level] : ''}</CardTitle>
              <CardDescription>
                {filtered.length} {level ? (filtered.length === 1 ? LEVEL_LABEL[level] : LEVEL_PLURAL[level]) : 'voci'}
                {normalizedQuery ? ` su ${rows.length}` : ''}
                {' · Seleziona una voce per scendere di livello o aprire i dettagli.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-0">
              <Button type="button" variant="outline" size="sm" className="self-start" aria-pressed={showAllMetrics} onClick={() => setShowAllMetrics((current) => !current)}>
                {showAllMetrics ? 'Mostra indicatori principali' : 'Mostra tutti gli indicatori'}
              </Button>
              <p className="text-xs text-muted-foreground sm:hidden">Scorri la tabella in orizzontale per vedere tutte le metriche.</p>
              {sorted.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><SearchIcon /></EmptyMedia>
                    <EmptyTitle>Nessuna voce</EmptyTitle>
                    <EmptyDescription>Nessuna voce di questo livello corrisponde alla ricerca.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className={showAllMetrics ? "min-w-[1100px]" : "min-w-[540px]"}>
                  <TableHeader className="[&_tr]:border-border/60 [&_tr]:bg-muted/30">
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-background whitespace-normal" aria-sort={ariaSort(visibleSort, 'name')}>
                        <SortButton label="Settore" active={visibleSort.key === 'name'} dir={visibleSort.dir} onClick={() => clickHeader('name')} />
                      </TableHead>
                      {visibleColumns.map((column) => (
                        <TableHead key={column.id} className="max-w-32 whitespace-normal text-right text-xs text-muted-foreground" aria-sort={ariaSort(visibleSort, column.id)}>
                          <ColumnHeading column={column} sort={visibleSort} onSort={() => clickHeader(column.id)} />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((sector) => {
                      const kids = (children.get(sector.code) || []).length > 0
                      const active = selected === sector.code
                      return (
                        <TableRow
                          key={sector.code}
                          className="border-border/50 hover:bg-muted/40"
                          data-state={active ? 'selected' : undefined}
                        >
                          <TableHead scope="row" className="sticky left-0 max-w-64 bg-background whitespace-normal font-normal">
                            <span className="flex flex-col items-start gap-1">
                              <span className="text-xs text-muted-foreground tabular-nums">{sector.code}</span>
                              <button
                                type="button"
                                className="text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                onClick={() => openSector(sector.code)}
                                aria-label={`${kids ? 'Esplora' : 'Mostra dettagli di'} ${sector.code} ${titleIt(sector.name)}`}
                              >
                                {titleIt(sector.name)}
                              </button>
                              {!sector.published && <Badge variant="secondary">totale non pubblicato</Badge>}
                            </span>
                          </TableHead>
                          {visibleColumns.map((column) => (
                            <TableCell key={column.id} className="text-right text-xs tabular-nums md:text-sm">
                              <CellValue cell={displayCell(sector, year, column)} />
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {selectedSector && (
              <CardContent>
                <SectorNote sector={selectedSector} year={year} />
              </CardContent>
            )}
          </Card>
        )}

        <footer className="text-sm text-muted-foreground">
          <a className="text-primary underline-offset-4 hover:underline" href={data.meta.source_url}>Eurostat sbs_ovw_act</a>
          {' · '}
          <a className="text-primary underline-offset-4 hover:underline" href="https://www.istat.it/">ISTAT</a>
          {' · '}
          aggiornamento {data.meta.last_update}
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

function ariaSort(sort, key) {
  if (sort.key !== key) return 'none'
  return sort.dir === 'asc' ? 'ascending' : 'descending'
}

function mark(dir) {
  return dir === 'desc' ? '↓' : '↑'
}

function definitionFor(column) {
  const direct = GLOSSARY.find((item) => item.code === column.id)
  if (direct) return direct.body
  if (column.derived) return GLOSSARY.find((item) => item.code === 'calcolati')?.body || null
  return null
}

function SortButton({ label, active, dir, onClick, detail }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="h-auto px-1">
      <span className="flex flex-col items-start gap-0.5 text-left">
        <span>{label}{active ? ` ${mark(dir)}` : ''}</span>
        {detail && <span className="text-xs font-normal text-muted-foreground">{detail}</span>}
      </span>
    </Button>
  )
}

function ColumnHeading({ column, sort, onSort }) {
  const definition = definitionFor(column)
  const detail = `${column.unit}${column.derived ? ' · calcolato' : ''}`
  const button = (
    <SortButton
      label={column.label}
      detail={detail}
      active={sort.key === column.id}
      dir={sort.dir}
      onClick={onSort}
    />
  )
  if (!definition) return <div className="flex justify-end">{button}</div>
  return (
    <div className="flex justify-end">
      <HoverCard>
        <HoverCardTrigger asChild>{button}</HoverCardTrigger>
        <HoverCardContent className="w-80" align="end">{definition}</HoverCardContent>
      </HoverCard>
    </div>
  )
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
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {PRIMARY_KPI_IDS.map((id) => (
          <KpiMetric key={id} id={id} sector={sector} year={year} previousYear={previousYear} />
        ))}
      </div>
      {SECONDARY_KPI_IDS.length > 0 && (
        <Collapsible className="flex flex-col items-start gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">Altri indicatori ufficiali ({SECONDARY_KPI_IDS.length})</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="w-full">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Altri valori dei conti economici. Le descrizioni spiegano ogni voce; dove disponibile, il confronto mostra la variazione rispetto all’anno precedente.
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {SECONDARY_KPI_IDS.map((id) => (
                  <KpiMetric key={id} id={id} sector={sector} year={year} previousYear={previousYear} />
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}

function KpiMetric({ id, sector, year, previousYear }) {
  const column = columnById(id)
  const cell = displayCell(sector, year, column)
  const variation = previousYear
    ? formatVariation(publishedValue(sector, year, id), publishedValue(sector, previousYear, id))
    : null
  const numeric = cell.kind === 'value' || cell.kind === 'estimated'
  return (
    <Card size="sm" className="rounded-none border-0 bg-transparent py-2 ring-0">
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

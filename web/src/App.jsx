import { useEffect, useMemo, useState } from 'react'
import { SearchIcon } from 'lucide-react'
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TooltipProvider } from '@/components/ui/tooltip'
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
  kpiVariation,
  normalize,
  rootReading,
  sectionReading,
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
  const sorted = sortSectors(filtered, year, sort)
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
    setSort((current) => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }))
  }

  const crumbs = [{ label: 'Italia', length: 0 }]
  path.forEach((code, index) => {
    const sector = byCode.get(code)
    crumbs.push({ label: `${code} · ${titleIt(sector?.name)}`, length: index + 1 })
  })

  const selectedSector = selected ? byCode.get(selected) : null
  const reading = focusCode ? [sectionReading(focus, year)].filter(Boolean) : rootReading(byCode, year)
  const turnoverNote = data.meta.coverage.class_turnover[year]
  const otherYear = year === '2023' ? '2024' : '2023'

  return (
    <TooltipProvider>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">Crystal</p>
            <h1 className="text-3xl font-medium tracking-tight">Mappa dei settori italiani</h1>
            <p className="max-w-3xl text-muted-foreground">
              Conti strutturali delle imprese, anno {year}. Si parte dalle sezioni NACE e si scende fino alla classe, quattro cifre.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
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
            <p className="text-sm text-muted-foreground">
              Eurostat {data.meta.dataset} · aggiornamento {data.meta.last_update_label}
            </p>
          </div>
        </header>

        <Alert>
          <AlertTitle>NACE Rev. 2, titoli ATECO 2007</AlertTitle>
          <AlertDescription>
            <span className="flex flex-col gap-2">
              <span>{data.meta.classification_note} I titoli sono quelli italiani di ATECO 2007.</span>
              <span>
                In questo estratto mancano le sezioni A (agricoltura) e O (pubblica amministrazione).
                La sezione S non ha un totale pubblicato; alcune sue divisioni sì.
                K (finanza e assicurazioni) ha imprese e addetti, mentre i conti di bilancio sono riservati.
                Il totale in alto è l’aggregato ufficiale {data.meta.total_code}, l’economia delle imprese.
              </span>
            </span>
          </AlertDescription>
        </Alert>

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

        <KpiCard sector={focus} year={year} otherYear={otherYear} isTotal={!focusCode} totalCode={data.meta.total_code} />

        {reading.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Come leggere i conti</CardTitle>
              <CardDescription>Due fatti di struttura. Descrivono i conti, non dicono dove investire.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {reading.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Panoramica</CardTitle>
            <CardDescription>L’area segue la metrica scelta. Il colore distingue la sezione e non esprime un giudizio.</CardDescription>
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
              {SIZE_METRICS.map((metric) => (
                <ToggleGroupItem key={metric.id} value={metric.id}>{metric.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Alert>
              <AlertTitle>Il commercio gonfia il fatturato</AlertTitle>
              <AlertDescription>
                Il commercio (G) include la merce rivenduta. Per confrontare il peso dei settori, il valore aggiunto è la misura più stabile.
                {sizeKey === 'NETTUR_MEUR' ? ' Ora l’area è il fatturato: G occupa più spazio di quanto dica il valore creato.' : ''}
              </AlertDescription>
            </Alert>
            <SbsTreemap items={rows} year={year} sizeKey={sizeKey} onOpen={openSector} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tabella {level ? LEVEL_PLURAL[level] : ''}</CardTitle>
            <CardDescription>
              {filtered.length} {level ? (filtered.length === 1 ? LEVEL_LABEL[level] : LEVEL_PLURAL[level]) : 'voci'}
              {normalizedQuery ? ` su ${rows.length}` : ''}.
              {path.length === 0 ? ` Nel ${year} il fatturato di classe è pubblicato per ${turnoverNote.published} classi, riservato per ${turnoverNote.reserved}, assente per ${turnoverNote.absent}.` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup className="max-w-sm">
              <Field>
                <FieldLabel htmlFor="sector-search">Cerca in questo livello</FieldLabel>
                <Input
                  id="sector-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Codice o nome, per esempio alimentari"
                />
              </Field>
            </FieldGroup>
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
                  <EmptyDescription>Nessuna voce di questo livello corrisponde alla ricerca.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card whitespace-normal" aria-sort={ariaSort(sort, 'name')}>
                      <SortButton label="Settore" active={sort.key === 'name'} dir={sort.dir} onClick={() => clickHeader('name')} />
                    </TableHead>
                    {COLUMNS.map((column) => (
                      <TableHead key={column.id} className="text-right" aria-sort={ariaSort(sort, column.id)}>
                        <ColumnHeading column={column} sort={sort} onSort={() => clickHeader(column.id)} />
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
                        data-state={active ? 'selected' : undefined}
                        className="cursor-pointer"
                        onClick={() => (kids ? openSector(sector.code) : setSelected(sector.code))}
                      >
                        <TableHead scope="row" className="sticky left-0 bg-card whitespace-normal">
                          <span className="flex flex-col items-start gap-1">
                            <span className="text-xs text-muted-foreground tabular-nums">{sector.code}</span>
                            <span>{titleIt(sector.name)}</span>
                            {!sector.published && <Badge variant="secondary">totale non pubblicato</Badge>}
                          </span>
                        </TableHead>
                        {COLUMNS.map((column) => (
                          <TableCell key={column.id} className="text-right tabular-nums">
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
              <SectorCard sector={selectedSector} year={year} />
            </CardContent>
          )}
          <CardFooter className="text-sm text-muted-foreground">
            Clic su una riga con figli per scendere. Su una classe, la riga resta ferma e apre la scheda. La tabella scorre in orizzontale. Le celle riservate non valgono zero e restano in fondo quando si ordina.
          </CardFooter>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-medium">Cosa significa ogni voce</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {GLOSSARY.map((item) => (
              <Card key={item.title} size="sm">
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">{item.body}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />
        <footer className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Fonte: Eurostat, Structural Business Statistics, dataset <a className="text-primary underline-offset-4 hover:underline" href={data.meta.source_url}>sbs_ovw_act</a> (Enterprises by detailed NACE Rev. 2 activity), geo Italia, anni {data.meta.years.join(' e ')}. Ultimo aggiornamento del dataset: {data.meta.last_update_label}.
          </p>
          <p>
            {data.meta.producer_note}{' '}
            <a className="text-primary underline-offset-4 hover:underline" href="https://www.istat.it/">ISTAT</a> è il produttore nazionale; Eurostat pubblica l’estratto usato qui.
            Titoli di settore: {data.meta.labels_source}.
          </p>
          <p>
            Aggregato {data.meta.total_code}: {data.meta.total_name}. Definizione Eurostat: {data.meta.total_name_en}.
            La somma delle righe visibili può essere più bassa del totale ufficiale, perché alcune celle sono riservate e perché il totale di S non è pubblicato.
          </p>
          <p>{data.meta.classification_note} Questa mappa descrive la struttura dei conti. Non è un consiglio di investimento.</p>
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

function KpiCard({ sector, year, otherYear, isTotal, totalCode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{isTotal ? 'Italia' : `${sector.code} · ${titleIt(sector.name)}`}</CardTitle>
        <CardDescription>
          {isTotal
            ? `Cifre ufficiali dell’aggregato ${totalCode}. Non sono la somma delle sezioni in tabella. `
            : sector.published
              ? 'Cifre ufficiali di questo codice. Non sono la somma dei figli: se una cella sotto è riservata, i conti non tornano. '
              : 'Il totale di questa sezione non è pubblicato. Sotto ci sono solo le divisioni presenti nell’estratto.'}
          {sector.published ? 'Il badge sotto ogni cifra è la variazione calcolata verso l’altro anno.' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {KPI_IDS.map((id) => {
            const column = columnById(id)
            const cell = displayCell(sector, year, column)
            const variation = kpiVariation(sector, year, column)
            const numeric = cell.kind === 'value' || cell.kind === 'estimated'
            return (
              <Card key={id} size="sm">
                <CardHeader>
                  <CardDescription>{column.label}</CardDescription>
                  <CardTitle>
                    {numeric ? (
                      <span className="tabular-nums">{cell.text}{column.unit === '%' ? '%' : ''}</span>
                    ) : (
                      <CellValue cell={cell} />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-2">
                  {numeric && column.unit !== '%' && <p className="text-muted-foreground">{column.unit}</p>}
                  {cell.kind === 'estimated' && <Badge variant="secondary">stima Eurostat</Badge>}
                  {variation && <Badge variant="outline">nel {otherYear}: {variation}</Badge>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function withUnit(cell, unit) {
  if (cell.kind === 'value' || cell.kind === 'estimated' || cell.kind === 'calculated') {
    return unit === '%' ? `${cell.text}%` : `${cell.text} ${unit}`
  }
  return cell.text
}

function SectorCard({ sector, year }) {
  const turnover = displayCell(sector, year, columnById('NETTUR_MEUR'))
  const valueAdded = displayCell(sector, year, columnById('AV_MEUR'))
  const gor = displayCell(sector, year, columnById('GOR_PC'))
  const firms = displayCell(sector, year, columnById('ENT_NR'))
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{sector.code} · {titleIt(sector.name)}</CardTitle>
        <CardDescription>Classe NACE Rev. 2, equivalente alle prime quattro cifre di ATECO 2007, anno {year}.</CardDescription>
      </CardHeader>
      <CardContent>
        Imprese {firms.text}. Fatturato {withUnit(turnover, 'mln €')}. Valore aggiunto {withUnit(valueAdded, 'mln €')}. GOR {withUnit(gor, '%')}.
        Il GOR è il MOL sul fatturato: descrive la struttura del codice. Non è un utile di bilancio e non è un invito a investire.
      </CardContent>
    </Card>
  )
}

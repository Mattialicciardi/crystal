import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { COLUMNS, GLOSSARY, displayCell, titleIt } from '../sbsModel.js'

const NAME_WIDTH = 280
const DEFAULT_WIDTH = 136

function definitionFor(column) {
  const direct = GLOSSARY.find((item) => item.code === column.id)
  if (direct) return direct.body
  if (column.derived) return GLOSSARY.find((item) => item.code === 'calcolati')?.body || null
  return null
}

function mark(dir) {
  return dir === 'desc' ? '↓' : '↑'
}

export default function SectorTable({ rows, year, sort, onSort, selected, onOpen, childrenOf }) {
  const [widths, setWidths] = useState(() => ({
    name: NAME_WIDTH,
    ...Object.fromEntries(COLUMNS.map((column) => [column.id, DEFAULT_WIDTH])),
  }))
  const [hidden, setHidden] = useState({})
  const visible = COLUMNS.filter((column) => !hidden[column.id])
  const tableWidth = widths.name + visible.reduce((sum, column) => sum + widths[column.id], 0)

  const resize = (key, width) => {
    setWidths((current) => ({ ...current, [key]: Math.max(key === 'name' ? 180 : 88, Math.round(width)) }))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">Colonne</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Indicatori visibili</DropdownMenuLabel>
              {COLUMNS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={!hidden[column.id]}
                  onCheckedChange={(checked) => setHidden((current) => ({ ...current, [column.id]: !checked }))}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Table containerClassName="max-h-[34rem] overflow-auto" className="table-fixed text-sm" style={{ width: tableWidth }}>
        <colgroup>
          <col style={{ width: widths.name }} />
          {visible.map((column) => <col key={column.id} style={{ width: widths[column.id] }} />)}
        </colgroup>
        <TableHeader className="sticky top-0 z-20 bg-card">
          <TableRow className="bg-card hover:bg-card">
            <TableHead className="sticky top-0 left-0 z-30 bg-card whitespace-normal relative" style={{ width: widths.name }} aria-sort={ariaSort(sort, 'name')}>
              <HeaderButton label="Settore" active={sort.key === 'name'} dir={sort.dir} onClick={() => onSort('name')} align="start" />
              <ResizeHandle label="Settore" onResize={(width) => resize('name', width)} />
            </TableHead>
            {visible.map((column) => (
              <TableHead key={column.id} className="relative sticky top-0 bg-card text-right" style={{ width: widths[column.id] }} aria-sort={ariaSort(sort, column.id)}>
                <ColumnHeading column={column} sort={sort} onSort={() => onSort(column.id)} />
                <ResizeHandle label={column.label} onResize={(width) => resize(column.id, width)} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((sector) => {
            const kids = (childrenOf.get(sector.code) || []).length > 0
            return (
              <TableRow
                key={sector.code}
                data-state={selected === sector.code ? 'selected' : undefined}
                className="cursor-pointer bg-card"
                onClick={() => onOpen(sector, kids)}
              >
                <TableHead scope="row" className="sticky left-0 z-10 bg-inherit whitespace-normal py-3 align-top">
                  <span className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground tabular-nums">{sector.code}</span>
                    <span className="leading-snug">{titleIt(sector.name)}</span>
                    {!sector.published && <Badge variant="secondary">totale non pubblicato</Badge>}
                  </span>
                </TableHead>
                {visible.map((column) => (
                  <TableCell key={column.id} className="py-3 text-right align-top tabular-nums">
                    <CellValue cell={displayCell(sector, year, column)} />
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function ariaSort(sort, key) {
  if (sort.key !== key) return 'none'
  return sort.dir === 'asc' ? 'ascending' : 'descending'
}

function HeaderButton({ label, detail, active, dir, onClick, align }) {
  return (
    <button type="button" onClick={onClick} className={align === 'start' ? 'text-left' : 'w-full text-right'}>
      <span className={align === 'start' ? 'flex flex-col items-start gap-0.5' : 'flex w-full flex-col items-end gap-0.5'}>
        <span className="font-medium">{label}{active ? ` ${mark(dir)}` : ''}</span>
        {detail && <span className="text-xs font-normal text-muted-foreground">{detail}</span>}
      </span>
    </button>
  )
}

function ColumnHeading({ column, sort, onSort }) {
  const definition = definitionFor(column)
  const button = (
    <HeaderButton
      label={column.label}
      detail={`${column.unit}${column.derived ? ' · calcolato' : ''}`}
      active={sort.key === column.id}
      dir={sort.dir}
      onClick={onSort}
    />
  )
  if (!definition) return button
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{button}</HoverCardTrigger>
      <HoverCardContent className="w-80" align="end">{definition}</HoverCardContent>
    </HoverCard>
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

function ResizeHandle({ label, onResize }) {
  const start = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const originX = event.clientX
    const header = event.currentTarget.parentElement
    const originWidth = header.getBoundingClientRect().width
    const move = (pointer) => onResize(originWidth + pointer.clientX - originX)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Ridimensiona ${label}`}
      onPointerDown={start}
      className="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none"
    />
  )
}

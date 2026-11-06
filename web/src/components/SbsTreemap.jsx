import { useMemo } from 'react'
import { hierarchy, treemap } from 'd3-hierarchy'
import { SECTION_COLOR, columnById, displayCell, sizeOf, titleIt } from '../sbsModel.js'

const trunc = (value, max) => (value && value.length > max ? `${value.slice(0, max - 1)}…` : value)

export default function SbsTreemap({ items, year, sizeKey, onOpen }) {
  const column = columnById(sizeKey)
  const layout = useMemo(() => {
    const sized = []
    const aside = []
    for (const sector of items) {
      const size = sizeOf(sector, year, sizeKey)
      if (size.state === 'sized') sized.push({ ...sector, sizeValue: size.value })
      else aside.push({ sector, state: size.state, value: size.value })
    }
    if (!sized.length) return { leaves: [], aside }
    const root = hierarchy({ children: sized }).sum((node) => (node.children ? 0 : node.sizeValue)).sort((a, b) => b.value - a.value)
    treemap().size([1000, 460]).paddingInner(3).round(true)(root)
    const leaves = root.leaves().filter((leaf) => leaf.data?.code && leaf.x1 - leaf.x0 > 1 && leaf.y1 - leaf.y0 > 1)
    return { leaves, aside }
  }, [items, year, sizeKey])

  if (!layout.leaves.length) {
    return (
      <div className="treemap-empty">
        <p>Nessun riquadro per {column.label.toLocaleLowerCase('it-IT')} in questo livello.</p>
        <p>Le celle riservate, assenti o non positive restano fuori dalla mappa e si leggono nella tabella.</p>
      </div>
    )
  }

  return (
    <div>
      <svg viewBox="0 0 1000 460" className="treemap" role="img" aria-label={`Mappa dimensionata su ${column.label}`}>
        {layout.leaves.map((leaf) => {
          const sector = leaf.data
          const width = leaf.x1 - leaf.x0
          const height = leaf.y1 - leaf.y0
          const label = titleIt(sector.name)
          const shown = displayCell(sector, year, column)
          return (
            <g
              key={sector.code}
              transform={`translate(${leaf.x0},${leaf.y0})`}
              className="cell"
              onClick={() => onOpen(sector.code)}
            >
              <title>{`${sector.code} · ${label}\n${column.label}: ${shown.text} ${column.unit}`}</title>
              <rect width={width} height={height} fill={SECTION_COLOR[sector.section] || '#4d5d70'} rx="2" />
              {width > 54 && height > 28 && <text x="8" y="18" className="cell-code">{sector.code}</text>}
              {width > 88 && height > 46 && <text x="8" y="36" className="cell-name">{trunc(label, Math.floor(width / 7.2))}</text>}
              {width > 78 && height > 64 && <text x="8" y={height - 10} className="cell-val">{shown.text}</text>}
            </g>
          )
        })}
      </svg>
      {layout.aside.length > 0 && (
        <p className="aside-note">
          Fuori dalla mappa, per {column.label.toLocaleLowerCase('it-IT')}: {summarizeAside(layout.aside)}.
        </p>
      )}
    </div>
  )
}

function summarizeAside(aside) {
  const labels = {
    unavailable: 'riservato o assente',
    unpublished: 'totale non pubblicato',
    negative: 'valore negativo',
    zero: 'valore ufficiale zero',
  }
  const shown = aside.slice(0, 8).map((item) => `${item.sector.code} ${labels[item.state] || item.state}`)
  const rest = aside.length - shown.length
  return rest > 0 ? `${shown.join(' · ')} · e altri ${rest}` : shown.join(' · ')
}

import { useMemo } from 'react'
import { hierarchy, treemap } from 'd3-hierarchy'
import { confidenceColor, sizeValue, fmtMoneyKeur, fmtCount } from '../lib.js'

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s)

// items: array di settori-figli del nodo corrente. Area = sizeKey. Colore = score (confidence|coverage).
export default function Treemap({ items, sizeKey, viewKind, colorMetric, onDrill, W = 1000, H = 460 }) {
  const leaves = useMemo(() => {
    const root = hierarchy({ children: items })
      .sum((d) => (d.children ? 0 : sizeValue(d, sizeKey)))
      .sort((a, b) => (b.value || 0) - (a.value || 0))
    treemap().size([W, H]).paddingInner(2).round(true)(root)
    return root.leaves().filter((l) => l.x1 - l.x0 > 1 && l.y1 - l.y0 > 1)
  }, [items, sizeKey, W, H])

  if (!leaves.length) {
    return <div className="treemap-empty">Nessun valore di {sizeKey} disponibile a questo livello (probabile segreto statistico).</div>
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="treemap" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Treemap settoriale">
      {leaves.map((l) => {
        const s = l.data
        const w = l.x1 - l.x0
        const h = l.y1 - l.y0
        const drillable = s.level !== 'class'
        const fill = confidenceColor(colorMetric === 'coverage' ? s.coverage : s.confidence)
        return (
          <g
            key={s.code}
            data-code={s.code}
            transform={`translate(${l.x0},${l.y0})`}
            className={'cell' + (drillable ? ' drillable' : '')}
            onClick={() => drillable && onDrill(s.code)}
          >
            <title>{`${s.code} · ${s.name}\nCoverage ${s.coverage} · Confidence ${s.confidence}`}</title>
            <rect width={w} height={h} fill={fill} rx="2" />
            {w > 50 && h > 24 && <text x="6" y="16" className="cell-code">{s.code}</text>}
            {w > 96 && h > 40 && <text x="6" y="31" className="cell-name">{trunc(s.name, Math.floor(w / 6.4))}</text>}
            {w > 78 && h > 56 && (
              <text x="6" y={h - 7} className="cell-val">
                {viewKind === 'money' ? fmtMoneyKeur(s.raw[sizeKey]) : fmtCount(s.raw[sizeKey])}
                {colorMetric === 'coverage' ? ` · cov ${Math.round(s.coverage)}` : ` · C${Math.round(s.confidence)}`}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

import { useMemo } from 'react'
import { hierarchy, treemap } from 'd3-hierarchy'
import { growthColor, sizeValue, fmtMoneyKeur, fmtCount, fmtPct } from '../lib.js'

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s)

// items: array di settori-figli del nodo corrente. Area = sizeKey. Colore = crescita (CAGR).
export default function Treemap({ items, sizeKey, viewKind, onDrill, hasChildren, W = 1000, H = 460 }) {
  const leaves = useMemo(() => {
    if (!items || !items.length) return []
    const root = hierarchy({ children: items })
      .sum((d) => (d.children ? 0 : sizeValue(d, sizeKey)))
      .sort((a, b) => (b.value || 0) - (a.value || 0))
    treemap().size([W, H]).paddingInner(2).round(true)(root)
    // Esclude l'eventuale radice sintetica (senza code/raw) quando i figli hanno area nulla.
    return root.leaves().filter((l) => l.data?.code && l.x1 - l.x0 > 1 && l.y1 - l.y0 > 1)
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
        const drillable = hasChildren ? hasChildren(s.code) : s.level !== 'class'
        const cagr = s.fields?.crescita?.value
        const fill = growthColor(cagr)
        return (
          <g
            key={s.code}
            data-code={s.code}
            transform={`translate(${l.x0},${l.y0})`}
            className={'cell' + (drillable ? ' drillable' : '')}
            onClick={() => drillable && onDrill(s.code)}
          >
            <title>{`${s.code} · ${s.name}\nCAGR fatturato: ${fmtPct(cagr)}`}</title>
            <rect width={w} height={h} fill={fill} rx="2" />
            {w > 50 && h > 24 && <text x="6" y="16" className="cell-code">{s.code}</text>}
            {w > 96 && h > 40 && <text x="6" y="31" className="cell-name">{trunc(s.name, Math.floor(w / 6.4))}</text>}
            {w > 78 && h > 56 && (
              <text x="6" y={h - 7} className="cell-val">
                {viewKind === 'money' ? fmtMoneyKeur(s.raw[sizeKey]) : fmtCount(s.raw[sizeKey])}
                {cagr != null ? ` · ${fmtPct(cagr)}` : ''}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

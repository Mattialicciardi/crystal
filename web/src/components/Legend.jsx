import { Fragment } from 'react'
import { METRICS } from '../metrics.js'

// Legenda/Metodo espandibile: elenca definizioni e limiti delle metriche.
export default function Legend({ ids }) {
  return (
    <details className="legend-box">
      <summary>Legenda / Metodo — cosa significano le colonne</summary>
      <dl>
        {ids.map((id) => (
          <Fragment key={id}>
            <dt>{METRICS[id].label}</dt>
            <dd>{METRICS[id].info}</dd>
          </Fragment>
        ))}
      </dl>
    </details>
  )
}

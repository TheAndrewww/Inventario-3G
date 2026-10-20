import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Diseño 3G (todo bajo html[data-diseno="3g"], que desde el 16-oct-2026 va fijo para todos). Ver src/diseno-3g/LEEME.md
import './diseno-3g/diseno-3g.css'
import './diseno-3g/planta-mapa-tailwind.css'
import './diseno-3g/planta-3g.css'
// VIEJO: se borra a partir del 24-oct-2026 — Diseño 3G para TV de la ola 3 (todo bajo html[data-g3-tv], que ya nunca se pone:
// las TV y la terminal llevan el rediseño 2). Ver src/diseno-3g/tvG3.js
import './diseno-3g/planta-tv-mapa.css'
import './diseno-3g/planta-tv-3g.css'
// Rediseño 2 (todo bajo :root[data-diseno="3g"]). Ver src/rediseno2/fundacion/index.js
import './rediseno2/fundacion/r2.css'
import './rediseno2/fundacion/r2-piso.css'
// Vestido (19-oct-2026): color, forma y profundidad como el diseño de antes, sobre la misma estructura. Va al final de los CSS.
import './rediseno2/fundacion/r2-vestido.css'
import './diseno-3g/diseno-3g.js'
// Solo el diseño nuevo (16-oct-2026): justo después del paquete, para que un «actual» guardado no lo apague al cargar
import './diseno-3g/forzarDiseno3G.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Diseño 3G (todo bajo html[data-diseno="3g"]; apagado no cambia nada). Ver src/diseno-3g/LEEME.md
import './diseno-3g/diseno-3g.css'
import './diseno-3g/planta-mapa-tailwind.css'
import './diseno-3g/planta-3g.css'
// Diseño 3G para las pantallas públicas de TV (todo bajo html[data-g3-tv]; solo con ?diseno=3g en esa carga). Ver src/diseno-3g/tvG3.js
import './diseno-3g/planta-tv-mapa.css'
import './diseno-3g/planta-tv-3g.css'
import './diseno-3g/diseno-3g.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

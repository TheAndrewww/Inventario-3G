# Contexto sesión — 3 de febrero 2026

## Commits de esta sesión

| Hash | Descripción |
|------|-------------|
| `9bb3940` | refactor: Unificar Dashboard Producción y vista TV en componentes compartidos |
| `c192850` | fix: Unificar filtro y ordenamiento entre Dashboard y TV de Producción |

Neto de la sesión: **4 archivos, +553 / -1229 líneas**.

---

## Qué se hizo

### 1. Extracción de componentes compartidos

Se sacó código duplicado que existía en paralelo en `DashboardProduccionPage` y `DashboardProduccionTVPage` hacia dos componentes reusables:

**`frontend/src/components/produccion/ProyectoTimeline.jsx`** (nuevo, 482 líneas)
- Componente principal de cada fila de proyecto en el dashboard.
- Exports nombrados: `ETAPAS_CONFIG` (colores/etiquetas por etapa) y `ETAPAS_ORDEN` (array ordenado de etapas).
- Props: `{ proyecto, onCompletar? }`
  - Si `onCompletar` está presente → modo dashboard (muestra strip de sub-etapas, botón avanzar, footer de completado).
  - Si está ausente → modo TV (read-only, sin interacción).
- Contiene el SVG del stepper de línea de tiempo, incluyendo las variantes de timeline simplificado (MTO/GTIA: solo Instalación→Fin) y bifurcación manufactura/herrería.

**`frontend/src/components/produccion/EstadisticasHeader.jsx`** (nuevo, 41 líneas)
- 4 tarjetas de estadísticas: Diseño, Compras, Producción, Instalación.
- Usa colores de `ETAPAS_CONFIG` y el sistema de escalado CSS `var(--escala, 1)` con helpers `s()` y `px()`.

### 2. Refactor de ambas páginas

**`DashboardProduccionTVPage.jsx`**: 682 → 178 líneas
- Eliminó ~500 líneas de componentes duplicados.
- Imports recortados a solo `ZoomIn, ZoomOut, RotateCw`.
- **Bug fix:** Eliminó llamada a `sincronizarConSheets()` que estaba en el `useEffect`. Ese endpoint requiere rol `administrador` y la página TV es pública (`/produccion-tv`) — fallaba silenciosamente cada 60s.
- Eliminó estado `sincronizando` (ya no necesario).

**`DashboardProduccionPage.jsx`**: 1126 → 421 líneas
- Eliminó ~700 líneas de componentes duplicados.
- Eliminó estado muerto `tamano`.
- Imports recortados a `Package, Monitor, ExternalLink, Cloud, Database`.

### 3. Fix de discrepancias (tras auditoría)

El usuario reportó que veía diferencias entre las dos vistas. Se auditaron los 8 archivos relevantes (frontend + backend). El backend confirmó que ambos endpoints (`/dashboard` y `/dashboard-publico`) usan el **mismo controller** — los datos son idénticos. Las discrepancias eran solo de lógica frontend:

**Discrepancia 1 — Filtro (TV):**
- TV solo excluía `completado`. Dashboard excluía `completado` + `pendiente`.
- Fix: agregar `&& p.etapa_actual !== 'pendiente'` al filtro de TV.

**Discrepancia 2 — Ordenamiento (ambas páginas):**
- Dashboard tenía 4 pasos de sort; TV tenía 4 pero distintos. Ninguna tenía los 5 necesarios.
- Sort unificado (mismo en ambas páginas):
  1. En retraso primero (`estadoRetraso.enRetraso`)
  2. Más días de retraso primero (solo si ambos en retraso)
  3. Vencidos primero (`diasRestantes < 0`)
  4. Por prioridad (1=urgente … 5=muy baja)
  5. Tiebreaker: `diasRestantesEtapa` (menor = más urgente). Viene de `getEstadoRetraso()` en el modelo, solo para tipos A/B/C. Fallback: `diasRestantes ?? 999`.

---

## Arquitectura relevante (para la próxima sesión)

### Sistema de escalado CSS (TV)
`DashboardProduccionTVPage` setea `--escala` como custom property en el contenedor raíz. Los componentes compartidos usan:
```js
const s = (val) => `calc(${val}rem * var(--escala, 1))`;
const px = (val) => `calc(${val}px * var(--escala, 1))`;
```
En el dashboard normal `--escala` no existe → defaultea a `1`, sin efecto.

### Prop `onCompletar` como feature gate
`ProyectoTimeline` decide qué renderizar según si recibe el callback:
- Dashboard lo pasa → rende sub-etapas editables + botón avanzar.
- TV no lo pasa → tarjeta read-only.

### Backend: dos rutas, un controller
- `GET /produccion/dashboard` — autenticado, mismo controller.
- `GET /produccion/dashboard-publico` — público, mismo controller.
- `POST /produccion/sincronizar` — requiere rol `administrador`. No debe llamarse desde TV.

### Modelo `ProduccionProyecto`
- `getEstadoRetraso()` — solo activa para tipos A/B/C. Retorna `{ enRetraso, diasRetraso, diasRestantesEtapa }`.
- `tiene_manufactura` / `tiene_herreria` — `allowNull: false, defaultValue: false`. Nunca son null.

---

## Estado actual
- Rama: `main`, todo pushed, build limpio.
- Unificación de Dashboard/TV: **completa**. Filtro, sort y componentes idénticos.
- No hay deuda técnica ni TODOs pendientes de esta sesión.

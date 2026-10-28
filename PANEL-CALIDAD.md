# Panel de calidad (3G Calidad) en Planta

28-oct-2026 · rama `feat/panel-calidad`. La hoja de control de calidad de cada obra (Manufactura y Herrería), su aval
como cierre de producción, el camino de «repintar» y el reporte de salida para quien instala. La tableta de Charly
(app «3G Calidad») habla directo con Planta; Operación lee la hoja por la puerta y le manda las sugerencias de la
llamada de las 16:00.

**Todo viene apagado. Con las banderas apagadas Planta queda igual que hoy** (probado en `backend/tests/calidad-*.test.js`
y con capturas de antes y después).

## Banderas (Railway)

| Variable | Qué hace encendida (`1`) | Apagada (por omisión) |
|---|---|---|
| `PANEL_CALIDAD` | `/api/calidad/*`, «Tabletas de calidad» en Administración, «Calidad» en el detalle de la obra, «Calidad pide corregir» en la terminal de Manufactura y Herrería, `calidad` en las obras de la puerta y `POST /api/sistemas/v1/calidad/sugerencias`. Reintentos del reporte a Drive cada 10 min. | `/api/calidad/*` responde 404, la puerta no trae `calidad` y las sugerencias responden 404. Las tablas `calidad_*` se crean al arrancar pero nada las escribe. |
| `CALIDAD_AVAL_CIERRA` (pide `PANEL_CALIDAD`) | La obra ya no pasa sola a «Preparado» al terminar Manufactura y Herrería: se queda en producción («Espera calidad») y la pasa el aval, con la lógica del «Preparado» manual y el mismo aviso «Proyecto completado». El «Preparado» manual de la oficina sigue y queda en la bitácora. La terminal sin sesión ya no puede cerrar la producción de una obra que espera el aval. La sincronización del Excel no la promueve. | El cierre automático de hoy no cambia; la hoja es informativa. |
| `CALIDAD_DEFECTO_REABRE` (pide `PANEL_CALIDAD`) | Un defecto que NO sale así reabre la subetapa de su hoja: MANUFACTURA → manufactura; HERRERIA H7–H11 (pintura) → pintura y herrería; otro H → herrería (soldadura). Si la obra ya estaba en Preparado la regresa con `regresarEtapa` y deja la otra área como estaba. Una obra cerrada en el Índice no se toca. | El defecto solo se anota. |

Las tres salen en `banderasPlanta()` (y por eso en `/salud` con sesión de administración y en `/api/inicio3g/v1/salud`).

Otras variables (opcionales): `CALIDAD_APP_VERSION_URL` (https) o `CALIDAD_APP_VERSION_ARCHIVO` (ruta a un JSON) para
`GET /api/calidad/app/version.json`, con el que la app se actualiza sola. Sin ellas responde 404.

## Orden para encenderlo

1. Publicar la rama (crea las tablas al arrancar; todo sigue apagado).
2. `PANEL_CALIDAD=1`. Administración › Tabletas de calidad › «Generar código» y vincular la tableta de Charly (código de
   8 caracteres o su QR; dura 15 minutos y sirve una vez).
3. Pareja #20 (Operación → Planta): **agregar** `calidad.sugerir` a `ALCANCES_OPERACION`, sin quitar nada:
   `ALCANCES_OPERACION=almacen.solicitar,produccion.leer,calidad.sugerir`.
4. Cuando Charly ya use la hoja: `CALIDAD_DEFECTO_REABRE=1` y después `CALIDAD_AVAL_CIERRA=1`.

## Tablas (cada una con su `sync()` en `server.js`; nunca `alter`)

`calidad_hojas` (una por obra: `proyecto_id`, `obra_id`, nombre y nombre normalizado, atributos, estado, aval y estado
del reporte en Drive) · `calidad_puntos` (único por hoja y punto; `cambio_id` único) · `calidad_eventos` (bitácora;
`cambio_id` único) · `calidad_sugerencias` · `calidad_dispositivos` y `calidad_codigos` (solo huellas SHA-256).

El `id` de `produccion_proyectos` cambia si se mueven renglones del Excel; la hoja se busca por ID 3G, luego por
`proyecto_id` con el mismo nombre y, si el renglón se movió, se vuelve a ligar por nombre exacto (sin acentos) y se
anota en la bitácora.

## Checklist

`backend/src/config/checklistCalidad.json` es la copia exacta del real del 16-oct más `"version"`. El evaluador de
`aplica_si` (`services/checklistCalidad.js`) no usa `eval` ni `Function`: entiende `siempre`, atributos, `||`, `&&`,
`atributo == 'texto'` y paréntesis; lo que no entiende hace que el punto aplique y lo avisa una vez en el registro. Los
casos compartidos con la app están en `backend/tests/casos-aplica-si.json`.

## API `/api/calidad` (todo 404 sin `PANEL_CALIDAD`)

Entra la tableta con `Authorization: Bearer cal_…` (el token que recibió al vincularse) o la web con la sesión de Planta
(rol `administrador` o `almacen`). Errores `{ error }` en español.

| Ruta | Para qué |
|---|---|
| `POST /vincular` `{ codigo, nombreDispositivo }` | → `{ token, dispositivo }` (sin sesión; 10 intentos equivocados cada 15 min por IP) |
| `GET /app/version.json` | versión de la app (sin sesión) |
| `GET /yo`, `GET /config` | quién llama, banderas `{ avalCierra, defectoReabre }`; el checklist y su versión |
| `GET /obras?vista=taller\|listas\|avaladas` | obras en producción (regla de `/en-curso`) y las ya en Preparado sin instalar; avaladas de los últimos 30 días |
| `GET /obras/:obra` | la hoja completa (`:obra` = proyectoId o ID 3G) |
| `PUT /obras/:obra/atributos` · `PUT /obras/:obra/puntos/:punto` | con `cambioId` (el mismo dos veces responde igual sin repetir) y `cuando` (uno viejo no pisa a uno nuevo) |
| `POST /obras/:obra/avalar` · `POST /obras/:obra/reabrir` | aval (hoja lista; Charly por omisión) y reabrir (con motivo; no descierra la obra) |
| `GET /obras/:obra/reporte.pdf` | el reporte (vista previa si no está avalada) |
| `POST /sugerencias/:id/aplicar` · `/descartar` | lo que dijo la llamada de las 16:00 |
| `POST /codigos` · `GET /dispositivos` · `POST /dispositivos/:id/revocar` | solo administración |

Las escrituras pueden traer `proyecto` (el nombre que la tableta tiene guardado): si el renglón se movió responde 409
`OBRA_CAMBIO` en vez de escribir en otra obra.

## Reporte de salida

PDF interno (Charly, supervisor e instalador; el cliente no lo recibe) armado con jsPDF, sin teléfonos, correos,
direcciones ni montos. Al avalar se sube a la carpeta de Drive del proyecto con lo mismo que el ticket de salida
(`carpetaDelProyecto`, `uploadTicket`, reintentos con espera creciente hasta 7 días). Nombre:
`CALIDAD - <ID 3G o proyecto> - <AAAA-MM-DD>.pdf`; el barrido de Drive lo ignora (no es plano ni ticket ni archivo nuevo).
Sin WhatsApp: llega a los supervisores por Operación y por Drive. En la agenda es `pla-calidad-reporte` (solo aparece con
`PANEL_CALIDAD`).

## Puerta entre sistemas

- Con `PANEL_CALIDAD`, cada obra de `/cerradas`, `/estado` y `/en-curso` trae `calidad: { estado, avaladaEn, avaladaPor,
  faltanAtributos, pendientes, defectos, observacionesInstalacion }` (o `null` si no se pudo leer). Apagada el campo no
  va: la respuesta es exactamente la de hoy.
- `POST /api/sistemas/v1/calidad/sugerencias` (alcance `calidad.sugerir`, `Idempotency-Key`):
  `{ fecha, llamadaId, sugerencias: [{ obraId | folio, punto, estado, nota, saleAsi, discrepancia }] }`. Cada una queda
  `pendiente` en la hoja de su obra (ID 3G o nombre exacto) o `sin_obra`; un punto que no existe se guarda con
  `punto_id` null y la nota completa. La misma `llamadaId` no se duplica.

## Pruebas

`cd backend && npm test` (sin base). La de integración, solo contra un Postgres local de prueba:
`PRUEBA_PG_URL=postgres://<usuario>:<contraseña>@127.0.0.1:<puerto>/<base de prueba> node --test tests/calidad-pg.test.js`.

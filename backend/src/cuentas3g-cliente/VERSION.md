# cuentas3g-cliente

- **Versión:** 1.1.2 (la primera línea de `cuentas3g-cliente.cjs` lo dice).
- **Qué es:** lo que cada sistema de 3G necesita para entrar con Cuentas 3G (CTA-08, PLAN-FINAL §6.1 y §8).
  Se escribió y se probó **una sola vez** aquí, en Cuentas 3G, y se **copia sin cambios** a cada sistema
  (como el paquete Diseño 3G): Planta, Operación, Finanzas, Ventas, el sitio y el Inicio.
- **Archivos y huella (sha256):**
  - `cuentas3g-cliente.cjs` — `972ce8d1517aa80ca31158ef37288924758a5d6544b077851d1807e5af94e9e5`
  - `cuentas3g-cliente.d.cts` — `4636230029eaf88249d973ed99348e3f7a081c509cb59893e26191e8c5e8258b`
- `test/cliente.test.ts` de Cuentas 3G revisa que las huellas sigan siendo estas. En cada sistema, copia la
  carpeta completa (con este archivo) y no la edites: si algo falta, se cambia aquí, sube la versión y se
  vuelve a copiar a todos.

## Dónde va en cada sistema

| Sistema | Carpeta | Cómo se importa |
|---|---|---|
| Planta (backend, ESM) | `backend/src/cuentas3g-cliente/` | `import c3g from './cuentas3g-cliente/cuentas3g-cliente.cjs'` |
| Operación (TS → CommonJS) | `src/cuentas3g-cliente/` | `import * as c3g from './cuentas3g-cliente/cuentas3g-cliente.cjs'` |
| Finanzas (ESM) | `src/cuentas3g-cliente/` | `import c3g from './cuentas3g-cliente/cuentas3g-cliente.cjs'` |
| Ventas (Next.js, servidor) | `frontend/src/cuentas3g-cliente/` | `import * as c3g from '@/cuentas3g-cliente/cuentas3g-cliente.cjs'` (no en el middleware de Edge) |
| Sitio (CommonJS) | `backend/src/cuentas3g-cliente/` | `const c3g = require('./cuentas3g-cliente/cuentas3g-cliente.cjs')` |
| Inicio (funciones de Vercel) | `api/_cuentas3g-cliente/` | `import c3g from './_cuentas3g-cliente/cuentas3g-cliente.cjs'` |

Sin dependencias: usa Web Crypto y `fetch` de Node 18 o más. `.cjs` funciona con `require` y con `import`
(probado con TypeScript en CommonJS, NodeNext y bundler); los tipos van en `.d.cts`.

## Uso

```js
const cfg = c3g.leerConfig(process.env);           // CUENTAS3G_MODO, _EMISOR, _CLIENTE_ID, _CLIENTE_SECRETO, _REGRESO, _EMERGENCIA
if (cfg.aviso) registro.warn(cfg.aviso);            // configuración incompleta = se queda en «apagado» (nunca se abre)
if (cfg.modo !== 'apagado') {
  const cliente = c3g.crearCliente({ ...cfg.cliente, niveles: ['panel', 'oficina', 'lectura'],
                                     almacen: c3g.almacenEnDisco('data/cuentas3g-lista.json') });
  await cliente.arrancar();                         // la última lista guardada + la lista cada 60 s

  // GET /entrar/cuentas3g
  const { url, temporal } = await cliente.iniciar({ despues: req.query.despues });
  res.cookie('__Host-…_c3g', await c3g.sellar(temporal, SECRETO_DE_SESION, 600), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600_000 });
  res.redirect(303, url);

  // GET /entrar/regreso
  const temporal = await c3g.abrir(req.cookies['__Host-…_c3g'], SECRETO_DE_SESION);   // y borrar la cookie
  const p = await cliente.regreso({ url: req.originalUrl, temporal });               // lanza ErrorCuentas3G (con .codigo) si algo no cuadra
  // crear la sesión de SIEMPRE del sistema guardando { sub: p.sub, ver: p.ver, en: p.en, nivel: p.nivel, nombre: p.nombre }
  res.redirect(303, p.despues);

  // en cada petición con sesión de cuenta 3G
  if (!cliente.sesionVigente({ sub, ver, en })) { /* cerrar la sesión y mandar a «Entrar» */ }

  // POST /cuentas3g/aviso  (formulario con logout_token)
  const { sub } = await cliente.avisoDeBaja(req.body.logout_token);   // 200 si salió bien, 400 si lanzó
  // aquí el sistema revoca lo que es de esa persona (enlaces del asesor, supervisor:<clave>, asistentes)

  // GET /salud: cliente.estado() → { lista: { origen, en, personas }, listaVieja, ultimoError, catalogo } (sin datos de personas)
}

// Finanzas, Operación y Planta: el catálogo de personas y códigos (C5), con copia en disco (CTA-09, desde 1.1.0).
// Basta la configuración completa (cfg.cliente), aunque la entrada siga en «apagado». El cliente se crea UNA vez
// (al arrancar) y se reúsa: a lo más una consulta cada 10 min y, si Cuentas 3G falla, un intento por minuto (1.1.1).
const catalogo = cfg.cliente
  ? c3g.crearCliente({ ...cfg.cliente, almacenPersonas: c3g.almacenEnDisco('data/cuentas3g-personas.json') })
  : null;
// … cuando se necesite:
const cat = catalogo ? await catalogo.personas() : null;
const telefonos = cat ? deCatalogo(cat.personas) : TELEFONOS_DE_HOY;   // sin Cuentas 3G y sin copia: lo de hoy
```

- **Planta (SPA):** la SPA arma la ida con lo público (`leerConfig(import.meta.env, { prefijo: 'VITE_CUENTAS3G_', necesita: ['EMISOR', 'CLIENTE_ID'] })`
  le dice si está encendido) y guarda `state`, `nonce` y `verificador` en `sessionStorage`; el servidor canjea con
  `cliente.regreso({ codigo, temporal: { nonce, verificador } })` (sin `state`: lo compara la SPA) y `sinNivel: true`
  (en la fase 1 manda su tabla `usuarios`; empata por `p.correo` o `p.correoEnSistema`).
- **Ventas:** Auth.js hace la ida y el regreso con su proveedor OpenID; el paquete se usa para la lista
  (`sesionVigente`) y el aviso.

## Contrato con Cuentas 3G (no cambia sin subir la versión)

| Qué | Dónde |
|---|---|
| Entrada | `GET <EMISOR>/autorizar` con `client_id`, `redirect_uri` exacta, `response_type=code`, `scope=openid`, `state`, `nonce`, PKCE S256 |
| Canje | `POST <EMISOR>/token` con `Authorization: Basic <sistema>:<secreto>` y `code_verifier` |
| Llaves | `GET <EMISOR>/jwks` (ES256 con `kid`; 10 min en memoria; con un `kid` desconocido se piden otra vez, a lo más una vez por minuto) |
| Ficha | ES256, 5 min, `iss` = emisor, `aud` = el sistema, `nonce`, `jti` (se recuerda 10 min: una ficha repetida se rechaza), `sub`, `ver`, `nivel`, `codigos`, `roles`, `name`, `email`, `correo_en_sistema` |
| Lista de versiones | `GET <EMISOR>/v1/estado-personas` con el mismo Basic → JWS `typ: estado-personas+jwt` con `{personas: [{sub, ver, activo}]}` |
| Aviso de baja | `POST <dirección de aviso>` con `logout_token` (JWS `typ: logout+jwt`, el evento de back-channel logout y sin `nonce`) |
| Catálogo de personas (1.1.0) | `GET <EMISOR>/v1/personas` con el mismo Basic → JWS `typ: personas+jwt`. Finanzas y Operación: `{sub, nombre, papeles, telefono, activo, codigos: [{codigo, tipo, desde, hasta}]}`; Planta: `{sub, correoEnPlanta}`; los demás: 403 |

**Reglas de `sesionVigente`:** se corta si llegó un aviso de baja **después** de crear la sesión (no para siempre:
quien vuelve a entrar después, entra), si la lista dice que no está activa o si su versión subió. A quien se dio de alta
**después** de la última lista no se le corta por no venir en ella. Sin lista (Cuentas 3G nunca respondió) la sesión
sigue y `estado().listaVieja` lo dice; con la lista sin actualizar 24 h, igual: el sistema sigue y avisa a Dirección.
La última lista buena se guarda **con su firma** y se vuelve a revisar al arrancar; una cambiada a mano no se usa.

## Historial

- **1.0.0** (14 de octubre de 2026, ronda 3, CTA-08): primera versión.
- **1.1.0** (14 de octubre de 2026, ronda 3, CTA-09): `personas()` (el catálogo de personas y códigos con copia en disco) y `estado().catalogo`. Lo de 1.0.0 no cambia.
- **1.1.1** (14 de octubre de 2026, verificación de la ronda 3): `personas()` ya no vuelve a esperar a Cuentas 3G en cada llamada cuando falla: un intento por minuto como mucho (salvo `forzar`); mientras, devuelve la copia o `null`. Los tipos (`.d.cts`) y todo lo demás no cambian. Quien copió la 1.1.0 (sitio, Planta) la cambia por esta al conectar el catálogo; hasta entonces no usa `personas()`.
- **1.1.2** (14 de octubre de 2026, ajustes del cierre de la ronda 4): tres arreglos, sin cambiar la forma de nada (los tipos `.d.cts` son los mismos):
  - el reloj del paquete (`arrancar()` sin `sinReloj`) pide la lista con `forzar` en cada tic: la 1.1.1 daba por fresca la lista de hace casi 60 s y en la práctica la pedía cada 120 s (ronda 3, §3.3 punto 4);
  - la lista y el catálogo llevan la hora en que se **pidieron** (`estado().lista.en`, `estado().catalogo.en`), no la de cuando llegaron: una lista pedida justo antes de un aviso de baja que llega después de él ya no cuenta como «pedida después del aviso» (la carrera que anotó Operación en la ronda 4). Por lo mismo, a quien entró mientras la lista venía en camino no se le corta por no venir en ella;
  - `listaDeVersiones({ forzar: true })` y `personas({ forzar: true })` quieren algo pedido **desde ahora**: si hay una petición en camino (pedida antes), ya no se quedan con ella; se pide otra en cuanto llegue (una sola para todos los que forzaron mientras). Así, la lista que pide el aviso de baja siempre es posterior al aviso.
  - Se copia a los 5 que usan el paquete (Planta, Operación, Finanzas, el sitio y el Inicio) sin cambios.
  - El aviso de baja sigue igual: un `logout_token` repetido (mismo `jti`) se rechaza. Cuentas 3G ahora reintenta el aviso con **el mismo** token, así que un sistema que ya lo tomó no lo hace dos veces.

// Solo el diseño nuevo (decisión del dueño, 16-oct-2026): todos ven el rediseño 2, sin interruptor ni camino de regreso,
// y sin escribir nada en el navegador (si hubiera que regresar, cada quien ve lo que veía).
// Correr: `npm test` (o `node --test test/*.test.mjs`) desde frontend/. No usa red ni navegador.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');
const html = leer('index.html');

// Todos los .js/.jsx de src, salvo el paquete copiado tal cual
function archivosSrc(dir = join(RAIZ, 'src')) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivosSrc(p);
    return /\.(js|jsx)$/.test(n) && !p.endsWith(join('diseno-3g', 'diseno-3g.js')) ? [p] : [];
  });
}

// Un almacén de navegador falso que anota cada escritura
function almacenFalso(inicial = {}, { roto = false } = {}) {
  const datos = new Map(Object.entries(inicial));
  const escrituras = [];
  const falla = () => { throw new Error('sin almacenamiento'); };
  return {
    datos, escrituras,
    getItem: (k) => (roto ? falla() : (datos.has(k) ? datos.get(k) : null)),
    setItem: (k, v) => { if (roto) falla(); escrituras.push(['set', k, String(v)]); datos.set(k, String(v)); },
    removeItem: (k) => { if (roto) falla(); escrituras.push(['remove', k]); datos.delete(k); },
  };
}

// Corre el guion de <head> de index.html (el que pone data-diseno) con una dirección y un almacén dados
function correrGuion(guion, { url = 'https://planta.test/inventario', guardado = {}, roto = false } = {}) {
  const atributos = new Map();
  const reemplazos = [];
  const estado = { usr: null, key: 'k1', idx: 3 };
  const almacen = almacenFalso(guardado, { roto });
  const loc = new URL(url);
  const contexto = {
    URL, URLSearchParams,
    location: { href: loc.href, pathname: loc.pathname, search: loc.search, hash: loc.hash },
    history: { state: estado, replaceState: (s, t, u) => reemplazos.push({ s, u }) },
    localStorage: almacen,
    document: {
      documentElement: {
        setAttribute: (k, v) => atributos.set(k, String(v)),
        removeAttribute: (k) => atributos.delete(k),
        getAttribute: (k) => (atributos.has(k) ? atributos.get(k) : null),
        hasAttribute: (k) => atributos.has(k),
      },
    },
  };
  contexto.window = contexto;
  vm.runInNewContext(guion, contexto);
  return { atributos, reemplazos, almacen, estado, contexto };
}

const guiones = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const guionDiseno = guiones.find((g) => g.includes("'diseno-3g'"));
const guionPiso = guiones.find((g) => g.includes('G3_TEMA_PISO'));

describe('index.html: siempre el diseño nuevo', () => {
  it('<html> trae data-diseno="3g" fijo', () => {
    assert.match(html, /<html lang="es" data-diseno="3g">/);
  });

  it('ya no hay rutas sin diseño (TV, terminal, anuncios y calendario público lo llevan)', () => {
    assert.doesNotMatch(html, /G3_RUTAS_SIN_DISENO\s*=/);
    assert.ok(guionDiseno, 'falta el guion de <head> del diseño');
    for (const ruta of ['/produccion-tv', '/preparados-tv', '/manufactura-tv', '/herreria-tv', '/terminal', '/terminal/manufactura', '/anuncios', '/calendario-publico', '/login', '/inventario']) {
      const { atributos } = correrGuion(guionDiseno, { url: `https://planta.test${ruta}` });
      assert.equal(atributos.get('data-diseno'), '3g', ruta);
    }
  });

  it('enciende con «actual» guardado o en la dirección, y no escribe nada en el navegador', () => {
    const casos = [
      { url: 'https://planta.test/inventario' },
      { url: 'https://planta.test/inventario?diseno=actual' },
      { url: 'https://planta.test/inventario?diseno=3g' },
      { url: 'https://planta.test/inventario', guardado: { 'diseno-3g': 'actual' } },
      { url: 'https://planta.test/inventario?diseno=actual', guardado: { 'diseno-3g': 'actual' } },
      { url: 'https://planta.test/inventario', guardado: { 'diseno-3g': '3g' } },
    ];
    for (const caso of casos) {
      const { atributos, almacen } = correrGuion(guionDiseno, caso);
      assert.equal(atributos.get('data-diseno'), '3g', JSON.stringify(caso));
      assert.deepEqual(almacen.escrituras, [], `no debe escribir: ${JSON.stringify(caso)}`);
      assert.equal(almacen.datos.get('diseno-3g') ?? null, caso.guardado?.['diseno-3g'] ?? null);
    }
  });

  it('quita ?diseno de la dirección antes de que cargue el paquete, sin tocar history.state ni lo demás', () => {
    const { reemplazos, estado } = correrGuion(guionDiseno, { url: 'https://planta.test/terminal/manufactura?diseno=actual&tema=oscuro#x' });
    assert.equal(reemplazos.length, 1);
    assert.equal(reemplazos[0].s, estado);
    assert.equal(reemplazos[0].u, '/terminal/manufactura?tema=oscuro#x');
    const sin = correrGuion(guionDiseno, { url: 'https://planta.test/pedido?ticket=7' });
    assert.equal(sin.reemplazos.length, 0, 'sin ?diseno no cambia la dirección');
  });

  it('respeta el tema guardado y funciona sin almacenamiento', () => {
    for (const t of ['claro', 'oscuro', 'auto']) {
      const { atributos } = correrGuion(guionDiseno, { guardado: { 'diseno-3g-tema': t } });
      assert.equal(atributos.get('data-g3-tema'), t);
    }
    assert.equal(correrGuion(guionDiseno, { guardado: { 'diseno-3g-tema': 'rosa' } }).atributos.has('data-g3-tema'), false);
    const roto = correrGuion(guionDiseno, { url: 'https://planta.test/anuncios?diseno=actual', roto: true });
    assert.equal(roto.atributos.get('data-diseno'), '3g');
  });

  it('las TV y la terminal siguen tomando ?tema=claro|oscuro de esa carga', () => {
    assert.ok(guionPiso, 'falta el guion de las pantallas de piso');
    const { contexto, atributos } = correrGuion(guionDiseno, { url: 'https://planta.test/produccion-tv?diseno=3g&tema=oscuro' });
    assert.equal(atributos.get('data-diseno'), '3g');
    // El guion de piso corre después, con la dirección ya limpia de ?diseno
    contexto.location.search = '?tema=oscuro';
    vm.runInNewContext(guionPiso, contexto);
    assert.equal(contexto.G3_TEMA_PISO, 'oscuro');
  });
});

describe('forzarDiseno3G: vuelve a poner el atributo sin cambiar lo guardado', () => {
  let forzarDiseno3G;
  const atributos = new Map();
  const g = globalThis;
  const antes = { document: g.document, window: g.window };
  let almacen;
  let encendidos = 0;
  before(async () => {
    almacen = almacenFalso();
    g.document = {
      documentElement: {
        setAttribute: (k, v) => atributos.set(k, String(v)),
        removeAttribute: (k) => atributos.delete(k),
        getAttribute: (k) => (atributos.has(k) ? atributos.get(k) : null),
      },
    };
    // G3.encender del paquete: guarda «3g», pone el atributo (y el tema y la letra)
    g.window = { localStorage: almacen, G3: { encender: () => { encendidos += 1; almacen.setItem('diseno-3g', '3g'); atributos.set('data-diseno', '3g'); } } };
    ({ forzarDiseno3G } = await import(pathToFileURL(join(RAIZ, 'src/diseno-3g/forzarDiseno3G.js')).href));
  });
  after(() => { g.document = antes.document; g.window = antes.window; });

  it('al cargar el archivo ya lo deja encendido', () => {
    assert.equal(atributos.get('data-diseno'), '3g');
  });

  it('con el atributo puesto no hace nada', () => {
    const n = encendidos;
    forzarDiseno3G();
    assert.equal(encendidos, n);
  });

  it('si el paquete lo quitó por un «actual» guardado, lo regresa y deja «actual» guardado', () => {
    almacen.datos.set('diseno-3g', 'actual');
    atributos.delete('data-diseno');
    forzarDiseno3G();
    assert.equal(atributos.get('data-diseno'), '3g');
    assert.equal(almacen.datos.get('diseno-3g'), 'actual');
  });

  it('sin nada guardado, no deja «3g» guardado', () => {
    almacen.datos.delete('diseno-3g');
    atributos.delete('data-diseno');
    forzarDiseno3G();
    assert.equal(atributos.get('data-diseno'), '3g');
    assert.equal(almacen.datos.has('diseno-3g'), false);
  });
});

describe('React: el diseño nuevo siempre está encendido', () => {
  it('useDiseno3G() da true (el de siempre y el del rediseño 2), y leerDiseno3G() también', async () => {
    const viejo = await import(pathToFileURL(join(RAIZ, 'src/diseno-3g/useDiseno3G.js')).href);
    const r2 = await import(pathToFileURL(join(RAIZ, 'src/rediseno2/fundacion/useDiseno3G.js')).href);
    assert.equal(viejo.useDiseno3G(), true);
    assert.equal(r2.useDiseno3G(), true);
    assert.equal(r2.leerDiseno3G(), true);
  });

  it('RutaDiseno3G ya no llama G3.aplicar() (que apagaba con «actual» guardado): llama forzarDiseno3G()', () => {
    const ruta = leer('src/diseno-3g/RutaDiseno3G.jsx').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(ruta, /G3\??\.aplicar\(/);
    assert.match(ruta, /forzarDiseno3G\(\)/);
    const main = leer('src/main.jsx');
    assert.ok(main.indexOf("import './diseno-3g/forzarDiseno3G.js'") > main.indexOf("import './diseno-3g/diseno-3g.js'"),
      'forzarDiseno3G.js se importa justo después del paquete');
    assert.ok(main.indexOf("import './diseno-3g/forzarDiseno3G.js'") < main.indexOf("import App from './App.jsx'"));
  });
});

describe('sin interruptor ni camino de regreso', () => {
  const fuentes = archivosSrc().map((p) => ({ p, s: readFileSync(p, 'utf8') }));

  it('el selector de apps siempre va sin el interruptor «Diseño 3G»', () => {
    const llamadas = fuentes.flatMap(({ p, s }) => [...s.matchAll(/selectorApps\(([^)]*)\)/g)].map((m) => ({ p, args: m[1] })));
    assert.ok(llamadas.length > 0);
    for (const { p, args } of llamadas) assert.match(args, /interruptor:\s*false/, p);
  });

  it('nadie monta el interruptor ni apaga el diseño', () => {
    for (const { p, s } of fuentes) {
      assert.doesNotMatch(s, /G3\??\.(interruptor|apagar|alternar)\(/, p);
      assert.doesNotMatch(s, /\?diseno=actual/, p);
    }
  });

  it('nadie escribe la preferencia del diseño en el navegador', () => {
    for (const { p, s } of fuentes) {
      assert.doesNotMatch(s, /setItem\(\s*['"]diseno-3g['"]/, p);
    }
  });
});

describe('riel nuevo: hereda los paneles ocultos y el orden del menú de siempre (20f89a9)', () => {
  it('el armazón llama heredarAjustesDelMenu al leer los ocultos y al cambiar de usuario, como el marco anterior', () => {
    const armazon = leer('src/rediseno2/fundacion/armazon/Armazon.jsx');
    const llamadas = armazon.match(/heredarAjustesDelMenu\(user\?\.id\)/g) || [];
    assert.equal(llamadas.length, 2);
    assert.match(armazon, /useState\(\(\) => \{ heredarAjustesDelMenu\(user\?\.id\); return new Set\(leerJSON\(claveOcultosG3/);
    assert.match(armazon, /useEffect\(\(\) => \{ heredarAjustesDelMenu\(user\?\.id\);/);
  });

  it('el ojo de «Personalizar menú» destapa completas Compras y Tickets aunque la herencia las dejara ocultas por sus rutas', () => {
    // Diseñador (solo ve Orden de salida e Historial) o Almacén (solo Tickets pendientes) con esas pantallas ocultas en el menú
    // de siempre: la herencia guarda las rutas y Tickets se ve oculta; «Mostrar» tiene que borrar la clave y esas rutas.
    const armazon = leer('src/rediseno2/fundacion/armazon/Armazon.jsx');
    assert.match(armazon, /\(clave === 'compras' \|\| clave === 'tickets'\) && grupos\.flatMap/);
    assert.match(armazon, /if \(seccion && seccion\.oculto\) \{ n\.delete\(clave\); seccion\.rutas\.forEach\(\(r\) => n\.delete\(r\)\); \}/);
  });
});

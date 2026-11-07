// Sofía (7-nov-2026): la ventana flotante en Planta. Sin VITE_SOFIA_FLOTANTE_URL nada cambia; con ella, el guion de Sofía
// se pide solo en los aparatos de Isa y solo en pantallas internas. Correr: `npm test` desde frontend/ (sin red ni navegador).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  origenSofia, marcaDeLaDireccion, aparatoDeIsa, rutaSinSofia, ponerSofia, CLAVE_VISIBLE, ID_GUION, EXCLUIR_PLANTA,
} from '../src/sofia/ventanaSofia.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');

function almacenFalso(inicial = {}, { roto = false } = {}) {
  const datos = new Map(Object.entries(inicial));
  const falla = () => { throw new Error('sin almacenamiento'); };
  return {
    datos,
    getItem: (k) => { if (roto) falla(); return datos.has(k) ? datos.get(k) : null; },
    setItem: (k, v) => { if (roto) falla(); datos.set(k, String(v)); },
    removeItem: (k) => { if (roto) falla(); datos.delete(k); },
  };
}

function documentoFalso() {
  const puestos = [];
  const porId = new Map();
  const nodo = () => ({ appendChild: (el) => { puestos.push(el); if (el.id) porId.set(el.id, el); } });
  return {
    puestos,
    body: nodo(),
    getElementById: (id) => porId.get(id) || null,
    createElement: (tag) => {
      const atributos = {};
      return { tag, atributos, setAttribute: (k, v) => { atributos[k] = String(v); } };
    },
  };
}

describe('origenSofia (VITE_SOFIA_FLOTANTE_URL)', () => {
  it('vacía, ausente o mal escrita = sin Sofía (Planta como hoy)', () => {
    for (const v of [undefined, null, '', '   ', 'sofia', 'ftp://sofia.ejemplo.test', 'http://sofia.ejemplo.test',
      'https://usuario:clave@sofia.ejemplo.test', 'https://sofia.ejemplo.test/?x=1', 'https://sofia.ejemplo.test/#a']) {
      assert.equal(origenSofia(v), null, String(v));
    }
  });
  it('https, con o sin diagonal final o /flotante.js; http solo en la misma máquina', () => {
    assert.deepEqual(origenSofia('https://sofia.ejemplo.test/'), { origen: 'https://sofia.ejemplo.test', base: 'https://sofia.ejemplo.test', guion: 'https://sofia.ejemplo.test/flotante.js' });
    assert.equal(origenSofia(' https://sofia.ejemplo.test/flotante.js ').guion, 'https://sofia.ejemplo.test/flotante.js');
    assert.equal(origenSofia('http://127.0.0.1:3311').guion, 'http://127.0.0.1:3311/flotante.js');
    assert.equal(origenSofia('http://localhost:3311/').origen, 'http://localhost:3311');
  });
});

describe('la marca del aparato (sofia3g.visible, la misma de flotante.js)', () => {
  it('#sofia y ?sofia=1 marcan; #sofia-no y ?sofia=0 desmarcan; lo demás no toca nada', () => {
    assert.equal(marcaDeLaDireccion({ hash: '#sofia', search: '' }), true);
    assert.equal(marcaDeLaDireccion({ hash: '', search: '?tab=1&sofia=1' }), true);
    assert.equal(marcaDeLaDireccion({ hash: '#sofia-no', search: '' }), false);
    assert.equal(marcaDeLaDireccion({ hash: '', search: '?sofia=0' }), false);
    assert.equal(marcaDeLaDireccion({ hash: '#sofiax', search: '?sofia=2' }), null);
    assert.equal(marcaDeLaDireccion(undefined), null);
  });
  it('marca, recuerda y desmarca', () => {
    const a = almacenFalso();
    assert.equal(aparatoDeIsa({ hash: '', search: '' }, a), false);
    assert.equal(a.datos.size, 0, 'sin la marca en la dirección no se escribe nada');
    assert.equal(aparatoDeIsa({ hash: '#sofia', search: '' }, a), true);
    assert.equal(a.datos.get(CLAVE_VISIBLE), '1');
    assert.equal(aparatoDeIsa({ hash: '', search: '' }, a), true, 'la siguiente vez ya no hace falta #sofia');
    assert.equal(aparatoDeIsa({ hash: '#sofia-no', search: '' }, a), false);
    assert.equal(a.datos.has(CLAVE_VISIBLE), false);
  });
  it('sin almacenamiento no truena: solo cuenta la dirección de esta carga', () => {
    const roto = almacenFalso({}, { roto: true });
    assert.equal(aparatoDeIsa({ hash: '', search: '' }, roto), false);
    assert.equal(aparatoDeIsa({ hash: '', search: '?sofia=1' }, roto), true);
  });
});

describe('rutas', () => {
  it('nunca en TV, terminal, anuncios, calendario público, Entrar ni el regreso de Cuentas 3G', () => {
    for (const p of ['/produccion-tv', '/preparados-tv/', '/manufactura-tv', '/herreria-tv', '/terminal', '/terminal/soldadura',
      '/anuncios', '/calendario-publico', '/login', '/entrar/regreso']) {
      assert.equal(rutaSinSofia(p), true, p);
    }
  });
  it('sí en las pantallas internas', () => {
    for (const p of ['/', '/inventario', '/produccion', '/produccion/avisos', '/calendario', '/ordenes-compra', '/calidad/tabletas', '/terminales']) {
      assert.equal(rutaSinSofia(p), false, p);
    }
  });
});

describe('ponerSofia', () => {
  it('pone una sola etiqueta con data-sistema="planta", data-excluir y async', () => {
    const d = documentoFalso();
    const s = origenSofia('https://sofia.ejemplo.test');
    assert.equal(ponerSofia(d, s), true);
    assert.equal(ponerSofia(d, s), false, 'la segunda vez no repite');
    assert.equal(d.puestos.length, 1);
    const [el] = d.puestos;
    assert.equal(el.tag, 'script');
    assert.equal(el.id, ID_GUION);
    assert.equal(el.src, 'https://sofia.ejemplo.test/flotante.js');
    assert.equal(el.async, true);
    assert.equal(el.atributos['data-sistema'], 'planta');
    assert.equal(el.atributos['data-excluir'], EXCLUIR_PLANTA.join(','));
  });
  it('sin Sofía no pone nada', () => {
    const d = documentoFalso();
    assert.equal(ponerSofia(d, null), false);
    assert.equal(ponerSofia(d, origenSofia('')), false);
    assert.equal(d.puestos.length, 0);
  });
});

describe('dónde se monta', () => {
  it('App.jsx lo monta SOLO dentro de PrivateRoute (pantallas internas), nunca en las rutas públicas', () => {
    const app = leer('src/App.jsx');
    assert.match(app, /<PrivateRoute>\s*<SofiaFlotante \/>\s*<DashboardLayout \/>\s*<\/PrivateRoute>/);
    assert.equal(app.match(/<SofiaFlotante\b/g).length, 1);
  });
  it('sin la variable el componente no hace nada (ni guarda la marca ni pide el guion)', () => {
    const c = leer('src/sofia/SofiaFlotante.jsx');
    assert.match(c, /const DIRECCION = import\.meta\.env\.VITE_SOFIA_FLOTANTE_URL;\s*const SOFIA = DIRECCION \? origenSofia\(DIRECCION\) : null;/);
    assert.match(c, /if \(SOFIA && typeof window !== 'undefined'\) aparatoDeIsa\(/);
    assert.match(c, /if \(!SOFIA \|\| rutaSinSofia\(window\.location\.pathname\)\) return;/);
  });
  it('repositorio público: ninguna dirección de Sofía escrita en el código ni en los ejemplos', () => {
    const textos = [...readdirSync(join(RAIZ, 'src/sofia')).map((n) => leer(`src/sofia/${n}`)), leer('.env.example')];
    for (const t of textos) {
      assert.doesNotMatch(t, /https?:\/\/(?!127\.0\.0\.1|localhost)[\w.-]+/i);
      assert.doesNotMatch(t, /nip\.io|\b(?!127\.0\.0\.1\b)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    }
  });
});

import { useState } from 'react';
import { Plus, X, BadgeCheck, FileWarning, Landmark, IdCard } from 'lucide-react';
import { RE_RFC, normRfc, textoCredito } from './fichaDatos';

/**
 * B3 paso 3 · PLA-20 (solo con Diseño 3G): la ficha maestra del proveedor y el reporte de proveedores sin RFC.
 * Nombre corto, razones sociales con su RFC, alias, contactos y el trato para Julia. El crédito y el plazo NO se editan
 * aquí: los manda Contabilidad desde CTAS CRÉDITO (Julia, FIN-23) y solo se muestran.
 */

const Segmentado = ({ etiqueta, valor, opciones, onCambio, nombre }) => (
  <div className="g3-campo">
    <span className="g3-etq" id={`${nombre}-etq`}>{etiqueta}</span>
    <div className="g3-segmentado" role="radiogroup" aria-labelledby={`${nombre}-etq`}>
      {opciones.map(([v, t]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={valor === v} onClick={() => onCambio(v)}>{t}</button>
      ))}
    </div>
  </div>
);

/** Sección «Ficha maestra» dentro del formulario del proveedor (Diseño 3G). */
export const SeccionFicha = ({ valor, onCambio, credito, rfcPrincipal }) => {
  const [aliasNuevo, setAliasNuevo] = useState('');
  const cambiar = (campo, v) => onCambio({ ...valor, [campo]: v });
  const cambiarEn = (campo, i, parcial) => cambiar(campo, valor[campo].map((x, j) => (j === i ? { ...x, ...parcial } : x)));
  const quitar = (campo, i) => cambiar(campo, valor[campo].filter((_, j) => j !== i));
  const agregarAlias = () => {
    const t = aliasNuevo.trim();
    if (t && !valor.alias.some((a) => a.toUpperCase() === t.toUpperCase())) cambiar('alias', [...valor.alias, t]);
    setAliasNuevo('');
  };
  const rfcMal = (rfc) => !!rfc && !RE_RFC.test(normRfc(rfc));

  return (
    <section className="g3-formulario pt-4 border-t" aria-labelledby="ficha-titulo">
      <div>
        <h3 id="ficha-titulo" className="g3-seccion-titulo" style={{ margin: 0 }}>Ficha maestra</h3>
        <p className="g3-ayuda" style={{ margin: '4px 0 0' }}>La lee Julia para reconocer al proveedor y para escribirle (estado de cuenta y comprobantes).</p>
      </div>

      <div className="g3-campos">
        <label className="g3-campo">
          <span className="g3-etq">Nombre corto <small>(cómo le dicen en la oficina)</small></span>
          <input className="g3-entrada" value={valor.nombreCorto} maxLength={60} onChange={(e) => cambiar('nombreCorto', e.target.value)} placeholder="Ej. Aceros Bajío" />
        </label>
      </div>

      {/* Razones sociales */}
      <fieldset className="g3-campo" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="g3-etq">Razones sociales y RFC <small>{rfcPrincipal ? `(además del RFC principal ${rfcPrincipal})` : '(con las que factura)'}</small></legend>
        <div className="g3-pila" style={{ gap: 8 }}>
          {valor.razonesSociales.map((r, i) => (
            <div key={i} className="g3-campos" style={{ alignItems: 'end' }}>
              <label className="g3-campo">
                <span className="g3-etq">Razón social {i + 1}</span>
                <input className="g3-entrada" value={r.razon} maxLength={200} onChange={(e) => cambiarEn('razonesSociales', i, { razon: e.target.value })} placeholder="Ej. Aceros y Tensores del Bajío, S.A. de C.V." />
              </label>
              <label className="g3-campo">
                <span className="g3-etq">RFC</span>
                <input className="g3-entrada g3-mono" value={r.rfc} maxLength={15} aria-invalid={rfcMal(r.rfc)} aria-describedby={rfcMal(r.rfc) ? `rfc-err-${i}` : undefined}
                  onChange={(e) => cambiarEn('razonesSociales', i, { rfc: e.target.value.toUpperCase() })} placeholder="12 o 13 caracteres" />
                {rfcMal(r.rfc) && <span id={`rfc-err-${i}`} className="g3-error-campo">El RFC no tiene el formato (3 o 4 letras, 6 números y 3 caracteres).</span>}
              </label>
              <div><button type="button" className="g3-btn g3-btn--fantasma g3-btn--ch" onClick={() => quitar('razonesSociales', i)}><X size={16} aria-hidden="true" /> Quitar</button></div>
            </div>
          ))}
          <div><button type="button" className="g3-btn g3-btn--tonal g3-btn--ch" onClick={() => cambiar('razonesSociales', [...valor.razonesSociales, { razon: '', rfc: '' }])}><Plus size={16} aria-hidden="true" /> Agregar razón social</button></div>
        </div>
      </fieldset>

      {/* Alias */}
      <div className="g3-campo">
        <span className="g3-etq" id="alias-etq">Alias <small>(cómo aparece en carpetas, en el calendario o en los comprobantes)</small></span>
        {valor.alias.length > 0 && (
          <div className="g3-chips" aria-labelledby="alias-etq">
            {valor.alias.map((a, i) => (
              <button key={a} type="button" className="g3-chip" onClick={() => quitar('alias', i)} aria-label={`Quitar el alias ${a}`}>{a} <X size={14} aria-hidden="true" /></button>
            ))}
          </div>
        )}
        <div className="g3-grupo" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="g3-entrada" style={{ flex: '1 1 200px' }} value={aliasNuevo} maxLength={80} aria-labelledby="alias-etq"
            onChange={(e) => setAliasNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarAlias(); } }} placeholder="Ej. TUBERÍAS" />
          <button type="button" className="g3-btn g3-btn--tonal g3-btn--ch" onClick={agregarAlias} disabled={!aliasNuevo.trim()}><Plus size={16} aria-hidden="true" /> Agregar alias</button>
        </div>
      </div>

      {/* Contactos */}
      <fieldset className="g3-campo" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="g3-etq">Contactos <small>(a los marcados les escribe Julia; el primero es el principal)</small></legend>
        <div className="g3-pila" style={{ gap: 8 }}>
          {valor.contactos.map((c, i) => (
            <div key={i} className="g3-tarjeta g3-tarjeta--hundida" style={{ padding: 12 }}>
              <div className="g3-campos">
                <label className="g3-campo"><span className="g3-etq">Nombre</span><input className="g3-entrada" value={c.nombre} maxLength={100} onChange={(e) => cambiarEn('contactos', i, { nombre: e.target.value })} /></label>
                <label className="g3-campo"><span className="g3-etq">Teléfono</span><input className="g3-entrada" type="tel" inputMode="numeric" value={c.telefono} maxLength={16} onChange={(e) => cambiarEn('contactos', i, { telefono: e.target.value })} placeholder="10 dígitos" /></label>
                <label className="g3-campo"><span className="g3-etq">Correo</span><input className="g3-entrada" type="email" value={c.correo} maxLength={120} onChange={(e) => cambiarEn('contactos', i, { correo: e.target.value })} /></label>
                <label className="g3-campo"><span className="g3-etq">Puesto</span><input className="g3-entrada" value={c.puesto} maxLength={60} onChange={(e) => cambiarEn('contactos', i, { puesto: e.target.value })} placeholder="Ej. Ventas, Cobranza" /></label>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <label className="g3-opcion"><input type="checkbox" className="g3-casilla" checked={c.avisos} onChange={(e) => cambiarEn('contactos', i, { avisos: e.target.checked })} /> Le escribe Julia</label>
                <button type="button" className="g3-btn g3-btn--fantasma g3-btn--ch" onClick={() => quitar('contactos', i)}><X size={16} aria-hidden="true" /> Quitar contacto</button>
              </div>
            </div>
          ))}
          <div><button type="button" className="g3-btn g3-btn--tonal g3-btn--ch" onClick={() => cambiar('contactos', [...valor.contactos, { nombre: '', telefono: '', correo: '', puesto: '', avisos: valor.contactos.length === 0 }])}><Plus size={16} aria-hidden="true" /> Agregar contacto</button></div>
        </div>
      </fieldset>

      {/* Trato */}
      <div className="g3-campos">
        <Segmentado nombre="trato" etiqueta="Julia le habla de" valor={valor.trato} onCambio={(v) => cambiar('trato', v)} opciones={[['tu', 'Tú'], ['usted', 'Usted'], [null, 'Sin definir']]} />
        <Segmentado nombre="edocta" etiqueta="Pide estado de cuenta" valor={valor.pideEdoCta} onCambio={(v) => cambiar('pideEdoCta', v)} opciones={[[true, 'Sí'], [false, 'No'], [null, 'Sin definir']]} />
        <label className="g3-campo">
          <span className="g3-etq">Al pagar, se le pide</span>
          <select className="g3-selector" value={valor.pideAlPagar || ''} onChange={(e) => cambiar('pideAlPagar', e.target.value || null)}>
            <option value="">Sin definir</option>
            <option value="complemento">Complemento de pago</option>
            <option value="factura">Factura</option>
          </select>
        </label>
      </div>

      {/* Crédito (solo lectura) */}
      <div className={`g3-caja ${credito ? 'g3-caja--info' : ''}`}>
        <Landmark aria-hidden="true" />
        <div className="g3-caja-cuerpo">
          <strong>{credito ? `${textoCredito(credito)} · pestaña «${credito.pestana}»` : 'Sin crédito registrado en CTAS CRÉDITO'}</strong>
          <span>El crédito y el plazo los mantiene Contabilidad en CTAS CRÉDITO y los manda Julia; aquí solo se muestran.</span>
        </div>
      </div>
    </section>
  );
};

const fecha = (iso) => (iso ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)).replace('.', '') : '—');

/** El reporte de proveedores sin RFC (solo lee). */
export const ReporteSinRfc = ({ reporte, cargando, error, onReintentar, onAbrir }) => {
  if (error) {
    return (
      <div className="g3-caja g3-caja--mal" role="alert">
        <div className="g3-caja-cuerpo"><span>{error}</span></div>
        <div className="g3-caja-acciones"><button type="button" className="g3-btn g3-btn--ch" onClick={onReintentar}>Reintentar</button></div>
      </div>
    );
  }
  if (cargando || !reporte) {
    return <div className="g3-pila" style={{ gap: 8 }} aria-label="Cargando el reporte">{[0, 1, 2].map((i) => <div key={i} className="g3-esqueleto" style={{ height: 56 }} />)}</div>;
  }
  const r = reporte.resumen;
  return (
    <div className="g3-pila" style={{ gap: 20 }}>
      <div className="g3-caja g3-caja--info">
        <IdCard aria-hidden="true" />
        <div className="g3-caja-cuerpo">
          <strong>{r.sinRfc === 0 ? 'Todos los proveedores tienen RFC' : `${r.sinRfc} de ${r.proveedoresActivos} proveedores sin RFC`}{r.sinRfcConOrdenesRecientes ? ` · ${r.sinRfcConOrdenesRecientes} con órdenes en los últimos 90 días` : ''}</strong>
          <span>Con el RFC, Julia reconoce al proveedor en sus facturas y en CTAS CRÉDITO sin depender del nombre. Empieza por los que tienen órdenes recientes. Este reporte solo lee: no cambia nada.</span>
        </div>
      </div>

      <section className="g3-pila" style={{ gap: 8 }} aria-labelledby="rep-sin-rfc">
        <h3 id="rep-sin-rfc" className="g3-seccion-titulo" style={{ margin: 0 }}>En Planta sin RFC</h3>
        {reporte.sinRfc.length === 0 ? (
          <div className="g3-vacio"><BadgeCheck aria-hidden="true" /><b>Nadie sin RFC</b><p>Todos los proveedores activos tienen RFC en Planta.</p></div>
        ) : (
          <div className="g3-tabla g3-tabla--tarjetas">
            <table>
              <caption className="g3-oculto-visual">Proveedores sin RFC</caption>
              <thead><tr><th scope="col">Proveedor</th><th scope="col" className="g3-num">Artículos</th><th scope="col" className="g3-num">Órdenes (90 días)</th><th scope="col">Última orden</th><th scope="col"><span className="g3-oculto-visual">Acciones</span></th></tr></thead>
              <tbody>
                {reporte.sinRfc.map((p) => (
                  <tr key={p.id}>
                    <td className="g3-celda-titulo"><b>{p.nombre}</b>{p.nombreCorto ? <div className="g3-tenue">{p.nombreCorto}</div> : null}</td>
                    <td className="g3-num" data-etq="Artículos">{p.articulos}</td>
                    <td className="g3-num" data-etq="Órdenes (90 días)">{p.ordenes90}</td>
                    <td data-etq="Última orden">{fecha(p.ultimaOrden)}</td>
                    <td className="g3-celda-acciones"><button type="button" className="g3-btn g3-btn--tonal g3-btn--ch" onClick={() => onAbrir(p.id)}>Completar ficha</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reporte.rfcInvalido.length > 0 && (
        <section className="g3-pila" style={{ gap: 8 }} aria-labelledby="rep-rfc-mal">
          <h3 id="rep-rfc-mal" className="g3-seccion-titulo" style={{ margin: 0 }}>RFC con formato raro</h3>
          <div className="g3-lista">
            {reporte.rfcInvalido.map((p) => (
              <button key={p.id} type="button" className="g3-fila" onClick={() => onAbrir(p.id)}>
                <span className="g3-fila-ico"><FileWarning aria-hidden="true" /></span>
                <span className="g3-fila-cuerpo"><b>{p.nombre}</b><small className="g3-mono">{p.rfc}</small></span>
                <span className="g3-fila-der g3-estado g3-estado--aviso">Revisar</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {reporte.rfcRepetido.length > 0 && (
        <div className="g3-caja g3-caja--aviso">
          <FileWarning aria-hidden="true" />
          <div className="g3-caja-cuerpo">
            <strong>RFC en más de un proveedor</strong>
            {reporte.rfcRepetido.map((x) => <span key={x.rfc}><span className="g3-mono">{x.rfc}</span>: {x.proveedores.join(' y ')}</span>)}
          </div>
        </div>
      )}

      <section className="g3-pila" style={{ gap: 8 }} aria-labelledby="rep-ctas">
        <h3 id="rep-ctas" className="g3-seccion-titulo" style={{ margin: 0 }}>De CTAS CRÉDITO (Contabilidad) sin RFC en Planta</h3>
        {r.pestanasCtasCredito === 0 ? (
          <p className="g3-tenue" style={{ margin: 0 }}>Todavía no llega la lista de CTAS CRÉDITO (la manda Julia cuando se conecte, FIN-23).</p>
        ) : reporte.deCtasCredito.length === 0 ? (
          <p className="g3-tenue" style={{ margin: 0 }}>Las {r.pestanasCtasCredito} pestañas de CTAS CRÉDITO se reconocen por RFC en Planta.</p>
        ) : (
          <div className="g3-tabla g3-tabla--tarjetas">
            <table>
              <caption className="g3-oculto-visual">Pestañas de CTAS CRÉDITO sin RFC en Planta</caption>
              <thead><tr><th scope="col">Pestaña</th><th scope="col">RFC</th><th scope="col" className="g3-num">Plazo</th><th scope="col">Qué falta</th><th scope="col"><span className="g3-oculto-visual">Acciones</span></th></tr></thead>
              <tbody>
                {reporte.deCtasCredito.map((c) => (
                  <tr key={c.pestana}>
                    <td className="g3-celda-titulo"><b>{c.pestana}</b>{c.nombre !== c.pestana ? <div className="g3-tenue">{c.nombre}</div> : null}</td>
                    <td data-etq="RFC" className="g3-mono">{c.rfc || '—'}</td>
                    <td className="g3-num" data-etq="Plazo">{c.plazoDias} días</td>
                    <td data-etq="Qué falta"><span className="g3-estado g3-estado--aviso">{c.situacion}</span></td>
                    <td className="g3-celda-acciones">{c.proveedor ? <button type="button" className="g3-btn g3-btn--tonal g3-btn--ch" onClick={() => onAbrir(c.proveedor.id)}>Completar ficha</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

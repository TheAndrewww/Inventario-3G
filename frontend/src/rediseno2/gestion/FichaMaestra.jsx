// Rediseño 2 · Gestión · ficha maestra del proveedor, encendida: el formulario (SeccionFicha de FichaProveedor.jsx), su
// lectura en la ficha y el reporte «Sin RFC». Mismos campos, mismas reglas (RFC en mayúsculas, alias sin repetir, el primer
// contacto avisa a Julia) y el mismo valor que la página guarda con fichaParaGuardar (components/proveedores/fichaDatos.js,
// que no se toca). El crédito no se edita: lo manda Contabilidad desde CTAS CRÉDITO.
import { useState } from 'react';
import { Plus, X, Landmark, FileWarning, BadgeCheck } from 'lucide-react';
import {
  Campo, Entrada, Selector, Segmentado, Casilla, Boton, Datos, SeccionCajon, Tabla, Fecha, Estado, Cargando, ErrorCarga, Vacio, Nota, numero, plural,
} from '../fundacion';
import { RE_RFC, normRfc, textoCredito } from '../../components/proveedores/fichaDatos';
import './gestion.css';

const TRATO = { tu: 'Tú', usted: 'Usted' };
const ALPAGAR = { complemento: 'Complemento de pago', factura: 'Factura' };

/** Formulario de la ficha (dentro del cajón de editar proveedor). valor/onCambio = fichaForm/setFichaForm de la página. */
export function FichaMaestraFormulario({ valor, onCambio, credito, rfcPrincipal }) {
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
    <>
      <SeccionCajon titulo="Ficha maestra">
        <Nota>La lee Julia para reconocer al proveedor y para escribirle (estado de cuenta y comprobantes).</Nota>
        <Campo etiqueta="Nombre corto" ayuda="Cómo le dicen en la oficina" ancho="360px">
          <Entrada value={valor.nombreCorto} maxLength={60} onChange={(e) => cambiar('nombreCorto', e.target.value)} placeholder="Ej. Aceros Bajío" />
        </Campo>
      </SeccionCajon>

      <SeccionCajon titulo={`Razones sociales y RFC${rfcPrincipal ? ` · además del RFC principal ${rfcPrincipal}` : ' · con las que factura'}`}>
        {valor.razonesSociales.map((r, i) => (
          <div key={i} className="r2g-renglon-campos">
            <Campo etiqueta={`Razón social ${i + 1}`} className="r2g-crece">
              <Entrada value={r.razon} maxLength={200} onChange={(e) => cambiarEn('razonesSociales', i, { razon: e.target.value })} placeholder="Ej. Aceros y Tensores del Bajío, S.A. de C.V." />
            </Campo>
            <Campo etiqueta="RFC" ancho="200px" error={rfcMal(r.rfc) ? 'El RFC no tiene el formato (3 o 4 letras, 6 números y 3 caracteres).' : undefined}>
              <Entrada value={r.rfc} maxLength={15} onChange={(e) => cambiarEn('razonesSociales', i, { rfc: e.target.value.toUpperCase() })} placeholder="12 o 13 caracteres" />
            </Campo>
            <Boton nivel="fantasma" tamano="chico" icono={X} alHacer={() => quitar('razonesSociales', i)} className="r2g-quitar-renglon">Quitar</Boton>
          </div>
        ))}
        <div><Boton nivel="tonal" tamano="chico" icono={Plus} alHacer={() => cambiar('razonesSociales', [...valor.razonesSociales, { razon: '', rfc: '' }])}>Agregar razón social</Boton></div>
      </SeccionCajon>

      <SeccionCajon titulo="Alias · cómo aparece en carpetas, en el calendario o en los comprobantes">
        {valor.alias.length > 0 && (
          <div className="r2g-alias">
            {valor.alias.map((a, i) => (
              <button key={a} type="button" className="r2-filtro r2-chip" onClick={() => quitar('alias', i)} aria-label={`Quitar el alias ${a}`}>
                {a} <X size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        <div className="r2g-renglon-campos">
          <Campo etiqueta="Nuevo alias" className="r2g-crece">
            <Entrada value={aliasNuevo} maxLength={80} onChange={(e) => setAliasNuevo(e.target.value)} placeholder="Ej. TUBERÍAS"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarAlias(); } }} />
          </Campo>
          <Boton nivel="tonal" icono={Plus} alHacer={agregarAlias} deshabilitado={!aliasNuevo.trim()} motivo="Escribe el alias primero">Agregar alias</Boton>
        </div>
      </SeccionCajon>

      <SeccionCajon titulo="Contactos · a los marcados les escribe Julia; el primero es el principal">
        {valor.contactos.map((c, i) => (
          <fieldset key={i} className="r2g-contacto">
            <legend className="r2-solo-lectores">Contacto {i + 1}</legend>
            <div className="r2g-campos-dos">
              <Campo etiqueta="Nombre"><Entrada value={c.nombre} maxLength={100} onChange={(e) => cambiarEn('contactos', i, { nombre: e.target.value })} /></Campo>
              <Campo etiqueta="Puesto"><Entrada value={c.puesto} maxLength={60} onChange={(e) => cambiarEn('contactos', i, { puesto: e.target.value })} placeholder="Ej. Ventas, Cobranza" /></Campo>
              <Campo etiqueta="Teléfono"><Entrada type="tel" inputMode="numeric" value={c.telefono} maxLength={16} onChange={(e) => cambiarEn('contactos', i, { telefono: e.target.value })} placeholder="10 dígitos" /></Campo>
              <Campo etiqueta="Correo"><Entrada type="email" value={c.correo} maxLength={120} onChange={(e) => cambiarEn('contactos', i, { correo: e.target.value })} /></Campo>
            </div>
            <div className="r2g-contacto-pie">
              <Casilla marcada={c.avisos} alCambiar={(v) => cambiarEn('contactos', i, { avisos: v })} texto="Le escribe Julia" />
              <Boton nivel="fantasma" tamano="chico" icono={X} alHacer={() => quitar('contactos', i)}>Quitar contacto</Boton>
            </div>
          </fieldset>
        ))}
        <div>
          <Boton nivel="tonal" tamano="chico" icono={Plus}
            alHacer={() => cambiar('contactos', [...valor.contactos, { nombre: '', telefono: '', correo: '', puesto: '', avisos: valor.contactos.length === 0 }])}>
            Agregar contacto
          </Boton>
        </div>
      </SeccionCajon>

      <SeccionCajon titulo="Trato y pagos">
        <div className="r2g-campos-dos">
          <div className="r2-campo">
            <span className="r2-campo-etiqueta">Julia le habla de</span>
            <Segmentado etiqueta="Julia le habla de" valor={valor.trato} alCambiar={(v) => cambiar('trato', v)}
              opciones={[{ valor: 'tu', texto: 'Tú' }, { valor: 'usted', texto: 'Usted' }, { valor: null, texto: 'Sin definir' }]} />
          </div>
          <div className="r2-campo">
            <span className="r2-campo-etiqueta">Pide estado de cuenta</span>
            <Segmentado etiqueta="Pide estado de cuenta" valor={valor.pideEdoCta} alCambiar={(v) => cambiar('pideEdoCta', v)}
              opciones={[{ valor: true, texto: 'Sí' }, { valor: false, texto: 'No' }, { valor: null, texto: 'Sin definir' }]} />
          </div>
        </div>
        <Campo etiqueta="Al pagar, se le pide" ancho="320px">
          <Selector value={valor.pideAlPagar || ''} onChange={(e) => cambiar('pideAlPagar', e.target.value || null)}>
            <option value="">Sin definir</option>
            <option value="complemento">Complemento de pago</option>
            <option value="factura">Factura</option>
          </Selector>
        </Campo>
      </SeccionCajon>

      <SeccionCajon titulo="Crédito">
        <LineaCredito credito={credito} />
      </SeccionCajon>
    </>
  );
}

function LineaCredito({ credito }) {
  return (
    <div className="r2g-credito">
      <Landmark size={20} aria-hidden="true" />
      <div className="r2g-celda-doble">
        <span className="r2g-fuerte">{credito ? `${textoCredito(credito)} · pestaña «${credito.pestana}»` : 'Sin crédito registrado en CTAS CRÉDITO'}</span>
        <span className="r2g-sec">El crédito y el plazo los mantiene Contabilidad en CTAS CRÉDITO y los manda Julia; aquí solo se muestran.</span>
      </div>
    </div>
  );
}

/** La ficha maestra en lectura (dentro de la ficha del proveedor). */
export function FichaMaestraLectura({ ficha, credito }) {
  const f = ficha || {};
  const razones = f.razonesSociales || [];
  const contactos = f.contactos || [];
  return (
    <>
      <SeccionCajon titulo="Ficha maestra">
        <Datos columnas={2} datos={[
          ['Nombre corto', f.nombreCorto],
          ['Alias', (f.alias || []).join(', ')],
          ['Julia le habla de', TRATO[f.trato] || 'Sin definir'],
          ['Pide estado de cuenta', f.pideEdoCta === true ? 'Sí' : f.pideEdoCta === false ? 'No' : 'Sin definir'],
          ['Al pagar, se le pide', ALPAGAR[f.pideAlPagar] || 'Sin definir'],
        ]} />
      </SeccionCajon>
      <SeccionCajon titulo={`Razones sociales · ${numero(razones.length)}`}>
        {razones.length ? (
          <ul className="r2g-lista-simple">
            {razones.map((r, i) => (
              <li key={i} className="r2g-lista-simple-fila">
                <span className="r2g-crece">{r.razon || <span className="r2g-sec">Sin nombre</span>}</span>
                <span className="r2g-clave">{r.rfc || 'Sin RFC'}</span>
              </li>
            ))}
          </ul>
        ) : <Nota>Sin razones sociales en la ficha.</Nota>}
      </SeccionCajon>
      <SeccionCajon titulo={`Contactos · ${numero(contactos.length)}`}>
        {contactos.length ? (
          <ul className="r2g-lista-simple">
            {contactos.map((c, i) => (
              <li key={i} className="r2g-lista-simple-fila">
                <span className="r2g-celda-doble r2g-crece">
                  <span className="r2g-fuerte">{c.nombre || 'Sin nombre'}{i === 0 ? <span className="r2g-sec"> · principal</span> : null}</span>
                  <span className="r2g-sec">{[c.puesto, c.telefono, c.correo].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
                </span>
                {c.avisos && <Estado tono="info" texto="Le escribe Julia" />}
              </li>
            ))}
          </ul>
        ) : <Nota>Sin contactos en la ficha.</Nota>}
      </SeccionCajon>
      <SeccionCajon titulo="Crédito">
        <LineaCredito credito={credito} />
      </SeccionCajon>
    </>
  );
}

/** Reporte «Sin RFC» (solo lee). Mismos datos que ReporteSinRfc. */
export function ReporteSinRfcR2({ reporte, cargando, error, onReintentar, onAbrir }) {
  if (error) return <ErrorCarga mensaje={error} alReintentar={onReintentar} />;
  if (cargando || !reporte) return <Cargando forma="tabla" columnas={[3, 1, 1, 1]} filas={5} etiqueta="Cargando el reporte de proveedores sin RFC…" />;
  const r = reporte.resumen;
  return (
    <div className="r2g-reporte">
      <p className="r2g-linea r2g-reporte-resumen">
        <b>{r.sinRfc === 0 ? 'Todos los proveedores tienen RFC' : `${r.sinRfc} de ${r.proveedoresActivos} proveedores sin RFC`}</b>
        {r.sinRfcConOrdenesRecientes ? ` · ${r.sinRfcConOrdenesRecientes} con órdenes en los últimos 90 días` : ''}
      </p>
      <Nota>Con el RFC, Julia reconoce al proveedor en sus facturas y en CTAS CRÉDITO sin depender del nombre. Empieza por los que tienen órdenes recientes. Este reporte solo lee: no cambia nada.</Nota>

      <section className="r2g-reporte-seccion" aria-labelledby="r2g-rep-sin-rfc">
        <h2 id="r2g-rep-sin-rfc" className="r2g-reporte-titulo">En Planta sin RFC</h2>
        <Tabla etiqueta="Proveedores sin RFC" clave="id" densidad="compacta" fija={false} filas={reporte.sinRfc}
          columnas={[
            { id: 'proveedor', titulo: 'Proveedor', celda: (x) => <span className="r2g-celda-doble"><span className="r2g-fuerte">{x.nombre}</span>{x.nombreCorto && <span className="r2g-sec">{x.nombreCorto}</span>}</span> },
            { id: 'articulos', titulo: 'Artículos', alinear: 'der', ancho: '100px', celda: (x) => numero(x.articulos) },
            { id: 'ordenes', titulo: 'Órdenes (90 días)', alinear: 'der', ancho: '150px', celda: (x) => numero(x.ordenes90) },
            { id: 'ultima', titulo: 'Última orden', ancho: '150px', celda: (x) => <Fecha valor={x.ultimaOrden} /> },
          ]}
          accion={(x) => <Boton nivel="tonal" tamano="chico" alHacer={() => onAbrir(x.id)}>Completar ficha</Boton>}
          filaCelular={(x) => ({ principal: x.nombre, secundario: `${plural(x.articulos, 'artículo', 'artículos')} · ${plural(x.ordenes90, 'orden', 'órdenes')} en 90 días` })}
          vacio={{ icono: BadgeCheck, titulo: 'Nadie sin RFC', texto: 'Todos los proveedores activos tienen RFC en Planta.', compacto: true }} />
      </section>

      {reporte.rfcInvalido.length > 0 && (
        <section className="r2g-reporte-seccion" aria-labelledby="r2g-rep-rfc-mal">
          <h2 id="r2g-rep-rfc-mal" className="r2g-reporte-titulo">RFC con formato raro</h2>
          <Tabla etiqueta="Proveedores con RFC con formato raro" clave="id" densidad="compacta" fija={false} filas={reporte.rfcInvalido}
            columnas={[
              { id: 'proveedor', titulo: 'Proveedor', celda: (x) => <span className="r2g-fuerte">{x.nombre}</span> },
              { id: 'rfc', titulo: 'RFC', ancho: '200px', celda: (x) => <span className="r2g-clave">{x.rfc}</span> },
              { id: 'estado', titulo: 'Qué falta', ancho: '140px', celda: () => <Estado tono="aviso" texto="Revisar" /> },
            ]}
            alAbrir={(x) => onAbrir(x.id)} etiquetaAbrir={(x) => `Revisar el RFC de ${x.nombre}`}
            filaCelular={(x) => ({ inicio: <FileWarning size={20} aria-hidden="true" className="r2-tono--aviso" />, principal: x.nombre, secundario: x.rfc, debajo: <Estado tono="aviso" texto="Revisar" /> })} />
        </section>
      )}

      {reporte.rfcRepetido.length > 0 && (
        <section className="r2g-reporte-seccion" aria-labelledby="r2g-rep-repetido">
          <h2 id="r2g-rep-repetido" className="r2g-reporte-titulo">RFC en más de un proveedor</h2>
          <ul className="r2g-lista-simple">
            {reporte.rfcRepetido.map((x) => (
              <li key={x.rfc} className="r2g-lista-simple-fila">
                <span className="r2g-clave">{x.rfc}</span>
                <span className="r2g-crece">{x.proveedores.join(' y ')}</span>
                <Estado tono="aviso" texto="Revisar" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="r2g-reporte-seccion" aria-labelledby="r2g-rep-ctas">
        <h2 id="r2g-rep-ctas" className="r2g-reporte-titulo">De CTAS CRÉDITO (Contabilidad) sin RFC en Planta</h2>
        {r.pestanasCtasCredito === 0 ? (
          <Nota>Todavía no llega la lista de CTAS CRÉDITO (la manda Julia cuando se conecte, FIN-23).</Nota>
        ) : reporte.deCtasCredito.length === 0 ? (
          <Nota>Las {r.pestanasCtasCredito} pestañas de CTAS CRÉDITO se reconocen por RFC en Planta.</Nota>
        ) : (
          <Tabla etiqueta="Pestañas de CTAS CRÉDITO sin RFC en Planta" clave="pestana" densidad="compacta" fija={false} filas={reporte.deCtasCredito}
            columnas={[
              { id: 'pestana', titulo: 'Pestaña', celda: (c) => <span className="r2g-celda-doble"><span className="r2g-fuerte">{c.pestana}</span>{c.nombre !== c.pestana && <span className="r2g-sec">{c.nombre}</span>}</span> },
              { id: 'rfc', titulo: 'RFC', ancho: '180px', celda: (c) => <span className="r2g-clave">{c.rfc || '—'}</span> },
              { id: 'plazo', titulo: 'Plazo', alinear: 'der', ancho: '100px', celda: (c) => plural(c.plazoDias, 'día', 'días') },
              { id: 'falta', titulo: 'Qué falta', celda: (c) => <Estado tono="aviso" texto={c.situacion} /> },
            ]}
            accion={(c) => (c.proveedor ? <Boton nivel="tonal" tamano="chico" alHacer={() => onAbrir(c.proveedor.id)}>Completar ficha</Boton> : null)}
            filaCelular={(c) => ({ principal: c.pestana, secundario: [c.rfc, plural(c.plazoDias, 'día', 'días')].filter(Boolean).join(' · '), debajo: <Estado tono="aviso" texto={c.situacion} /> })}
            vacio={<Vacio titulo="Sin pendientes" compacto />} />
        )}
      </section>
    </div>
  );
}

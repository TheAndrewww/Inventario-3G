/**
 * B3 paso 3 · PLA-20 — Ficha maestra de proveedores, crédito desde CTAS CRÉDITO y reporte de proveedores sin RFC.
 *
 *   1. Reporte (primero, sin lógica nueva y solo lectura): proveedores activos de Planta sin RFC, con RFC mal escrito,
 *      con un RFC de razón social repetido en otro proveedor, y los de CTAS CRÉDITO (lo que manda Julia) que Planta no
 *      reconoce por RFC. Para ordenar el trabajo dice cuántos artículos y cuántas órdenes de los últimos 90 días tiene cada uno.
 *   2. Ficha (models/Proveedor.js › ProveedorFicha): nombre corto, razones sociales con su RFC, alias, contactos y trato.
 *   3. Crédito y plazo: los sigue manteniendo Contabilidad en CTAS CRÉDITO (D-9). Julia manda la lista completa por
 *      POST /api/sistemas/v1/proveedores/credito (contrato §4.4: `{ rfc, nombre, pestana, plazoDias }[]`); Planta la guarda
 *      tal cual y la muestra (no la edita nadie en Planta).
 *   4. Julia lee la ficha por GET /api/sistemas/v1/proveedores (FIN-23, con su bandera DIRECTORIO_DESDE_PLANTA en Finanzas).
 *
 * El empate de una pestaña de CTAS CRÉDITO con un proveedor de Planta es conservador: primero por RFC (el del proveedor o
 * el de cualquiera de sus razones sociales) y, si no hay RFC, por nombre EXACTO ya normalizado (nombre, nombre corto,
 * alias o razón social; sin acentos, sin lo que va entre paréntesis ni tras la coma, sin «SA DE CV»). Si dos proveedores
 * empatan, no se le asigna a ninguno (lo dice el reporte).
 */
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import Proveedor, { ProveedorFicha, ProveedorCredito } from '../models/Proveedor.js';
import { isoMexico } from '../utils/revisarConfig.js';

/** RFC de persona moral (3 letras) o física (4), fecha AAMMDD y homoclave. */
export const RE_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
export const normRfc = (v) => String(v ?? '').toUpperCase().replace(/[\s.-]/g, '').trim();
export const rfcValido = (v) => RE_RFC.test(normRfc(v));

const RELLENO = new Set(['SA', 'DE', 'CV', 'RL', 'SC', 'SAS', 'SRL', 'SAPI', 'S', 'A', 'C', 'V', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y']);
/** «Pinturas Berel, S.A. de C.V. (Efrén)» → «PINTURAS BEREL». Igual que Finanzas arma el nombre de cada pestaña. */
export const nombreClave = (s) => String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0]
    .replace(/[^A-Z0-9Ñ& ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !RELLENO.has(w))
    .join(' ');

const texto = (v, max) => {
    if (v === undefined || v === null) return { valor: null };
    if (typeof v !== 'string') return { error: true };
    const t = v.trim().replace(/\s+/g, ' ');
    if (t.length > max) return { error: true };
    return { valor: t || null };
};
const diezDigitos = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ───────────────────────── la ficha ───────────────────────── */

/** Revisa la ficha que manda la pantalla; devuelve { errores } o { datos } (columnas de la tabla). */
export const leerFicha = (b = {}) => {
    const errores = [];
    const nombreCorto = texto(b.nombreCorto, 60);
    if (nombreCorto.error) errores.push('El nombre corto es de hasta 60 caracteres');

    const razones = [];
    if (b.razonesSociales !== undefined && !Array.isArray(b.razonesSociales)) errores.push('Las razones sociales deben ser una lista');
    for (const [i, r] of (Array.isArray(b.razonesSociales) ? b.razonesSociales : []).entries()) {
        const razon = texto(r?.razon, 200);
        const rfc = normRfc(r?.rfc);
        if (!razon.valor && !rfc) continue; // renglón vacío
        if (razon.error || !razon.valor) errores.push(`Razón social ${i + 1}: falta el nombre (hasta 200 caracteres)`);
        if (rfc && !RE_RFC.test(rfc)) errores.push(`Razón social ${i + 1}: el RFC «${rfc.slice(0, 15)}» no tiene el formato (12 o 13 caracteres)`);
        razones.push({ razon: razon.valor, rfc: rfc || null });
    }
    if (razones.length > 10) errores.push('Hasta 10 razones sociales');
    const rfcs = razones.map((r) => r.rfc).filter(Boolean);
    if (new Set(rfcs).size !== rfcs.length) errores.push('Un RFC está repetido en las razones sociales');

    const alias = [];
    if (b.alias !== undefined && !Array.isArray(b.alias)) errores.push('Los alias deben ser una lista');
    for (const a of (Array.isArray(b.alias) ? b.alias : [])) {
        const t = texto(a, 80);
        if (t.error) { errores.push('Cada alias es de hasta 80 caracteres'); continue; }
        if (t.valor && !alias.some((x) => x.toUpperCase() === t.valor.toUpperCase())) alias.push(t.valor);
    }
    if (alias.length > 20) errores.push('Hasta 20 alias');

    const contactos = [];
    if (b.contactos !== undefined && !Array.isArray(b.contactos)) errores.push('Los contactos deben ser una lista');
    for (const [i, c] of (Array.isArray(b.contactos) ? b.contactos : []).entries()) {
        const nombre = texto(c?.nombre, 100);
        const puesto = texto(c?.puesto, 60);
        const correo = texto(c?.correo, 120);
        const telCrudo = String(c?.telefono ?? '').trim();
        if (!nombre.valor && !telCrudo && !correo.valor) continue; // renglón vacío
        const n = i + 1;
        if (nombre.error || !nombre.valor) errores.push(`Contacto ${n}: falta el nombre (hasta 100 caracteres)`);
        if (puesto.error) errores.push(`Contacto ${n}: el puesto es de hasta 60 caracteres`);
        const telefono = telCrudo ? diezDigitos(telCrudo) : null;
        if (telCrudo && (telefono.length !== 10 || telCrudo.replace(/\D/g, '').length > 13)) errores.push(`Contacto ${n}: el teléfono debe tener 10 dígitos`);
        if (correo.error || (correo.valor && !RE_CORREO.test(correo.valor))) errores.push(`Contacto ${n}: el correo no es válido`);
        if (!telefono && !correo.valor) errores.push(`Contacto ${n}: pon un teléfono o un correo`);
        contactos.push({ nombre: nombre.valor, telefono, correo: correo.valor ? correo.valor.toLowerCase() : null, puesto: puesto.valor, avisos: c?.avisos === true });
    }
    if (contactos.length > 10) errores.push('Hasta 10 contactos');

    const trato = b.trato === undefined || b.trato === null || b.trato === '' ? null : String(b.trato).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (trato !== null && !['tu', 'usted'].includes(trato)) errores.push('El trato es «tu» o «usted»');
    const pideEdoCta = b.pideEdoCta === undefined || b.pideEdoCta === null || b.pideEdoCta === '' ? null : b.pideEdoCta;
    if (pideEdoCta !== null && typeof pideEdoCta !== 'boolean') errores.push('«Pide estado de cuenta» es sí o no');
    const pideAlPagar = b.pideAlPagar === undefined || b.pideAlPagar === null || b.pideAlPagar === '' || b.pideAlPagar === 'nada' ? null : String(b.pideAlPagar).toLowerCase();
    if (pideAlPagar !== null && !['complemento', 'factura'].includes(pideAlPagar)) errores.push('«Al pagar pide» es complemento, factura o nada');

    if (errores.length) return { errores };
    return {
        errores: [],
        datos: {
            nombre_corto: nombreCorto.valor, razones_sociales: razones, alias, contactos,
            trato, pide_edo_cta: pideEdoCta, pide_al_pagar: pideAlPagar
        }
    };
};

/** La ficha como la ven la pantalla y Julia. */
export const fichaJson = (f) => (f ? {
    nombreCorto: f.nombre_corto || null,
    razonesSociales: f.razones_sociales || [],
    alias: f.alias || [],
    contactos: f.contactos || [],
    trato: f.trato || null,
    pideEdoCta: f.pide_edo_cta ?? null,
    pideAlPagar: f.pide_al_pagar || null,
    actualizada: (f.updatedAt || f.updated_at) ? isoMexico(new Date(f.updatedAt || f.updated_at)) : null
} : null);

/** Guarda la ficha de un proveedor (la crea si no tiene). Devuelve { codigo, cuerpo }. */
export const guardarFicha = async (proveedorId, cuerpo, usuarioId = null) => {
    const proveedor = await Proveedor.findByPk(proveedorId, { attributes: ['id', 'rfc'] });
    if (!proveedor) return { codigo: 404, cuerpo: { success: false, message: 'Proveedor no encontrado' } };
    const { errores, datos } = leerFicha(cuerpo);
    if (errores.length) return { codigo: 400, cuerpo: { success: false, message: errores.join('. ') + '.', errores } };
    // Un RFC de razón social no puede ser el RFC principal de OTRO proveedor (sería el mismo proveedor dos veces)
    const rfcs = datos.razones_sociales.map((r) => r.rfc).filter(Boolean);
    if (rfcs.length) {
        const otro = await Proveedor.findOne({ where: { rfc: { [Op.in]: rfcs }, id: { [Op.ne]: proveedor.id } }, attributes: ['id', 'nombre', 'rfc'] });
        if (otro) return { codigo: 400, cuerpo: { success: false, message: `El RFC ${otro.rfc} ya es de otro proveedor (${otro.nombre}).` } };
    }
    const [fila] = await ProveedorFicha.upsert({ proveedor_id: proveedor.id, ...datos, actualizado_por_id: usuarioId }, { returning: true });
    return { codigo: 200, cuerpo: { success: true, message: 'Ficha guardada', data: fichaJson(fila) } };
};

/* ───────────────────────── crédito (lo manda Julia) ───────────────────────── */

/** Revisa la lista de CTAS CRÉDITO (contrato §4.4). Devuelve { errores } o { lista }. */
export const leerCredito = (b) => {
    if (!Array.isArray(b)) return { errores: ['El cuerpo debe ser una lista [{ rfc, nombre, pestana, plazoDias }]'] };
    if (!b.length) return { errores: ['La lista viene vacía: no se cambia nada (si CTAS CRÉDITO no se pudo leer, no se manda)'] };
    if (b.length > 50) return { errores: ['Hasta 50 pestañas por envío'] };
    const errores = [];
    const lista = [];
    const vistas = new Set();
    b.forEach((x, i) => {
        const n = i + 1;
        const pestana = texto(x?.pestana, 120);
        const nombre = texto(x?.nombre, 200);
        const rfc = x?.rfc === undefined || x?.rfc === null || x?.rfc === '' ? null : normRfc(x.rfc);
        const plazo = x?.plazoDias;
        if (pestana.error || !pestana.valor) errores.push(`${n}: falta «pestana» (hasta 120 caracteres)`);
        if (nombre.error || !nombre.valor) errores.push(`${n}: falta «nombre» (hasta 200 caracteres)`);
        if (rfc && !RE_RFC.test(rfc)) errores.push(`${n}: «rfc» no tiene el formato de un RFC`);
        if (!Number.isInteger(plazo) || plazo < 0 || plazo > 365) errores.push(`${n}: «plazoDias» debe ser un entero de 0 a 365`);
        const clave = (pestana.valor || '').toUpperCase();
        if (clave && vistas.has(clave)) errores.push(`${n}: la pestaña «${pestana.valor}» viene dos veces`);
        vistas.add(clave);
        lista.push({ pestana: pestana.valor, nombre: nombre.valor, rfc, plazo_dias: plazo });
    });
    return errores.length ? { errores } : { errores: [], lista };
};

/** Índice para empatar: por RFC y por nombre normalizado → ids de proveedor. */
const indiceEmpate = (proveedores, fichas) => {
    const porRfc = new Map();
    const porNombre = new Map();
    const sumar = (mapa, clave, id) => { if (!clave) return; mapa.set(clave, new Set([...(mapa.get(clave) || []), id])); };
    const fichaDe = new Map(fichas.map((f) => [f.proveedor_id, f]));
    for (const p of proveedores) {
        const f = fichaDe.get(p.id);
        sumar(porRfc, p.rfc ? normRfc(p.rfc) : null, p.id);
        sumar(porNombre, nombreClave(p.nombre), p.id);
        if (!f) continue;
        sumar(porNombre, nombreClave(f.nombre_corto), p.id);
        for (const a of f.alias || []) sumar(porNombre, nombreClave(a), p.id);
        for (const r of f.razones_sociales || []) { sumar(porRfc, r.rfc, p.id); sumar(porNombre, nombreClave(r.razon), p.id); }
    }
    return { porRfc, porNombre };
};

/** { proveedorId, empate: 'rfc'|'nombre'|'ambiguo'|null } para una pestaña de CTAS CRÉDITO. */
export const empatarCredito = (item, indice) => {
    if (item.rfc) {
        const ids = indice.porRfc.get(normRfc(item.rfc));
        if (ids?.size === 1) return { proveedorId: [...ids][0], empate: 'rfc' };
        if (ids?.size > 1) return { proveedorId: null, empate: 'ambiguo' };
    }
    for (const n of [item.nombre, item.pestana]) {
        const ids = indice.porNombre.get(nombreClave(n));
        if (ids?.size === 1) return { proveedorId: [...ids][0], empate: 'nombre' };
        if (ids?.size > 1) return { proveedorId: null, empate: 'ambiguo' };
    }
    return { proveedorId: null, empate: null };
};

const datosParaEmpate = async () => {
    const proveedores = await Proveedor.findAll({ attributes: ['id', 'nombre', 'rfc', 'activo'], raw: true });
    const fichas = await ProveedorFicha.findAll({ raw: true });
    return { proveedores, fichas, indice: indiceEmpate(proveedores.filter((p) => p.activo), fichas) };
};

const creditoJson = (c, e) => ({
    pestana: c.pestana, nombre: c.nombre, rfc: c.rfc || null, plazoDias: c.plazo_dias,
    proveedorId: e.proveedorId, empate: e.empate, recibido: isoMexico(new Date(c.recibido_en))
});

/**
 * POST /api/sistemas/v1/proveedores/credito: la lista COMPLETA de CTAS CRÉDITO. Cada pestaña se guarda o se actualiza;
 * las que ya no vienen quedan «vigente = false» (no se borran). Devuelve { codigo, cuerpo } para la puerta.
 */
export const registrarCredito = async (cuerpo) => {
    const { errores, lista } = leerCredito(cuerpo);
    if (errores.length) return { codigo: 400, cuerpo: { error: `No se guardó: ${errores.join('; ')}.` } };
    const ahora = new Date();
    const resumen = await sequelize.transaction(async (transaction) => {
        const previas = await ProveedorCredito.findAll({ transaction });
        const porPestana = new Map(previas.map((p) => [p.pestana.toUpperCase(), p]));
        let nuevas = 0, cambiadas = 0;
        for (const x of lista) {
            const previa = porPestana.get(x.pestana.toUpperCase());
            if (!previa) { await ProveedorCredito.create({ ...x, vigente: true, recibido_en: ahora }, { transaction }); nuevas++; continue; }
            const cambio = previa.nombre !== x.nombre || (previa.rfc || null) !== x.rfc || previa.plazo_dias !== x.plazo_dias || !previa.vigente || previa.pestana !== x.pestana;
            await previa.update({ ...x, vigente: true, recibido_en: ahora }, { transaction });
            if (cambio) cambiadas++;
        }
        const vienen = new Set(lista.map((x) => x.pestana.toUpperCase()));
        const yaNoEstan = previas.filter((p) => p.vigente && !vienen.has(p.pestana.toUpperCase()));
        for (const p of yaNoEstan) await p.update({ vigente: false }, { transaction });
        return { nuevas, cambiadas, yaNoEstan: yaNoEstan.map((p) => p.pestana) };
    });
    const { indice } = await datosParaEmpate();
    const sinEmpate = lista.filter((x) => !empatarCredito(x, indice).proveedorId).map((x) => x.pestana);
    return {
        codigo: resumen.nuevas ? 201 : 200,
        cuerpo: { ok: true, recibidas: lista.length, ...resumen, sinProveedorEnPlanta: sinEmpate }
    };
};

/** Las pestañas vigentes con su proveedor de Planta (si lo hay). */
export const creditoVigente = async () => {
    const { indice } = await datosParaEmpate();
    const filas = await ProveedorCredito.findAll({ where: { vigente: true }, order: [['pestana', 'ASC']], raw: true });
    return filas.map((c) => creditoJson(c, empatarCredito(c, indice)));
};

/* ───────────────────────── pantalla y reporte ───────────────────────── */

/** GET /api/proveedores/fichas (con sesión): fichas por proveedor y el crédito vigente, para la pantalla de Diseño 3G. */
export const fichasParaPantalla = async () => {
    const fichas = await ProveedorFicha.findAll({ raw: true });
    const credito = await creditoVigente();
    return {
        fichas: Object.fromEntries(fichas.map((f) => [f.proveedor_id, fichaJson(f)])),
        credito
    };
};

/**
 * GET /api/proveedores/reporte-sin-rfc (con sesión de Compras, encargados o administración). SOLO LEE (únicamente
 * SELECT). Lo que falta para que cada proveedor tenga su RFC en Planta.
 */
export const reporteSinRfc = async () => {
    const { proveedores, fichas, indice } = await datosParaEmpate();
    const fichaDe = new Map(fichas.map((f) => [f.proveedor_id, f]));
    const [articulos] = await sequelize.query('SELECT proveedor_id AS id, COUNT(*)::int AS n FROM articulos WHERE activo = true AND proveedor_id IS NOT NULL GROUP BY proveedor_id');
    const [ordenes] = await sequelize.query(`SELECT proveedor_id AS id, COUNT(*)::int AS n, MAX(created_at) AS ultima FROM ordenes_compra
        WHERE created_at >= NOW() - INTERVAL '90 days' AND proveedor_id IS NOT NULL GROUP BY proveedor_id`);
    const nArt = new Map(articulos.map((x) => [x.id, x.n]));
    const nOrd = new Map(ordenes.map((x) => [x.id, x]));
    const fila = (p) => ({
        id: p.id, nombre: p.nombre, nombreCorto: fichaDe.get(p.id)?.nombre_corto || null,
        articulos: nArt.get(p.id) || 0,
        ordenes90: nOrd.get(p.id)?.n || 0,
        ultimaOrden: nOrd.get(p.id)?.ultima ? isoMexico(new Date(nOrd.get(p.id).ultima)) : null
    });
    const activos = proveedores.filter((p) => p.activo);
    const rfcsDe = (p) => [p.rfc ? normRfc(p.rfc) : null, ...((fichaDe.get(p.id)?.razones_sociales || []).map((r) => r.rfc))].filter(Boolean);
    const orden = (a, b) => b.ordenes90 - a.ordenes90 || b.articulos - a.articulos || a.nombre.localeCompare(b.nombre, 'es');

    const sinRfc = activos.filter((p) => rfcsDe(p).length === 0).map(fila).sort(orden);
    const rfcInvalido = activos.filter((p) => p.rfc && !rfcValido(p.rfc)).map((p) => ({ ...fila(p), rfc: p.rfc })).sort(orden);
    const repetidos = [...indice.porRfc].filter(([, ids]) => ids.size > 1)
        .map(([rfc, ids]) => ({ rfc, proveedores: [...ids].map((id) => activos.find((p) => p.id === id)?.nombre).filter(Boolean) }));
    const credito = await ProveedorCredito.findAll({ where: { vigente: true }, order: [['pestana', 'ASC']], raw: true });
    const deCtasCredito = credito.map((c) => {
        const e = empatarCredito(c, indice);
        if (e.empate === 'rfc') return null;
        const p = e.proveedorId ? activos.find((x) => x.id === e.proveedorId) : null;
        return {
            pestana: c.pestana, nombre: c.nombre, rfc: c.rfc || null, plazoDias: c.plazo_dias,
            situacion: e.empate === 'nombre' ? (c.rfc ? 'Planta lo tiene, pero sin ese RFC' : 'Planta lo tiene; CTAS CRÉDITO no trae RFC')
                : e.empate === 'ambiguo' ? 'Hay dos proveedores en Planta con ese nombre o RFC' : 'No está en Planta',
            proveedor: p ? { id: p.id, nombre: p.nombre } : null
        };
    }).filter(Boolean);

    return {
        soloLectura: true,
        generado: isoMexico(),
        resumen: {
            proveedoresActivos: activos.length,
            conRfc: activos.length - sinRfc.length,
            sinRfc: sinRfc.length,
            sinRfcConOrdenesRecientes: sinRfc.filter((x) => x.ordenes90 > 0).length,
            rfcInvalido: rfcInvalido.length,
            rfcRepetido: repetidos.length,
            pestanasCtasCredito: credito.length,
            deCtasCreditoSinRfcEnPlanta: deCtasCredito.length,
            conFicha: fichas.filter((f) => activos.some((p) => p.id === f.proveedor_id)).length
        },
        sinRfc,
        rfcInvalido,
        rfcRepetido: repetidos,
        deCtasCredito,
        nota: 'Los proveedores del directorio y del calendario de Finanzas los cruza Julia con la ficha (FIN-23).'
    };
};

/* ───────────────────────── lo que lee Julia ───────────────────────── */

/**
 * GET /api/sistemas/v1/proveedores?pagina=&todos= (FIN-23). Por omisión, los proveedores activos que ya tienen ficha;
 * con todos=1, todos los activos. Páginas de 50 (contrato §7.1). Nunca trae importes ni datos de usuarios.
 */
export const proveedoresParaJulia = async ({ pagina = 1, todos = false } = {}) => {
    const POR_PAGINA = 50;
    const p = Math.max(1, Number.parseInt(pagina, 10) || 1);
    const { proveedores, fichas, indice } = await datosParaEmpate();
    const fichaDe = new Map(fichas.map((f) => [f.proveedor_id, f]));
    const credito = await ProveedorCredito.findAll({ where: { vigente: true }, raw: true });
    const creditoDe = new Map();
    for (const c of credito) {
        const e = empatarCredito(c, indice);
        if (e.proveedorId) creditoDe.set(e.proveedorId, { pestana: c.pestana, plazoDias: c.plazo_dias, empate: e.empate });
    }
    const lista = proveedores.filter((x) => x.activo && (todos || fichaDe.has(x.id))).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const pagina_ = lista.slice((p - 1) * POR_PAGINA, p * POR_PAGINA).map((x) => ({
        id: x.id, nombre: x.nombre, rfc: x.rfc || null, ficha: fichaJson(fichaDe.get(x.id)), credito: creditoDe.get(x.id) || null
    }));
    return {
        sistema: 'planta',
        generado: isoMexico(),
        total: lista.length,
        pagina: p,
        siguiente: p * POR_PAGINA < lista.length ? p + 1 : null,
        proveedores: pagina_
    };
};

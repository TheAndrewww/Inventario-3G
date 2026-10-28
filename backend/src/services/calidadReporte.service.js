/**
 * Reporte de calidad de salida (28-oct-2026, «3G Calidad»): el PDF interno que dice cómo sale la obra a instalación.
 * Es solo para Charly, el supervisor (GERAS, MIGUE o MANE) y el instalador; el cliente no lo recibe.
 *
 * - Lo arma el servidor con jsPDF (como utils/ticketPDF.js): logo, obra, ID 3G, cliente, fecha de instalación si se
 *   sabe, qué lleva, cada hoja con sus puntos y estado, los defectos que salen así con su nota, las observaciones para
 *   instalación y quién avaló y cuándo (hora de México). Todo texto libre pasa por sinDatos de la puerta: sin teléfonos,
 *   correos, direcciones ni montos.
 * - Al avalar se encola y se sube a la carpeta de Drive del proyecto con lo que ya sube el ticket de salida
 *   (carpetaDelProyecto, uploadTicket, siguienteIntento y motivoLegible de ticketDrive.service.js), con reintentos cada
 *   10 minutos y espera creciente hasta 7 días (declarado en utils/agendaPlanta.js como pla-calidad-reporte).
 *   Nombre: «CALIDAD - <ID 3G o proyecto> - <AAAA-MM-DD>.pdf». El barrido de Drive lo ignora (no es plano ni ticket).
 * - Sin mensajes de WhatsApp: llega a los supervisores por Operación (la puerta) y por Drive.
 */
import { jsPDF } from 'jspdf';
import { Op } from 'sequelize';
import { CalidadHoja } from '../models/Calidad.js';
import * as S from './calidad.service.js';
import { CONFIG } from './checklistCalidad.js';
import { carpetaDelProyecto, siguienteIntento, motivoLegible } from './ticketDrive.service.js';
import { uploadTicket, driveEscrituraConfigurada } from './googleDrive.service.js';
import { cargarImagenTicket, LOGO_COMPLETO_URL } from '../utils/ticketPDF.js';
import { anotarCorrida } from '../utils/agendaPlanta.js';
import { panelCalidad } from '../utils/banderasCalidad.js';

const MINUTOS_ENTRE_VUELTAS = 10;
const DIAS_REINTENTANDO = 7;
const POR_VUELTA = 20;

const DIA_MX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' });
const HORA_MX = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const ESTADO_TEXTO = { ok: 'Bien', defecto: 'Defecto', na: 'No aplica', pendiente: 'Pendiente' };
const ESTADO_HOJA_TEXTO = {
    sin_revisar: 'Sin revisar', en_revision: 'En revisión', con_defectos: 'Con defectos', lista: 'Lista para avalar', avalada: 'Avalada'
};
const NOMBRE_ATRIBUTO = {
    lleva_membrana: 'Membrana', lleva_estructura: 'Estructura', lleva_costura: 'Costura', lleva_vulcanizado: 'Vulcanizado',
    lleva_cables: 'Cables', lleva_placas_vertice: 'Placas de vértice', lleva_mecanismo: 'Mecanismo (flecha, contrapeso)',
    lleva_rolados: 'Rolados', lleva_placas_base: 'Placas base'
};

/** Helvetica de jsPDF solo trae Latin-1: lo demás se cambia por algo que sí se ve (••• → ***). */
const latin1 = (t) => String(t ?? '')
    .replace(/•/g, '*').replace(/…/g, '...').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[^\x20-\xFF\n]/g, '?');

export const diaDeMexico = (v = new Date()) => DIA_MX.format(v instanceof Date ? v : new Date(v));
export const horaDeMexico = (v) => (v ? HORA_MX.format(new Date(v)) : null);

/** «CALIDAD - 3G-26-0412 - 2026-10-28.pdf» (o con el nombre del proyecto si no tiene ID 3G). */
export const nombreReporte = ({ obraId, proyecto, fecha }) => {
    const quien = obraId || String(proyecto || 'OBRA').replace(/[\\/'"]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return `CALIDAD - ${quien} - ${diaDeMexico(fecha || new Date())}.pdf`;
};

/** Qué lleva la obra, en palabras. */
export const textoQueLleva = (atributos) => {
    if (!atributos) return 'Falta decir qué lleva la obra';
    const si = Object.keys(NOMBRE_ATRIBUTO).filter((k) => atributos[k] === true).map((k) => NOMBRE_ATRIBUTO[k]);
    const acabado = atributos.acabado_estructura ? `acabado de estructura: ${atributos.acabado_estructura}` : null;
    return [...si, acabado].filter(Boolean).join(', ') || 'Nada marcado';
};

/**
 * El PDF del reporte (Buffer). `datos` es la vista de la obra (calidad.service › vistaObra) más `cliente` y
 * `fechaInstalacion`, con el texto libre ya limpio. Pura salvo el logo, que llega ya cargado.
 */
export const armarReporteCalidadPDF = (datos, { logo = null, generado = new Date() } = {}) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true });
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    const m = 16;
    let y = m;
    const nuevaPagina = () => { doc.addPage(); y = m; };
    const espacio = (h) => { if (y + h > alto - 18) nuevaPagina(); };
    const texto = (t, x, opciones = {}) => doc.text(latin1(t), x, y, opciones);
    const parrafo = (t, x, anchoMax, alturaLinea = 4.6) => {
        const lineas = doc.splitTextToSize(latin1(t), anchoMax);
        for (const l of lineas) { espacio(alturaLinea); doc.text(l, x, y); y += alturaLinea; }
    };

    // Encabezado
    if (logo) {
        const w = 46;
        doc.addImage(logo.base64, logo.formato || 'PNG', m, y, w, w / logo.aspectRatio, undefined, 'FAST');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    texto('Reporte de calidad', ancho - m, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    texto('Salida a instalación · uso interno (Calidad, supervisor e instalador)', ancho - m, { align: 'right' });
    y += 12;

    const o = datos.obra || {};
    const h = datos.hoja || {};
    const avalada = h.estado === 'avalada';
    doc.setDrawColor(200);
    doc.line(m, y, ancho - m, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    parrafo(o.proyecto || 'Obra', m, ancho - 2 * m, 6);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const filas = [
        ['ID 3G', o.obraId || 'Sin ID 3G'],
        ['Cliente', datos.cliente || 'Sin dato'],
        ['Fecha de instalación', datos.fechaInstalacion?.fecha || 'Sin fecha'],
        ['Estado de la hoja', ESTADO_HOJA_TEXTO[h.estado] || h.estado || 'Sin revisar'],
        ['Qué lleva', textoQueLleva(h.atributos)]
    ];
    for (const [etiqueta, valor] of filas) {
        espacio(6);
        doc.setFont('helvetica', 'bold');
        texto(`${etiqueta}:`, m);
        doc.setFont('helvetica', 'normal');
        const lineas = doc.splitTextToSize(latin1(valor), ancho - 2 * m - 42);
        lineas.forEach((l, i) => { if (i) { y += 4.6; espacio(5); } doc.text(l, m + 42, y); });
        y += 5.6;
    }
    if (!avalada) {
        y += 2;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(170, 40, 40);
        parrafo('Esta hoja todavía no está avalada: el reporte es una vista previa.', m, ancho - 2 * m);
        doc.setTextColor(0);
    }

    // Cada hoja con sus puntos
    for (const hoja of datos.hojas || []) {
        y += 4;
        espacio(16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        texto(hoja.titulo || hoja.id, m);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        texto('Punto', m);
        texto('Revisión', m + 14);
        texto('Estado', ancho - m - 26);
        y += 2;
        doc.line(m, y, ancho - m, y);
        y += 4.5;
        for (const p of hoja.puntos || []) {
            doc.setFont('helvetica', 'normal');
            const lineas = doc.splitTextToSize(latin1(p.texto), ancho - 2 * m - 14 - 30);
            const nota = p.nota ? doc.splitTextToSize(latin1(`Nota: ${p.nota}${p.estado === 'defecto' ? (p.saleAsi ? ' (sale así a instalación)' : ' (por corregir)') : ''}`), ancho - 2 * m - 14 - 30) : [];
            espacio((lineas.length + nota.length) * 4.2 + 2);
            doc.setFont('helvetica', 'bold');
            doc.text(latin1(p.id), m, y);
            doc.setFont('helvetica', 'normal');
            lineas.forEach((l, i) => doc.text(l, m + 14, y + i * 4.2));
            if (p.estado === 'defecto') doc.setTextColor(170, 40, 40);
            doc.setFont('helvetica', p.estado === 'pendiente' ? 'italic' : 'bold');
            doc.text(latin1(ESTADO_TEXTO[p.estado] || p.estado), ancho - m - 26, y);
            doc.setTextColor(0);
            doc.setFont('helvetica', 'italic');
            nota.forEach((l, i) => doc.text(l, m + 14, y + (lineas.length + i) * 4.2));
            y += (lineas.length + nota.length) * 4.2 + 1.8;
        }
    }
    if (!(datos.hojas || []).length) {
        y += 4;
        parrafo('Ninguna hoja aplica todavía (falta decir qué lleva la obra).', m, ancho - 2 * m);
    }

    // Defectos que salen así
    const salenAsi = (datos.hojas || []).flatMap((hj) => (hj.puntos || []).filter((p) => p.estado === 'defecto' && p.saleAsi));
    y += 5;
    espacio(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    texto('Defectos que salen así a instalación', m);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (!salenAsi.length) parrafo('Ninguno.', m, ancho - 2 * m);
    for (const p of salenAsi) parrafo(`${p.id} · ${p.texto} Nota: ${p.nota || 'sin nota'}`, m, ancho - 2 * m);

    y += 4;
    espacio(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    texto('Observaciones para instalación', m);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    parrafo(h.observacionesInstalacion || 'Sin observaciones.', m, ancho - 2 * m);

    // Firma
    y += 8;
    espacio(24);
    const firma = (datos.hojas || [])[0]?.firma || 'Autoriza';
    doc.setFont('helvetica', 'bold');
    texto(`${firma}:`, m);
    doc.setFont('helvetica', 'normal');
    texto(avalada ? (h.avaladaPor || 'Sin nombre') : 'Sin avalar', m + 22);
    y += 5.5;
    if (avalada) texto(`Avalada el ${horaDeMexico(h.avaladaEn)} (hora de México)`, m);
    if (h.avalNota) { y += 5.5; parrafo(`Nota del aval: ${h.avalNota}`, m, ancho - 2 * m); }

    // Pie en cada página
    const paginas = doc.internal.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(latin1(`3G · Reporte de calidad · versión del checklist ${h.versionConfig || CONFIG.version} · generado ${horaDeMexico(generado)}`), m, alto - 9);
        doc.text(`${i} / ${paginas}`, ancho - m, alto - 9, { align: 'right' });
        doc.setTextColor(0);
    }
    return Buffer.from(doc.output('arraybuffer'));
};

/** La vista de la obra para el reporte, con el cliente y la fecha de instalación, todo limpio con sinDatos. */
export const datosDelReporte = async (ref, { repo, fechaDe } = {}) => {
    const P = await import('../routes/sistemas/produccion.js');
    const v = await S.vistaObra(ref, { repo });
    if (!v.hoja.id) throw new S.ErrorCalidad(404, 'Esta obra todavía no tiene hoja de calidad.');
    const obra = await S.cargarObra(ref, { repo });
    const limpiar = (t, max = 400) => P.sinDatos(t, max);
    const fechaInstalacion = fechaDe ? fechaDe(obra.proyecto) : P.fechaDeObra(obra.proyecto, await P.leerFotoDeBase());
    return {
        ...v,
        obra: { ...v.obra, proyecto: limpiar(v.obra.proyecto, 200) },
        cliente: limpiar(obra.proyecto.cliente, 200),
        fechaInstalacion,
        hoja: {
            ...v.hoja,
            observacionesInstalacion: limpiar(v.hoja.observacionesInstalacion, 2000),
            avalNota: limpiar(v.hoja.avalNota, 1000),
            avaladaPor: limpiar(v.hoja.avaladaPor, 120)
        },
        hojas: v.hojas.map((hj) => ({ ...hj, puntos: hj.puntos.map((p) => ({ ...p, nota: limpiar(p.nota, 600) })) }))
    };
};

const cargarLogo = () => cargarImagenTicket(LOGO_COMPLETO_URL, { formato: 'PNG' });

/** El reporte de una obra ya armado: { pdf, nombreArchivo, datos }. Lo usa GET /obras/:id/reporte.pdf y la subida. */
export const generarReporteDeObra = async (ref, { repo, fechaDe, logo = cargarLogo, generarPDF = armarReporteCalidadPDF } = {}) => {
    const datos = await datosDelReporte(ref, { repo, fechaDe });
    const imagen = typeof logo === 'function' ? await logo().catch(() => null) : logo;
    const pdf = await generarPDF(datos, { logo: imagen });
    const nombreArchivo = nombreReporte({ obraId: datos.obra.obraId, proyecto: datos.obra.proyecto, fecha: datos.hoja.avaladaEn || new Date() });
    return { pdf, nombreArchivo, datos };
};

/**
 * Un intento de subir el reporte de una hoja. { estado: 'subido' | 'sin_carpeta' | 'no_aplica', motivo?, archivo? }.
 * Lanza si Drive falla (procesarReporteCalidad lo cuenta como error para reintentar). Las piezas se cambian en las pruebas.
 */
export const subirReporteCalidad = async (hojaId, piezas = {}) => {
    const {
        repo, cargarHoja = (id) => (repo || S.repoCalidad()).hojaPorId(id), buscarCarpeta = carpetaDelProyecto, subir = uploadTicket,
        escrituraConfigurada = driveEscrituraConfigurada, generar = (ref) => generarReporteDeObra(ref, { repo, fechaDe: piezas.fechaDe, logo: piezas.logo })
    } = piezas;
    const hoja = await cargarHoja(hojaId);
    if (!hoja) return { estado: 'no_aplica', motivo: 'La hoja ya no existe' };
    if (!hoja.avalada_en) return { estado: 'no_aplica', motivo: 'La hoja ya no está avalada (se reabrió)' };
    if (!hoja.proyecto_id) return { estado: 'no_aplica', motivo: 'La hoja ya no está ligada a una obra' };
    if (!escrituraConfigurada()) throw new Error('Drive no está autorizado para subir archivos');
    const obra = await S.cargarObra(hoja.proyecto_id, { repo });
    if (!obra) return { estado: 'no_aplica', motivo: 'La obra ya no está activa' };
    const { carpetaId } = await buscarCarpeta(obra.nombre);
    if (!carpetaId) return { estado: 'sin_carpeta', motivo: `Carpeta del proyecto "${obra.nombre}" no encontrada en Drive` };
    const { pdf, nombreArchivo } = await generar(hoja.proyecto_id);
    const archivo = await subir(carpetaId, pdf, nombreArchivo);
    return { estado: 'subido', archivo, nombreArchivo };
};

/** Qué se guarda en la hoja después de un intento (los campos reporte_*). */
export const cambiosReporteTrasIntento = (hoja, resultado, ahora = new Date()) => {
    const intentos = (hoja.reporte_intentos || 0) + 1;
    if (resultado.estado === 'subido') {
        return { reporte_estado: 'subido', reporte_intentos: intentos, reporte_error: null, reporte_siguiente_intento: null, reporte_archivo_id: resultado.archivo?.id || null };
    }
    if (resultado.estado === 'no_aplica') {
        return { reporte_estado: 'no_aplica', reporte_intentos: intentos, reporte_error: resultado.motivo || null, reporte_siguiente_intento: null };
    }
    return {
        reporte_estado: resultado.estado === 'sin_carpeta' ? 'sin_carpeta' : 'error',
        reporte_intentos: intentos,
        reporte_error: resultado.motivo || null,
        reporte_siguiente_intento: siguienteIntento(intentos, ahora)
    };
};

// Un mismo reporte no se sube dos veces a la vez (el de en seguida y una vuelta de reintentos)
const enCurso = new Set();

/** Intenta subir el reporte de una hoja y guarda cómo le fue. Nunca lanza. */
export const procesarReporteCalidad = async (hojaId, { repo, subirReporte = subirReporteCalidad, ahora = new Date() } = {}) => {
    if (enCurso.has(hojaId)) return null;
    enCurso.add(hojaId);
    try {
        const r = repo || S.repoCalidad();
        const hoja = await r.hojaPorId(hojaId);
        if (!hoja || !['pendiente', 'error', 'sin_carpeta'].includes(hoja.reporte_estado)) return hoja;
        let resultado;
        try {
            resultado = await subirReporte(hojaId, { repo });
        } catch (error) {
            resultado = { estado: 'error', motivo: motivoLegible(error) };
        }
        await r.actualizarHoja(hoja, cambiosReporteTrasIntento(hoja, resultado, ahora));
        if (resultado.estado === 'subido') console.log(`📄 Reporte de calidad de "${hoja.proyecto_nombre}" subido a Drive (${resultado.nombreArchivo || ''})`);
        else console.error(`⚠️ Reporte de calidad de "${hoja.proyecto_nombre}" sin subir [${resultado.estado}]: ${resultado.motivo}`);
        return hoja;
    } catch (error) {
        console.error(`⚠️ Reporte de calidad de la hoja ${hojaId}: no se pudo procesar la subida:`, error.message);
        return null;
    } finally {
        enCurso.delete(hojaId);
    }
};

/** Lo llama el aval: lo sube en seguida, sin hacer esperar a la tableta (la hoja ya quedó en reporte_estado «pendiente»). */
export const encolarReporteCalidad = (hojaId) => {
    setImmediate(() => { procesarReporteCalidad(hojaId); });
    return true;
};

/** Los que fallaron y ya les toca, y los que se quedaron a medias por un reinicio; de los últimos 7 días, 20 por vuelta. */
export const hojasPorReintentar = (ahora = new Date()) => CalidadHoja.findAll({
    where: {
        avalada_en: { [Op.gte]: new Date(ahora.getTime() - DIAS_REINTENTANDO * 86400000) },
        [Op.or]: [
            { reporte_estado: { [Op.in]: ['error', 'sin_carpeta'] }, reporte_siguiente_intento: { [Op.lte]: ahora } },
            { reporte_estado: 'pendiente', updated_at: { [Op.lte]: new Date(ahora.getTime() - 2 * 60000) } }
        ]
    },
    order: [['avalada_en', 'ASC']],
    limit: POR_VUELTA
});

export const reintentarReportesCalidad = async ({ ahora = new Date(), buscar = hojasPorReintentar, procesar = procesarReporteCalidad, pausa = 500 } = {}) => {
    const pendientes = await buscar(ahora);
    for (const hoja of pendientes) {
        await procesar(hoja.id);
        if (pausa) await new Promise((resolve) => setTimeout(resolve, pausa)); // sin saturar la API de Google
    }
    return pendientes.length;
};

/** Reintentos cada 10 minutos (y una vuelta 3 minutos después de arrancar). Solo con PANEL_CALIDAD encendida. */
export const iniciarReintentosReportesCalidad = () => {
    if (!panelCalidad()) return;
    let corriendo = false;
    const vuelta = async () => {
        if (corriendo || !panelCalidad()) return;
        corriendo = true;
        anotarCorrida('pla-calidad-reporte');
        try {
            const n = await reintentarReportesCalidad();
            if (n) console.log(`📄 Reintentos de reportes de calidad a Drive: ${n}`);
        } catch (error) {
            console.error('⚠️ Error en los reintentos de reportes de calidad:', error.message);
        } finally {
            corriendo = false;
        }
    };
    setTimeout(vuelta, 3 * 60000);
    setInterval(vuelta, MINUTOS_ENTRE_VUELTAS * 60000);
    console.log(`📅 Reportes de calidad a Drive (reintentos cada ${MINUTOS_ENTRE_VUELTAS} minutos)`);
};

export default {
    armarReporteCalidadPDF, datosDelReporte, generarReporteDeObra, subirReporteCalidad, cambiosReporteTrasIntento,
    procesarReporteCalidad, encolarReporteCalidad, reintentarReportesCalidad, iniciarReintentosReportesCalidad, nombreReporte
};

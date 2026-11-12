/**
 * Carla · la junta de cierre (11-nov-2026) — Operación lee las ÓRDENES DE PRODUCCIÓN de cada obra.
 *
 * Pedido del jefe: Carla tiene que hablar con conocimiento de la obra («en las carpetas de producción vienen las órdenes,
 * con detalles, materiales, medidas, conexiones…; en los MTO viene marcado si se lava o no»). Operación lista los PDF de
 * la carpeta de PRODUCCIÓN de la obra y baja cada uno para leerlo con IA (allá se guarda el resumen).
 *
 *   GET /api/sistemas/v1/produccion/documentos?proyecto=<id>     (o ?nombre=<texto>)
 *     → { proyectoId, proyecto, etapa, archivos: [{ id, nombre, categoria: 'manufactura'|'herreria', mimeType, modificado }] }
 *       Con ?nombre: la obra activa cuyo nombre coincide (la más reciente); sin coincidencia, 404.
 *   GET /api/sistemas/v1/produccion/documentos/archivo/:archivoId
 *     → el archivo tal cual (PDF), solo si cuelga de la carpeta PRODUCCION y no es de dinero ni de cierre
 *       (obtenerArchivoProduccion lo valida), 25 MB como máximo.
 *
 * Alcance produccion.leer (la pareja #20 de Operación ya lo tiene). Solo lee: nunca escribe en Drive ni en la base.
 * Los tickets de salida de almacén no se listan (no son órdenes de producción).
 */
import { Op } from 'sequelize';
import ProduccionProyecto from '../../models/ProduccionProyecto.js';
import { listarArchivosProduccion, obtenerArchivoProduccion } from '../../services/driveProduccion.service.js';
import { mismosProyectos } from '../../services/pedidosCleanup.service.js';

export const MAX_BYTES = 25 * 1024 * 1024;
const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** Las palabras con las que se busca una obra por nombre (las de 4 letras o más, sin acentos). Pura. */
export const palabrasDeNombre = (nombre) => sinAcentos(nombre).split(/[^A-Z0-9Ñ]+/).filter((w) => w.length >= 4).slice(0, 4);

/** Lo que Operación ve de un archivo (sin ligas de Drive). Pura. */
export const archivoParaOperacion = (a) => ({
    id: a.id,
    nombre: a.nombre,
    categoria: a.categoria,
    mimeType: a.mimeType,
    modificado: a.modificado || a.creado || null
});

async function buscarProyecto({ proyecto, nombre }) {
    const atributos = ['id', 'nombre', 'etapa_actual', 'drive_folder_id'];
    if (proyecto) return ProduccionProyecto.findByPk(Number(proyecto), { attributes: atributos });
    const palabras = palabrasDeNombre(nombre);
    if (!palabras.length) return null;
    const candidatos = await ProduccionProyecto.findAll({
        where: { activo: true, [Op.and]: palabras.map((w) => ({ nombre: { [Op.iLike]: `%${w}%` } })) },
        attributes: atributos,
        order: [['id', 'DESC']],
        limit: 10
    });
    return candidatos.find((c) => mismosProyectos(c.nombre, nombre)) || candidatos[0] || null;
}

/** GET /produccion/documentos → { codigo, cuerpo } */
export async function leerDocumentos(req) {
    const proyecto = String(req.query.proyecto ?? '').trim();
    const nombre = String(req.query.nombre ?? '').trim();
    if (proyecto && !/^\d{1,10}$/.test(proyecto)) return { codigo: 400, cuerpo: { error: 'proyecto debe ser el id numérico.' } };
    if (!proyecto && !nombre) return { codigo: 400, cuerpo: { error: 'Falta proyecto o nombre.' } };
    const p = await buscarProyecto({ proyecto, nombre });
    if (!p) return { codigo: 404, cuerpo: { error: 'No hay una obra con ese id o nombre.' } };
    const base = { proyectoId: p.id, proyecto: p.nombre, etapa: p.etapa_actual };
    if (!p.drive_folder_id) return { codigo: 200, cuerpo: { ...base, archivos: [], aviso: 'La obra no tiene carpeta de producción ligada.' } };
    const { archivos } = await listarArchivosProduccion(p.drive_folder_id);
    return {
        codigo: 200,
        cuerpo: { ...base, archivos: archivos.filter((a) => a.categoria !== 'ticket').map(archivoParaOperacion) }
    };
}

/** GET /produccion/documentos/archivo/:archivoId: manda el archivo (sin tope de 2.8 s: un PDF tarda más). */
export async function mandarDocumento(req, res) {
    const archivoId = String(req.params.archivoId ?? '');
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(archivoId)) return res.status(400).json({ error: 'Id de archivo inválido.' });
    try {
        const archivo = await obtenerArchivoProduccion(archivoId);
        if (!archivo) return res.status(404).json({ error: 'Ese archivo no es de una carpeta de producción.' });
        res.setHeader('Content-Type', archivo.mimeType || 'application/octet-stream');
        res.setHeader('X-Nombre-Archivo', encodeURIComponent(archivo.nombre));
        let bytes = 0;
        archivo.stream.on('data', (c) => {
            bytes += c.length;
            if (bytes > MAX_BYTES) archivo.stream.destroy(new Error('archivo demasiado grande'));
        });
        archivo.stream.on('error', (e) => {
            console.error('[puerta] produccion/documentos/archivo:', e.message);
            if (!res.headersSent) res.status(502).json({ error: 'No se pudo leer el archivo de Drive.' });
            else res.destroy();
        });
        archivo.stream.pipe(res);
    } catch (e) {
        console.error('[puerta] produccion/documentos/archivo:', e.message);
        if (!res.headersSent) res.status(502).json({ error: 'No se pudo leer el archivo de Drive.' });
    }
}

/**
 * Doble en memoria del repositorio de calidad (la misma forma que repoSequelize de services/calidad.service.js), para
 * probar la lógica sin Postgres. Los proyectos son instancias de verdad de ProduccionProyecto (build), con save() que
 * solo cuenta: así regresarEtapa, marcarPreparado y completarSubEtapaProduccion corren su lógica real.
 * Los únicos se respetan como en la base (cambio_id de eventos y puntos; hoja + punto).
 */
const duplicado = (que) => Object.assign(new Error(`duplicado: ${que}`), { codigoDuplicado: true });
const clave = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const crearRepoMemoria = (ProduccionProyecto) => {
    let sec = 0;
    const id = () => ++sec;
    const proyectos = new Map();
    const obraIds = new Map();
    const hojas = [];
    const puntos = [];
    const eventos = [];
    const sugerencias = [];
    const guardados = [];
    let reloj = Date.parse('2026-10-28T15:00:00Z');
    const ahora = () => new Date((reloj += 1000));

    const repo = {
        // ---- para armar los casos ----
        _proyectos: proyectos, _obraIds: obraIds, _hojas: hojas, _puntos: puntos, _eventos: eventos, _sugerencias: sugerencias, _guardados: guardados,
        agregarProyecto(datos, obraId = null) {
            const p = ProduccionProyecto.build({
                prioridad: 3, etapa_actual: 'produccion', activo: true, tiene_manufactura: true, tiene_herreria: true,
                manufactura_completado: false, herreria_completado: false, herreria_armado_completado: false,
                herreria_pintado_completado: false, es_extensivo: false, es_premium: false, pausado: false, ...datos
            }, { isNewRecord: false });
            p.save = async function () { guardados.push({ id: this.id, etapa: this.etapa_actual }); return this; };
            proyectos.set(p.id, p);
            if (obraId) obraIds.set(p.id, obraId);
            return p;
        },
        // ---- la forma de repoSequelize ----
        async proyectoPorId(i) { return proyectos.get(i) || null; },
        async proyectoPorObraId(o) {
            const ids = [...obraIds].filter(([pid, v]) => v === o && proyectos.get(pid)?.activo).map(([pid]) => pid);
            return ids.length === 1 ? proyectos.get(ids[0]) : null;
        },
        async obraIdDe(i) { return obraIds.get(i) || null; },
        async obraIdsDe(ids) { return new Map(ids.filter((i) => obraIds.has(i)).map((i) => [i, obraIds.get(i)])); },
        async proyectoResumen(i) { const p = proyectos.get(i); return p ? { id: p.id, nombre: p.nombre, activo: p.activo } : null; },
        async proyectosActivosPorClave(c, exceptoId = null) {
            return [...proyectos.values()].filter((p) => p.activo && p.id !== exceptoId && clave(p.nombre) === c).map((p) => ({ id: p.id, nombre: p.nombre }));
        },
        async hojaPorId(i) { return hojas.find((h) => h.id === i) || null; },
        async hojaPorObraId(o) { return hojas.filter((h) => h.obra_id === o).sort((a, b) => a.id - b.id)[0] || null; },
        async hojasPorProyectoId(i) { return hojas.filter((h) => h.proyecto_id === i); },
        async hojasPorClave(c) { return hojas.filter((h) => h.proyecto_clave === c); },
        async hojasDeObras({ ids = [], obraIds: oids = [], claves = [] }) {
            return hojas.filter((h) => ids.includes(h.proyecto_id) || (h.obra_id && oids.includes(h.obra_id)) || claves.includes(h.proyecto_clave));
        },
        async hojasAvaladasDesde(desde) { return hojas.filter((h) => h.avalada_en && new Date(h.avalada_en) >= desde); },
        async crearHoja(d) {
            const h = { id: id(), estado: 'sin_revisar', reporte_intentos: 0, created_at: ahora(), ...d };
            hojas.push(h);
            return h;
        },
        async actualizarHoja(h, c) { Object.assign(h, c, { updated_at: ahora() }); return h; },
        async puntos(hojaId) { return puntos.filter((p) => p.hoja_id === hojaId); },
        async puntosDeHojas(ids) { return puntos.filter((p) => ids.includes(p.hoja_id)); },
        async guardarPunto(hojaId, d) {
            if (d.cambio_id && puntos.some((p) => p.cambio_id === d.cambio_id && !(p.hoja_id === hojaId && p.punto_id === d.punto_id))) throw duplicado('cambio_id de punto');
            const fila = puntos.find((p) => p.hoja_id === hojaId && p.punto_id === d.punto_id);
            if (fila) return Object.assign(fila, d);
            const n = { id: id(), hoja_id: hojaId, ...d };
            puntos.push(n);
            return n;
        },
        async eventoPorCambioId(c) { return eventos.find((e) => e.cambio_id === c) || null; },
        async anotarEvento(d) {
            if (d.cambio_id && eventos.some((e) => e.cambio_id === d.cambio_id)) throw duplicado('cambio_id de evento');
            const e = { id: id(), created_at: ahora(), ...d };
            eventos.push(e);
            return e;
        },
        async borrarEvento(i) { const k = eventos.findIndex((e) => e.id === i); if (k >= 0) eventos.splice(k, 1); },
        async eventos(hojaId, limite = 20) { return eventos.filter((e) => e.hoja_id === hojaId).sort((a, b) => b.created_at - a.created_at || b.id - a.id).slice(0, limite); },
        async sugerenciasPendientes(ids) { return sugerencias.filter((s) => ids.includes(s.hoja_id) && s.estado_sugerencia === 'pendiente'); },
        async sugerenciaPorId(i) { return sugerencias.find((s) => s.id === i) || null; },
        async crearSugerencia(d) { const s = { id: id(), created_at: ahora(), ...d }; sugerencias.push(s); return s; },
        async actualizarSugerencia(s, c) { return Object.assign(s, c); },
        async proyectosEnTaller() {
            return [...proyectos.values()].filter((p) => p.activo && ['pendiente', 'diseno', 'compras', 'produccion'].includes(p.etapa_actual)
                && !String(p.tipo_proyecto || '').toUpperCase().startsWith('CANCELADO')
                && (p.etapa_actual === 'produccion' || (p.tiene_manufactura && !p.manufactura_completado) || (p.tiene_herreria && !p.herreria_completado)));
        },
        async proyectosPreparadosDesde(desde) {
            return [...proyectos.values()].filter((p) => p.activo && p.etapa_actual === 'instalacion' && p.instalacion_completado_en && new Date(p.instalacion_completado_en) >= desde);
        },
        async proyectosPorIds(ids) { return ids.map((i) => proyectos.get(i)).filter((p) => p && p.activo); }
    };
    return repo;
};

export default crearRepoMemoria;

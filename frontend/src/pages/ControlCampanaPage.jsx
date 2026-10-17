import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Check, X, Trash2, Save, XCircle, Download, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { campanaControlService } from '../services/campanaControl.service';
import { useAuth } from '../context/AuthContext';
import { useDiseno3G } from '../diseno-3g/useDiseno3G';
import CabG3 from '../diseno-3g/CabG3';
// Rediseño 2 · vista encendida (apagado no la usa): mismos datos, el mismo diálogo de celda y las mismas peticiones
import { useDiseno3G as useDiseno3GR2 } from '../rediseno2/fundacion/useDiseno3G';
import VistaCampana from '../rediseno2/gestion/VistaCampana';

const QUARTERS = [
    { id: 1, name: '1ER TRIMESTRE', weeks: Array.from({ length: 13 }, (_, i) => i + 1) },
    { id: 2, name: '2DO TRIMESTRE', weeks: Array.from({ length: 13 }, (_, i) => i + 14) },
    { id: 3, name: '3ER TRIMESTRE', weeks: Array.from({ length: 13 }, (_, i) => i + 27) },
    { id: 4, name: '4TO TRIMESTRE', weeks: Array.from({ length: 13 }, (_, i) => i + 40) },
];

// Semana ISO del año (lunes a domingo) para saber en qué trimestre estamos hoy.
const semanaActual = () => {
    const d = new Date();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dia = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dia);
    const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - inicio) / 86400000 + 1) / 7);
};

const trimestreActual = () => {
    const semana = semanaActual();
    return QUARTERS.find(q => q.weeks.includes(semana))?.id || 4;
};

const OCULTOS_KEY = 'campanaControl.trimestresOcultos';

// Por defecto se ocultan los trimestres que ya pasaron.
const leerOcultos = () => {
    try {
        const guardado = JSON.parse(localStorage.getItem(OCULTOS_KEY));
        if (Array.isArray(guardado)) return guardado;
    } catch { /* sin almacenamiento */ }
    const actual = trimestreActual();
    return QUARTERS.filter(q => q.id < actual).map(q => q.id);
};

const AREAS = [
    { id: 'ventas_dlba', name: 'VENTAS DLAB', color: 'bg-green-100 text-green-800' },
    { id: 'ventas_vrj', name: 'VENTAS VRJ', color: 'bg-blue-100 text-blue-800' },
    { id: 'diseno', name: 'DISEÑO', color: 'bg-gray-100 text-gray-800' },
    { id: 'manufactura', name: 'MANUFACTURA', color: 'bg-gray-100 text-gray-800' },
    { id: 'herreria', name: 'HERRERIA', color: 'bg-gray-100 text-gray-800' },
    { id: 'equipo1', name: 'EQUIPO 1', color: 'bg-blue-500 text-white' },
    { id: 'equipo2', name: 'EQUIPO 2', color: 'bg-green-500 text-white' },
    { id: 'equipo3', name: 'EQUIPO 3', color: 'bg-gray-500 text-white' },
    { id: 'equipo4', name: 'EQUIPO 4', color: 'bg-orange-500 text-white' },
    { id: 'operacion', name: 'OPERACIÓN', color: 'bg-purple-500 text-white' },
    { id: 'logistica', name: 'LOGÍSTICA', color: 'bg-teal-500 text-white' },
    { id: 'almacen', name: 'ALMACÉN', color: 'bg-amber-500 text-white' },
    { id: 'calidad', name: 'CALIDAD', color: 'bg-cyan-500 text-white' },
];

const ControlCampanaPage = () => {
    const { user } = useAuth();
    const esSoloLectura = ['compras', 'encargado', 'almacen'].includes(user?.rol);
    const g3 = useDiseno3G(); // Diseño 3G: encabezado del paquete, títulos en oración y colores de estado (apagado, lo de siempre)

    const [data, setData] = useState({});
    const [totals, setTotals] = useState({ byQuarter: {}, byArea: {} });
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);
    const [modalData, setModalData] = useState({ status: null, note: '' });
    const [saving, setSaving] = useState(false);
    const [ocultos, setOcultos] = useState(leerOcultos);
    const d3 = useDiseno3GR2(); // Rediseño 2: vista nueva encendida (abajo, antes del return de siempre)
    const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»

    const guardarOcultos = (lista) => {
        setOcultos(lista);
        try { localStorage.setItem(OCULTOS_KEY, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
    };

    const toggleTrimestre = (id) => {
        guardarOcultos(ocultos.includes(id) ? ocultos.filter(x => x !== id) : [...ocultos, id]);
    };

    const soloActual = () => {
        const actual = trimestreActual();
        guardarOcultos(QUARTERS.filter(q => q.id !== actual).map(q => q.id));
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [campaignData, totalsData] = await Promise.all([
                campanaControlService.getAllData(),
                campanaControlService.getTotals()
            ]);

            if (campaignData.success) {
                setData(campaignData.data);
            }

            if (totalsData.success) {
                setTotals(totalsData.totals);
            }
            setErrorCargaR2(null);
        } catch (error) {
            console.error('Error cargando datos:', error);
            toast.error('Error al cargar datos de campaña');
            setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar datos de campaña');
        } finally {
            setLoading(false);
        }
    };

    const getCellKey = (quarter, area, week) => `q${quarter}_${area}_s${week}`;

    const handleCellClick = (quarter, area, week) => {
        const key = getCellKey(quarter, area.id, week);
        const cellData = data[key] || { status: null, note: '' };

        setSelectedCell({ quarter, area, week, key });
        setModalData({
            status: cellData.status || null,
            note: cellData.note || ''
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!selectedCell) return;

        try {
            setSaving(true);
            const { quarter, area, week } = selectedCell;

            const result = await campanaControlService.updateCell(
                quarter,
                area.id,
                week,
                modalData
            );

            if (result.success) {
                // Actualizar estado local para feedback inmediato
                const key = selectedCell.key;

                if (!modalData.status && !modalData.note) {
                    const newData = { ...data };
                    delete newData[key];
                    setData(newData);
                } else {
                    setData(prev => ({
                        ...prev,
                        [key]: { status: modalData.status, note: modalData.note }
                    }));
                }

                // Recargar totales
                const totalsData = await campanaControlService.getTotals();
                if (totalsData.success) {
                    setTotals(totalsData.totals);
                }

                toast.success('Guardado correctamente');
                setModalOpen(false);
            }
        } catch (error) {
            console.error('Error al guardar:', error);
            toast.error('Error al guardar cambios');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedCell) return;

        try {
            setSaving(true);
            const { quarter, area, week } = selectedCell;

            const result = await campanaControlService.deleteCell(quarter, area.id, week);

            if (result.success) {
                const newData = { ...data };
                delete newData[selectedCell.key];
                setData(newData);

                // Recargar totales
                const totalsData = await campanaControlService.getTotals();
                if (totalsData.success) {
                    setTotals(totalsData.totals);
                }

                toast.success('Nota eliminada');
                setModalOpen(false);
            }
        } catch (error) {
            toast.error('Error al eliminar');
        } finally {
            setSaving(false);
        }
    };

    const exportarComentarios = () => {
        const rows = [['TRIMESTRE', 'ÁREA', 'SEMANA', 'ESTADO', 'COMENTARIO']];

        QUARTERS.forEach(quarter => {
            AREAS.forEach(area => {
                quarter.weeks.forEach(week => {
                    const key = getCellKey(quarter.id, area.id, week);
                    const cellData = data[key];
                    if (cellData?.note && cellData.note.trim()) {
                        const estado = cellData.status === 'good' ? 'BIEN' : cellData.status === 'bad' ? 'INCIDENCIA' : 'SIN MARCAR';
                        const nota = cellData.note.trim().replace(/\n/g, ' | ');
                        rows.push([quarter.name, area.name, `Semana ${week}`, estado, nota]);
                    }
                });
            });
        });

        if (rows.length === 1) {
            toast.error('No hay comentarios para exportar');
            return;
        }

        const csvContent = '\uFEFF' + rows.map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Comentarios_Campana_2026.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`${rows.length - 1} comentarios exportados`);
    };

    const getQuarterTotal = (quarterId, type) => {
        return totals.byQuarter?.[quarterId]?.[type] || 0;
    };

    const getAreaSubtotal = (areaId, quarterId, type) => {
        return totals.byArea?.[areaId]?.[quarterId]?.[type] || 0;
    };

    // Calificación en %: puntos buenos sobre el total registrado (buenos + malos).
    // null cuando no hay puntos capturados todavía.
    const getPct = (good, bad) => {
        const total = (good || 0) + (bad || 0);
        if (total === 0) return null;
        return Math.round((good / total) * 100);
    };

    // Calificación del 1 al 10 a partir del porcentaje (69% -> 6.9).
    const formatCalif = (pct) => (pct === null ? '—' : (pct / 10).toFixed(1));

    // Colores tipo semáforo para la calificación (fondo claro, texto fuerte).
    const pctClasses = (pct) => {
        if (pct === null) return 'bg-gray-50 text-gray-400';
        if (pct >= 80) return 'bg-green-50 text-green-700';
        if (pct >= 50) return 'bg-yellow-50 text-yellow-700';
        return 'bg-red-50 text-red-700';
    };

    // Rediseño 2 · vista ENCENDIDA: los mismos datos y los mismos manejadores (el JSX de hoy sigue intacto debajo)
    if (d3) {
        return (
            <VistaCampana
                esSoloLectura={esSoloLectura} data={data} loading={loading} errorCarga={errorCargaR2} recargar={loadData} modalOpen={modalOpen}
                setModalOpen={setModalOpen} selectedCell={selectedCell} modalData={modalData} setModalData={setModalData} saving={saving}
                ocultos={ocultos} toggleTrimestre={toggleTrimestre} soloActual={soloActual} guardarOcultos={guardarOcultos}
                handleCellClick={handleCellClick} handleSave={handleSave} handleDelete={handleDelete} exportarComentarios={exportarComentarios}
                getCellKey={getCellKey} getQuarterTotal={getQuarterTotal} getAreaSubtotal={getAreaSubtotal} getPct={getPct} formatCalif={formatCalif}
                QUARTERS={QUARTERS} AREAS={AREAS} semanaHoy={semanaActual()} trimestreHoy={trimestreActual()}
            />
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-red-600" />
            </div>
        );
    }

    return (
        <div className="p-2 md:p-8 max-w-[1920px] mx-auto bg-gray-50 min-h-screen g3:!bg-transparent g3:!min-h-0 g3:!p-4 g3:md:!p-6">
            <header className={g3 ? 'g3-pila g3p-cab' : 'flex flex-col sm:flex-row items-center justify-between mb-4 md:mb-8 pb-4 border-b-4 border-red-700 bg-white p-4 md:p-6 rounded-lg shadow-sm gap-4'}>
                {g3 ? (
                    <div className="g3-cab">
                        <div>
                            <h1>Campaña de control 2026</h1>
                            <p>Cada semana se califica a cada área como bien o mal, con una nota opcional. {esSoloLectura ? 'Toca un cuadro para ver su calificación y su nota.' : 'Toca un cuadro para calificar.'}</p>
                        </div>
                    </div>
                ) : (
                <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-start">
                    <img src="/logo-3g.png" alt="3G Logo" className="h-8 md:h-12 w-auto" onError={(e) => e.target.style.display = 'none'} />
                    <h1 className="text-xl md:text-3xl font-bold text-gray-800 text-center sm:text-left">
                        CAMPAÑA DE <span className="text-red-700">CONTROL</span> 2026
                    </h1>
                </div>
                )}
                <div className={g3 ? 'g3-cab-acciones' : 'flex flex-wrap items-center justify-center gap-2'}>
                <button
                    onClick={soloActual}
                    className={g3 ? 'g3-btn g3-btn--ch' : 'bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-all text-sm md:text-base'}
                >
                    Solo trimestre actual
                </button>
                <button
                    onClick={() => guardarOcultos([])}
                    className={g3 ? 'g3-btn g3-btn--ch' : 'bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-all text-sm md:text-base'}
                >
                    Mostrar todos
                </button>
                <button
                    onClick={exportarComentarios}
                    className={g3 ? 'g3-btn g3-btn--tonal g3-btn--ch' : 'bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 active:transform active:scale-95 transition-all flex items-center gap-2 shadow-md text-sm md:text-base'}
                >
                    <Download className="w-4 h-4 md:w-5 md:h-5" />
                    {g3 ? 'Exportar comentarios' : 'Exportar Comentarios'}
                </button>
                </div>
            </header>

            <div className="space-y-6 md:space-y-8 pb-20">
                {QUARTERS.map(quarter => ocultos.includes(quarter.id) ? (
                    <button
                        key={quarter.id}
                        onClick={() => toggleTrimestre(quarter.id)}
                        className="w-full bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                    >
                        <span className="flex items-center gap-2 font-bold text-gray-600 text-sm md:text-base">
                            <ChevronRight className="w-5 h-5" />
                            {quarter.name}
                            <span className="text-xs font-normal text-gray-400">(oculto · clic para mostrar)</span>
                        </span>
                        <span className="flex items-center gap-2 text-xs md:text-sm font-bold">
                            <span className="text-green-700">✓ {getQuarterTotal(quarter.id, 'good')}</span>
                            <span className="text-red-700">✗ {getQuarterTotal(quarter.id, 'bad')}</span>
                            {(() => {
                                const pct = getPct(getQuarterTotal(quarter.id, 'good'), getQuarterTotal(quarter.id, 'bad'));
                                return <span className={`px-2 py-0.5 rounded ${pctClasses(pct)}`}>{g3 ? 'Calificación' : 'CAL'} {formatCalif(pct)}</span>;
                            })()}
                        </span>
                    </button>
                ) : (
                    <section key={quarter.id} className="bg-white rounded-lg shadow-md overflow-hidden relative pl-0 md:pl-12 border border-gray-200">
                        <button
                            onClick={() => toggleTrimestre(quarter.id)}
                            title="Ocultar trimestre"
                            className="hidden md:flex absolute left-0 top-0 bottom-0 w-12 flex-col items-center justify-center gap-10 bg-gray-100 border-r border-gray-200 hover:bg-gray-200 transition-colors"
                        >
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                            <div className="-rotate-90 whitespace-nowrap text-sm font-bold text-gray-500 tracking-wider">
                                {quarter.name}
                            </div>
                        </button>
                        <button
                            onClick={() => toggleTrimestre(quarter.id)}
                            className="md:hidden w-full flex items-center justify-center gap-2 py-2 font-bold text-red-700 bg-red-50 border-b border-red-100 text-lg sticky top-0 z-20 g3:!text-g3-primario g3:!bg-g3-primario-tinte g3:!border-g3-linea"
                        >
                            <ChevronDown className="w-5 h-5" />
                            {quarter.name}
                        </button>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse min-w-[max-content]">
                                <thead>
                                    <tr>
                                        <th className="bg-red-700 text-white p-2 md:p-3 text-xs md:text-sm w-24 md:w-32 sticky left-0 z-20 shadow-md g3:!bg-g3-contenedor-alto g3:!text-g3-tinta g3:!border-g3-linea-fuerte">{g3 ? 'Área' : 'AREA'}</th>
                                        {quarter.weeks.map(week => (
                                            <th key={week} className="bg-red-700 text-white border border-red-600 p-1 text-[10px] md:text-xs w-8 md:w-10 min-w-[32px] g3:!bg-g3-contenedor-alto g3:!text-g3-tinta g3:!border-g3-linea-fuerte">
                                                S{week}
                                            </th>
                                        ))}
                                        <th className="bg-green-600 text-white border border-green-500 p-1 text-xs md:text-sm w-10 md:w-14 min-w-[40px] sticky right-[80px] md:right-[112px] z-10 shadow-sm">✓</th>
                                        <th className="bg-red-700 text-white border border-red-800 p-1 text-xs md:text-sm w-10 md:w-14 min-w-[40px] sticky right-[40px] md:right-[56px] z-10 shadow-sm g3:!bg-g3-mal g3:!text-g3-sobre-mal">✗</th>
                                        <th className="bg-blue-700 text-white border border-blue-800 p-1 text-xs md:text-sm w-10 md:w-14 min-w-[40px] sticky right-0 z-10 shadow-md g3:!bg-g3-contenedor-alto g3:!text-g3-tinta g3:!border-g3-linea-fuerte" title={g3 ? 'Calificación' : undefined}>CAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {AREAS.map(area => (
                                        <tr key={area.id}>
                                            <td className={`${area.color} p-2 text-[10px] md:text-xs font-bold border border-gray-300 sticky left-0 z-20 shadow-md`}>
                                                {area.name}
                                            </td>
                                            {quarter.weeks.map(week => {
                                                const key = getCellKey(quarter.id, area.id, week);
                                                const cellData = data[key];
                                                let cellClass = "border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors h-10 md:h-12 w-8 md:w-10 text-center relative text-sm md:text-base";

                                                if (cellData?.status === 'good') cellClass += " bg-green-500 text-white font-bold";
                                                if (cellData?.status === 'bad') cellClass += " bg-red-600 text-white font-bold";

                                                return (
                                                    <td
                                                        key={week}
                                                        className={cellClass}
                                                        onClick={() => handleCellClick(quarter.id, area, week)}
                                                    >
                                                        {cellData?.status === 'good' && '✓'}
                                                        {cellData?.status === 'bad' && '✗'}
                                                        {cellData?.note && (
                                                            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-yellow-400 rounded-full border border-white shadow-sm"></div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="border border-gray-300 bg-gray-50 text-center font-bold text-green-700 sticky right-[80px] md:right-[112px] z-10 shadow-sm text-sm">
                                                {getAreaSubtotal(area.id, quarter.id, 'good')}
                                            </td>
                                            <td className="border border-gray-300 bg-gray-50 text-center font-bold text-red-700 sticky right-[40px] md:right-[56px] z-10 shadow-sm text-sm">
                                                {getAreaSubtotal(area.id, quarter.id, 'bad')}
                                            </td>
                                            {(() => {
                                                const pct = getPct(
                                                    getAreaSubtotal(area.id, quarter.id, 'good'),
                                                    getAreaSubtotal(area.id, quarter.id, 'bad')
                                                );
                                                return (
                                                    <td className={`border border-gray-300 text-center font-bold sticky right-0 z-10 shadow-md text-sm ${pctClasses(pct)}`}>
                                                        {formatCalif(pct)}
                                                    </td>
                                                );
                                            })()}
                                        </tr>
                                    ))}
                                    <tr className="bg-red-800 text-white font-bold g3:!bg-g3-contenedor g3:!text-g3-tinta">
                                        <td colSpan={14} className="p-2 text-right sticky left-0 bg-red-800 z-20 text-xs md:text-sm shadow-md g3:!bg-g3-contenedor g3:!text-g3-tinta">{g3 ? 'Trimestre' : 'TRIM'} {quarter.id}</td>
                                        <td className="p-2 text-center bg-green-700 text-sm md:text-base sticky right-[80px] md:right-[112px] z-10 shadow-sm">
                                            {getQuarterTotal(quarter.id, 'good')}
                                        </td>
                                        <td className="p-2 text-center bg-red-900 text-sm md:text-base sticky right-[40px] md:right-[56px] z-10 shadow-sm g3:!bg-g3-mal g3:!text-g3-sobre-mal">
                                            {getQuarterTotal(quarter.id, 'bad')}
                                        </td>
                                        <td className="p-2 text-center bg-blue-800 text-sm md:text-base sticky right-0 z-10 shadow-md g3:!bg-g3-contenedor g3:!text-g3-tinta">
                                            {formatCalif(getPct(getQuarterTotal(quarter.id, 'good'), getQuarterTotal(quarter.id, 'bad')))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))}
            </div>

            {/* Modal */}
            {modalOpen && selectedCell && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                {selectedCell.area.name} - Semana {selectedCell.week}
                                {esSoloLectura && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                                        <Eye className="w-3 h-3" /> Solo lectura
                                    </span>
                                )}
                            </h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => !esSoloLectura && setModalData({ ...modalData, status: null })}
                                    disabled={esSoloLectura}
                                    className={`p-3 rounded-lg border-2 font-bold transition-all ${modalData.status === null
                                        ? 'border-gray-800 bg-gray-100 text-gray-800 ring-2 ring-gray-200'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                                        } ${esSoloLectura ? 'cursor-not-allowed opacity-60 hover:border-gray-200' : ''}`}
                                >
                                    Sin marcar
                                </button>
                                <button
                                    onClick={() => !esSoloLectura && setModalData({ ...modalData, status: 'good' })}
                                    disabled={esSoloLectura}
                                    className={`p-3 rounded-lg border-2 font-bold transition-all flex items-center justify-center gap-2 ${modalData.status === 'good'
                                        ? 'border-green-600 bg-green-50 text-green-700 ring-2 ring-green-100'
                                        : 'border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600'
                                        } ${esSoloLectura ? 'cursor-not-allowed opacity-60 hover:border-gray-200 hover:text-gray-500' : ''}`}
                                >
                                    <Check className="w-5 h-5" /> Bien
                                </button>
                                <button
                                    onClick={() => !esSoloLectura && setModalData({ ...modalData, status: 'bad' })}
                                    disabled={esSoloLectura}
                                    className={`p-3 rounded-lg border-2 font-bold transition-all flex items-center justify-center gap-2 ${modalData.status === 'bad'
                                        ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100'
                                        : 'border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600'
                                        } ${esSoloLectura ? 'cursor-not-allowed opacity-60 hover:border-gray-200 hover:text-gray-500' : ''}`}
                                >
                                    <X className="w-5 h-5" /> Mal
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Nota / Observación:
                                </label>
                                <textarea
                                    value={modalData.note}
                                    onChange={(e) => setModalData({ ...modalData, note: e.target.value })}
                                    readOnly={esSoloLectura}
                                    className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none resize-none h-32 ${esSoloLectura ? 'bg-gray-50 cursor-default' : ''}`}
                                    placeholder={esSoloLectura ? '— Sin nota —' : 'Escribe una nota explicativa (opcional)...'}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-between items-center">
                            {esSoloLectura ? (
                                <div className="w-full flex justify-end">
                                    <button
                                        onClick={() => setModalOpen(false)}
                                        className="px-6 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={handleDelete}
                                        disabled={saving || (!data[selectedCell.key] && !modalData.note)}
                                        className="text-red-600 hover:text-red-800 hover:bg-red-50 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="w-4 h-4" /> Eliminar
                                    </button>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setModalOpen(false)}
                                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-semibold transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="bg-red-700 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-800 active:transform active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-red-200"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Guardar
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControlCampanaPage;

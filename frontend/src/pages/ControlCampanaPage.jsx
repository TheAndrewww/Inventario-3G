import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { campanaControlService } from '../services/campanaControl.service';
import { useAuth } from '../context/AuthContext';
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

    const [data, setData] = useState({});
    const [totals, setTotals] = useState({ byQuarter: {}, byArea: {} });
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);
    const [modalData, setModalData] = useState({ status: null, note: '' });
    const [saving, setSaving] = useState(false);
    const [ocultos, setOcultos] = useState(leerOcultos);
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
};

export default ControlCampanaPage;

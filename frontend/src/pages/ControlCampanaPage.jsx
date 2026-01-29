import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Check, X, Trash2, Save, XCircle } from 'lucide-react';
import { campanaControlService } from '../services/campanaControl.service';

const QUARTERS = [
    { id: 1, name: '1ER TRIMESTRE', weeks: Array.from({ length: 13 }, (_, i) => i + 1) },
    { id: 2, name: '2DO TRIMESTRE', weeks: Array.from({ length: 13 }, (_, i) => i + 14) },
    { id: 3, name: '3ER TRIMESTRE', weeks: Array.from({ length: 13 }, (_, i) => i + 27) },
    { id: 4, name: '4TO TRIMESTRE', weeks: Array.from({ length: 13 }, (_, i) => i + 40) },
];

const AREAS = [
    { id: 'ventas_dlba', name: 'VENTAS DLBA', color: 'bg-gray-100 text-gray-800' },
    { id: 'ventas_vrj', name: 'VENTAS VRJ', color: 'bg-gray-100 text-gray-800' },
    { id: 'diseno', name: 'DISEÑO', color: 'bg-gray-100 text-gray-800' },
    { id: 'manufactura', name: 'MANUFACTURA', color: 'bg-gray-100 text-gray-800' },
    { id: 'herreria', name: 'HERRERIA', color: 'bg-gray-100 text-gray-800' },
    { id: 'equipo1', name: 'EQUIPO 1', color: 'bg-blue-500 text-white' },
    { id: 'equipo2', name: 'EQUIPO 2', color: 'bg-green-500 text-white' },
    { id: 'equipo3', name: 'EQUIPO 3', color: 'bg-gray-500 text-white' },
    { id: 'equipo4', name: 'EQUIPO 4', color: 'bg-orange-500 text-white' },
];

const ControlCampanaPage = () => {
    const [data, setData] = useState({});
    const [totals, setTotals] = useState({ byQuarter: {}, byArea: {} });
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);
    const [modalData, setModalData] = useState({ status: null, note: '' });
    const [saving, setSaving] = useState(false);

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
        } catch (error) {
            console.error('Error cargando datos:', error);
            toast.error('Error al cargar datos de campaña');
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

    const getQuarterTotal = (quarterId, type) => {
        return totals.byQuarter?.[quarterId]?.[type] || 0;
    };

    const getAreaSubtotal = (areaId, quarterId, type) => {
        return totals.byArea?.[areaId]?.[quarterId]?.[type] || 0;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-red-600" />
            </div>
        );
    }

    return (
        <div className="p-2 md:p-8 max-w-[1920px] mx-auto bg-gray-50 min-h-screen">
            <header className="flex flex-col sm:flex-row items-center justify-between mb-4 md:mb-8 pb-4 border-b-4 border-red-700 bg-white p-4 md:p-6 rounded-lg shadow-sm gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-start">
                    <img src="/logo-3g.png" alt="3G Logo" className="h-8 md:h-12 w-auto" onError={(e) => e.target.style.display = 'none'} />
                    <h1 className="text-xl md:text-3xl font-bold text-gray-800 text-center sm:text-left">
                        CAMPAÑA DE <span className="text-red-700">CONTROL</span> 2026
                    </h1>
                </div>
            </header>

            <div className="space-y-6 md:space-y-8 pb-20">
                {QUARTERS.map(quarter => (
                    <section key={quarter.id} className="bg-white rounded-lg shadow-md overflow-hidden relative pl-0 md:pl-12 border border-gray-200">
                        <div className="hidden md:flex absolute left-0 top-0 bottom-0 w-12 items-center justify-center bg-gray-100 border-r border-gray-200">
                            <div className="-rotate-90 whitespace-nowrap text-sm font-bold text-gray-500 tracking-wider">
                                {quarter.name}
                            </div>
                        </div>
                        <div className="md:hidden text-center py-2 font-bold text-red-700 bg-red-50 border-b border-red-100 text-lg sticky top-0 z-20">
                            {quarter.name}
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse min-w-[max-content]">
                                <thead>
                                    <tr>
                                        <th className="bg-red-700 text-white p-2 md:p-3 text-xs md:text-sm w-24 md:w-32 sticky left-0 z-20 shadow-md">AREA</th>
                                        {quarter.weeks.map(week => (
                                            <th key={week} className="bg-red-700 text-white border border-red-600 p-1 text-[10px] md:text-xs w-8 md:w-10 min-w-[32px]">
                                                S{week}
                                            </th>
                                        ))}
                                        <th className="bg-green-600 text-white border border-green-500 p-1 text-xs md:text-sm w-10 md:w-14 min-w-[40px] sticky right-[40px] md:right-[56px] z-10 shadow-sm">✓</th>
                                        <th className="bg-red-700 text-white border border-red-800 p-1 text-xs md:text-sm w-10 md:w-14 min-w-[40px] sticky right-0 z-10 shadow-md">✗</th>
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
                                            <td className="border border-gray-300 bg-gray-50 text-center font-bold text-green-700 sticky right-[40px] md:right-[56px] z-10 shadow-sm text-sm">
                                                {getAreaSubtotal(area.id, quarter.id, 'good')}
                                            </td>
                                            <td className="border border-gray-300 bg-gray-50 text-center font-bold text-red-700 sticky right-0 z-10 shadow-md text-sm">
                                                {getAreaSubtotal(area.id, quarter.id, 'bad')}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-red-800 text-white font-bold">
                                        <td colSpan={14} className="p-2 text-right sticky left-0 bg-red-800 z-20 text-xs md:text-sm shadow-md">TRIM {quarter.id}</td>
                                        <td className="p-2 text-center bg-green-700 text-sm md:text-base sticky right-[40px] md:right-[56px] z-10 shadow-sm">
                                            {getQuarterTotal(quarter.id, 'good')}
                                        </td>
                                        <td className="p-2 text-center bg-red-900 text-sm md:text-base sticky right-0 z-10 shadow-md">
                                            {getQuarterTotal(quarter.id, 'bad')}
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
                            <h3 className="text-lg font-bold text-gray-800">
                                {selectedCell.area.name} - Semana {selectedCell.week}
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
                                    onClick={() => setModalData({ ...modalData, status: null })}
                                    className={`p-3 rounded-lg border-2 font-bold transition-all ${modalData.status === null
                                        ? 'border-gray-800 bg-gray-100 text-gray-800 ring-2 ring-gray-200'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                                        }`}
                                >
                                    Sin marcar
                                </button>
                                <button
                                    onClick={() => setModalData({ ...modalData, status: 'good' })}
                                    className={`p-3 rounded-lg border-2 font-bold transition-all flex items-center justify-center gap-2 ${modalData.status === 'good'
                                        ? 'border-green-600 bg-green-50 text-green-700 ring-2 ring-green-100'
                                        : 'border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600'
                                        }`}
                                >
                                    <Check className="w-5 h-5" /> Bien
                                </button>
                                <button
                                    onClick={() => setModalData({ ...modalData, status: 'bad' })}
                                    className={`p-3 rounded-lg border-2 font-bold transition-all flex items-center justify-center gap-2 ${modalData.status === 'bad'
                                        ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100'
                                        : 'border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600'
                                        }`}
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
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none resize-none h-32"
                                    placeholder="Escribe una nota explicativa (opcional)..."
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-between items-center">
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControlCampanaPage;

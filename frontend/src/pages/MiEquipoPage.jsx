import React, { useState, useEffect } from 'react';
import {
    Wrench,
    Truck,
    AlertTriangle,
    CheckCircle,
    Clock,
    User,
    Package,
    AlertCircle,
    ChevronRight,
    RefreshCw
} from 'lucide-react';
import miEquipoService from '../services/miEquipo.service';
import { Loader, Button } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUtils';
import toast from 'react-hot-toast';

const MiEquipoPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await miEquipoService.obtenerMiEquipo();
            setData(response);
        } catch (error) {
            console.error('Error al cargar datos:', error);
            toast.error('Error al cargar tus datos');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        toast.success('Datos actualizados');
    };

    const getCondicionBadge = (condicion) => {
        const badges = {
            bueno: { color: 'bg-green-100 text-green-800 border-green-200', icon: '🟢' },
            regular: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🟡' },
            malo: { color: 'bg-red-100 text-red-800 border-red-200', icon: '🔴' }
        };
        const badge = badges[condicion] || badges.bueno;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}>
                {badge.icon} {condicion || 'Bueno'}
            </span>
        );
    };

    if (loading) {
        return <Loader fullScreen />;
    }

    const { stats, herramientas, camionetas } = data || { stats: {}, herramientas: [], camionetas: [] };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <User className="text-red-700" size={32} />
                        Mi Equipo
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Bienvenido, <span className="font-medium">{user?.nombre}</span>
                    </p>
                </div>
                <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    variant="secondary"
                    className="flex items-center gap-2"
                >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    Actualizar
                </Button>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Mis Herramientas</p>
                            <p className="text-3xl font-bold text-gray-900">{stats.totalHerramientas || 0}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <Wrench className="text-blue-600" size={28} />
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded">🟢 {stats.herramientasPorCondicion?.bueno || 0}</span>
                        <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded">🟡 {stats.herramientasPorCondicion?.regular || 0}</span>
                        <span className="px-2 py-1 bg-red-50 text-red-700 rounded">🔴 {stats.herramientasPorCondicion?.malo || 0}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Mis Camionetas</p>
                            <p className="text-3xl font-bold text-gray-900">{stats.totalCamionetas || 0}</p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-xl">
                            <Truck className="text-purple-600" size={28} />
                        </div>
                    </div>
                    {stats.totalCamionetas > 0 && (
                        <p className="mt-3 text-xs text-gray-500">
                            Eres encargado de {stats.totalCamionetas} camioneta{stats.totalCamionetas > 1 ? 's' : ''}
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Alertas Stock</p>
                            <p className="text-3xl font-bold text-gray-900">{stats.alertasStock || 0}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${stats.alertasStock > 0 ? 'bg-orange-100' : 'bg-green-100'}`}>
                            {stats.alertasStock > 0 ? (
                                <AlertTriangle className="text-orange-600" size={28} />
                            ) : (
                                <CheckCircle className="text-green-600" size={28} />
                            )}
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                        {stats.alertasStock > 0 ? 'Herramientas faltantes en camionetas' : 'Todo en orden'}
                    </p>
                </div>
            </div>

            {/* Mis Herramientas */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Wrench size={20} className="text-blue-600" />
                        Mis Herramientas Asignadas
                    </h2>
                </div>
                <div className="p-4">
                    {herramientas.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Package size={48} className="mx-auto mb-3 opacity-50" />
                            <p>No tienes herramientas asignadas</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {herramientas.map((herramienta) => (
                                <div
                                    key={herramienta.id}
                                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {herramienta.tipoHerramienta?.imagen_url ? (
                                                <img
                                                    src={getImageUrl(herramienta.tipoHerramienta.imagen_url)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <Wrench className="text-blue-600" size={24} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">
                                                {herramienta.tipoHerramienta?.nombre || 'Herramienta'}
                                            </p>
                                            <p className="text-sm font-mono text-gray-600">
                                                {herramienta.codigo_unico}
                                            </p>
                                            <div className="mt-2 flex items-center gap-2">
                                                {getCondicionBadge(herramienta.condicion)}
                                            </div>
                                            {herramienta.fecha_asignacion && (
                                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                    <Clock size={12} />
                                                    Desde: {new Date(herramienta.fecha_asignacion).toLocaleDateString('es-MX')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Mis Camionetas - Solo si tiene alguna */}
            {camionetas.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Truck size={20} className="text-purple-600" />
                            Mis Camionetas a Cargo
                        </h2>
                    </div>
                    <div className="p-4">
                        <div className="space-y-4">
                            {camionetas.map((camioneta) => (
                                <div
                                    key={camioneta.id}
                                    className={`border rounded-lg p-4 ${camioneta.stockCompleto
                                            ? 'border-green-200 bg-green-50'
                                            : 'border-orange-200 bg-orange-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${camioneta.stockCompleto ? 'bg-green-100' : 'bg-orange-100'
                                                }`}>
                                                <Truck size={24} className={
                                                    camioneta.stockCompleto ? 'text-green-600' : 'text-orange-600'
                                                } />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    {camioneta.nombre}
                                                </p>
                                                {camioneta.matricula && (
                                                    <p className="text-sm text-gray-600">
                                                        Placas: {camioneta.matricula}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {camioneta.stockCompleto ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                                    <CheckCircle size={16} />
                                                    Stock completo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                                                    <AlertTriangle size={16} />
                                                    {camioneta.alertas.length} alerta{camioneta.alertas.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span>📦 {camioneta.inventarioActual} herramientas</span>
                                        <span>📋 {camioneta.stockMinimoConfigurado} tipos configurados</span>
                                    </div>

                                    {/* Alertas de faltantes */}
                                    {camioneta.alertas.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-orange-200">
                                            <p className="text-sm font-medium text-orange-800 mb-2">
                                                ⚠️ Herramientas faltantes:
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {camioneta.alertas.map((alerta, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                                                        <span className="text-gray-700">{alerta.tipo}</span>
                                                        <span className="font-medium text-orange-600">
                                                            -{alerta.faltantes} ({alerta.actual}/{alerta.minimo})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MiEquipoPage;

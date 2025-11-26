import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Download, Barcode } from 'lucide-react';
import herramientasRentaService from '../services/herramientasRenta.service';
import { Button } from '../components/common';
import toast from 'react-hot-toast';

const ImpresionCodigosHerramientasPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [unidades, setUnidades] = useState([]);
    const [generandoCodigos, setGenerandoCodigos] = useState(false);
    const [tipo, setTipo] = useState(null);

    useEffect(() => {
        const { tipo: tipoParam, unidades: unidadesParam } = location.state || {};

        if (!tipoParam || !unidadesParam || unidadesParam.length === 0) {
            toast.error('No hay unidades para imprimir');
            navigate('/herramientas-renta');
            return;
        }

        setTipo(tipoParam);
        setUnidades(unidadesParam);
    }, [location, navigate]);

    const generarCodigosAutomaticamente = async () => {
        try {
            setGenerandoCodigos(true);

            // Generar códigos masivamente para todas las unidades del tipo
            await herramientasRentaService.generarCodigosMasivos(tipo.id);

            toast.success('Códigos generados exitosamente');

            // Recargar las unidades para obtener los códigos recién generados
            const data = await herramientasRentaService.obtenerUnidadesPorTipo(tipo.id);
            setUnidades(data.unidades || []);

        } catch (error) {
            console.error('Error al generar códigos:', error);
            toast.error(error.message || 'Error al generar códigos');
        } finally {
            setGenerandoCodigos(false);
        }
    };

    const handleImprimir = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header - No se imprime */}
            <div className="print:hidden bg-white shadow-sm border-b p-4 mb-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={() => navigate('/herramientas-renta')}
                            variant="secondary"
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft size={20} />
                            Volver
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Impresión de Códigos de Barras
                            </h1>
                            <p className="text-gray-600">
                                {tipo?.nombre} - {unidades.length} unidades
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={generarCodigosAutomaticamente}
                            disabled={generandoCodigos}
                            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                        >
                            <Barcode size={20} />
                            {generandoCodigos ? 'Generando...' : 'Generar Códigos EAN-13'}
                        </Button>
                        <Button
                            onClick={handleImprimir}
                            className="bg-red-700 hover:bg-red-800 flex items-center gap-2"
                        >
                            <Printer size={20} />
                            Imprimir
                        </Button>
                    </div>
                </div>
            </div>

            {/* Contenido para imprimir */}
            <div className="max-w-7xl mx-auto p-4">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    {/* Título de la hoja - Solo visible al imprimir */}
                    <div className="hidden print:block mb-6 text-center border-b-2 border-gray-300 pb-4">
                        <h2 className="text-xl font-bold text-gray-900">
                            Códigos de Barras - {tipo?.nombre}
                        </h2>
                        <p className="text-sm text-gray-600">
                            {new Date().toLocaleDateString('es-MX', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </p>
                    </div>

                    {/* Grid de códigos de barras - 3 columnas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:gap-2">
                        {unidades.map((unidad) => (
                            <div
                                key={unidad.id}
                                className="border-2 border-gray-300 rounded-lg p-4 print:p-3 flex flex-col items-center justify-center bg-white print:break-inside-avoid"
                                style={{ pageBreakInside: 'avoid' }}
                            >
                                {/* Nombre del tipo */}
                                <h3 className="text-sm font-bold text-gray-900 mb-2 text-center">
                                    {tipo?.nombre}
                                </h3>

                                {/* Código único */}
                                <p className="text-lg font-mono font-bold text-red-700 mb-3">
                                    {unidad.codigo_unico}
                                </p>

                                {/* Código de barras */}
                                {unidad.codigo_ean13 ? (
                                    <div className="flex flex-col items-center">
                                        <img
                                            src={herramientasRentaService.getURLCodigoBarras(unidad.id)}
                                            alt={`Código de barras ${unidad.codigo_unico}`}
                                            className="max-w-full h-auto"
                                            style={{ width: '200px' }}
                                        />
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-gray-500">
                                            Sin código EAN-13
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Genera códigos masivos
                                        </p>
                                    </div>
                                )}

                                {/* Número de serie si existe */}
                                {unidad.numero_serie && (
                                    <p className="text-xs text-gray-600 mt-2">
                                        S/N: {unidad.numero_serie}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer solo visible al imprimir */}
                    <div className="hidden print:block mt-6 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
                        <p>Sistema de Inventario 3G - Herramientas de Renta</p>
                        <p>Total de unidades: {unidades.length}</p>
                    </div>
                </div>
            </div>

            {/* Estilos para impresión */}
            <style>{`
                @media print {
                    @page {
                        size: letter;
                        margin: 1cm;
                    }

                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }

                    .print\\:hidden {
                        display: none !important;
                    }

                    .print\\:block {
                        display: block !important;
                    }

                    .print\\:break-inside-avoid {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                }
            `}</style>
        </div>
    );
};

export default ImpresionCodigosHerramientasPage;

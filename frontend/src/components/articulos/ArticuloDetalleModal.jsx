import React, { useState, useEffect } from 'react';
import BarcodeDisplay from './BarcodeDisplay';
import UnidadHerramientaDetalleModal from './UnidadHerramientaDetalleModal';
import { getImageUrl } from '../../utils/imageUtils';
import articulosService from '../../services/articulos.service';
import herramientasRentaService from '../../services/herramientasRenta.service';
import { confirmarG3, avisoG3 } from '../../diseno-3g/dialogosG3';
import CajonDetalleArticulo from '../../rediseno2/inventario/CajonDetalleArticulo';

const ArticuloDetalleModal = ({
  articulo,
  isOpen,
  onClose,
  onEdit,
  canEdit = false,
  onImageReprocessed,
  onEntrada,
  onSalida,
  puedeGestionarInventario = false,
  puedeRegistrarSalida = false,
  r2 // Rediseño 2: datos y manejadores extra que solo usa el cajón encendido (Inventario los pasa; apagado no se usan)
}) => {
  const [imagenExpandida, setImagenExpandida] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // Estados para herramientas de renta
  const [unidadesHerramienta, setUnidadesHerramienta] = useState([]);
  const [tipoHerramienta, setTipoHerramienta] = useState(null);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [modalUnidadOpen, setModalUnidadOpen] = useState(false);

  // Estado para último movimiento
  const [ultimoMovimiento, setUltimoMovimiento] = useState(null);
  const [loadingUltimoMov, setLoadingUltimoMov] = useState(false);

  // Cargar unidades cuando es herramienta de renta
  useEffect(() => {
    if (isOpen && articulo?.es_herramienta) {
      cargarUnidadesHerramienta();
    } else {
      // Limpiar cuando se cierra o no es herramienta
      setUnidadesHerramienta([]);
      setTipoHerramienta(null);
    }
  }, [isOpen, articulo?.id, articulo?.es_herramienta]);

  // Cargar último movimiento cuando se abre el modal
  useEffect(() => {
    if (isOpen && articulo?.id) {
      cargarUltimoMovimiento();
    } else {
      setUltimoMovimiento(null);
    }
  }, [isOpen, articulo?.id]);

  // Cerrar imagen expandida con tecla Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && imagenExpandida) {
        setImagenExpandida(false);
      }
    };

    if (imagenExpandida) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [imagenExpandida]);

  // Cargar unidades de la herramienta
  const cargarUnidadesHerramienta = async () => {
    if (!articulo?.id) return;

    try {
      setLoadingUnidades(true);
      const data = await herramientasRentaService.obtenerUnidadesPorArticulo(articulo.id);
      setUnidadesHerramienta(data.unidades || []);
      setTipoHerramienta(data.tipo || null);
    } catch (error) {
      console.error('Error al cargar unidades de herramienta:', error);
      setUnidadesHerramienta([]);
      setTipoHerramienta(null);
    } finally {
      setLoadingUnidades(false);
    }
  };

  // Cargar último movimiento
  const cargarUltimoMovimiento = async () => {
    if (!articulo?.id) return;
    try {
      setLoadingUltimoMov(true);
      const data = await articulosService.getUltimoMovimiento(articulo.id);
      setUltimoMovimiento(data.ultimoMovimiento);
    } catch (error) {
      console.error('Error al cargar último movimiento:', error);
      setUltimoMovimiento(null);
    } finally {
      setLoadingUltimoMov(false);
    }
  };

  // Abrir modal de detalle de unidad
  const handleVerUnidad = (unidad) => {
    setUnidadSeleccionada(unidad);
    setModalUnidadOpen(true);
  };

  if (!articulo) return null;


  const imagenUrl = getImageUrl(articulo.imagen_url);

  // Manejar reprocesamiento de imagen con IA
  const handleReprocessImage = async () => {
    if (!articulo.imagen_url) return;

    if (!(await confirmarG3({
      titulo: '¿Reprocesar esta imagen con IA?',
      texto: 'Mejora la calidad de la foto. Esto puede tardar unos segundos.',
      datos: [['Artículo', articulo.nombre]],
      confirmar: 'Reprocesar imagen', cancelar: 'No reprocesar',
    }))) return;

    setReprocessing(true);
    try {
      const result = await articulosService.reprocessImagen(articulo.id);
      avisoG3('Imagen reprocesada con IA.', 'ok');

      // Notificar al componente padre para actualizar la lista
      if (onImageReprocessed) {
        onImageReprocessed(articulo.id, result.imagen_url);
      }
    } catch (error) {
      console.error('Error al reprocesar imagen:', error);
      avisoG3(error.message || 'Error al reprocesar imagen. Verifica que Nano Banana esté configurado.', 'mal');
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <CajonDetalleArticulo articulo={articulo} abierto={isOpen} alCerrar={onClose} imagenUrl={imagenUrl} canEdit={canEdit} onEdit={onEdit}
      onEntrada={onEntrada} onSalida={onSalida} puedeGestionarInventario={puedeGestionarInventario} puedeRegistrarSalida={puedeRegistrarSalida}
      reprocessing={reprocessing} alMejorarFoto={handleReprocessImage} ultimoMovimiento={ultimoMovimiento} cargandoMovimiento={loadingUltimoMov}
      unidadesLista={unidadesHerramienta} cargandoUnidades={loadingUnidades} alVerUnidad={handleVerUnidad}
      codigoBarras={!articulo.es_herramienta ? <BarcodeDisplay articuloId={articulo.id} codigoEAN13={articulo.codigo_ean13} /> : null}
      detalleUnidad={modalUnidadOpen && unidadSeleccionada ? (
        <UnidadHerramientaDetalleModal unidad={unidadSeleccionada} tipoHerramienta={tipoHerramienta} isOpen={modalUnidadOpen}
          onClose={() => { setModalUnidadOpen(false); setUnidadSeleccionada(null); }} />
      ) : null}
      r2={r2} />
  );
};

export default ArticuloDetalleModal;

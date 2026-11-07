import React, { useState, useEffect } from 'react';
import camionetasService from '../../services/camionetas.service';
import herramientasRentaService from '../../services/herramientasRenta.service';
import toast from 'react-hot-toast';
import { confirmarG3, pedirTextoG3 } from '../../diseno-3g/dialogosG3';
import CajonMinimosEquipo from '../../rediseno2/gestion/CajonMinimosEquipo';

const ConfigurarStockMinimoModal = ({ camioneta, onClose, onActualizar }) => {
  const [tiposHerramientas, setTiposHerramientas] = useState([]);
  const [stocksConfigurados, setStocksConfigurados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Herramientas seleccionadas para agregar en batch
  const [seleccionadas, setSeleccionadas] = useState([]);

  useEffect(() => {
    if (camioneta) {
      cargarDatos();
    }
  }, [camioneta]);

  const cargarDatos = async () => {
    try {
      setCargando(true);

      const [tipos, stocks] = await Promise.all([
        herramientasRentaService.obtenerTipos({ activo: true }),
        camionetasService.obtenerStockMinimo(camioneta.id)
      ]);

      setTiposHerramientas(tipos.tipos || []);
      setStocksConfigurados(stocks.data.stockMinimo || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar información');
    } finally {
      setCargando(false);
    }
  };

  const tiposFiltrados = tiposHerramientas.filter(tipo => {
    const yaConfigurado = stocksConfigurados.some(s => s.tipo_herramienta_id === tipo.id);
    const yaSeleccionado = seleccionadas.some(s => s.tipo.id === tipo.id);

    if (yaConfigurado || yaSeleccionado) return false;

    if (!busqueda.trim()) return true;

    const termino = busqueda.toLowerCase();
    return (
      tipo.nombre.toLowerCase().includes(termino) ||
      tipo.descripcion?.toLowerCase().includes(termino) ||
      tipo.prefijo_codigo.toLowerCase().includes(termino) ||
      tipo.categoria?.nombre.toLowerCase().includes(termino)
    );
  });

  const agregarSeleccion = (tipo) => {
    setSeleccionadas([...seleccionadas, {
      tipo,
      cantidad_minima: 1,
      observaciones: ''
    }]);
  };

  const quitarSeleccion = (tipoId) => {
    setSeleccionadas(seleccionadas.filter(s => s.tipo.id !== tipoId));
  };

  const actualizarCantidad = (tipoId, cantidad) => {
    setSeleccionadas(seleccionadas.map(s =>
      s.tipo.id === tipoId ? { ...s, cantidad_minima: cantidad } : s
    ));
  };

  const actualizarObservaciones = (tipoId, observaciones) => {
    setSeleccionadas(seleccionadas.map(s =>
      s.tipo.id === tipoId ? { ...s, observaciones } : s
    ));
  };

  const guardarTodas = async () => {
    if (seleccionadas.length === 0) {
      toast.error('Selecciona al menos una herramienta');
      return;
    }

    const invalidas = seleccionadas.filter(s => s.cantidad_minima <= 0);
    if (invalidas.length > 0) {
      toast.error('Todas las cantidades deben ser mayores a 0');
      return;
    }

    try {
      setGuardando(true);

      for (const seleccion of seleccionadas) {
        await camionetasService.configurarStockMinimo(camioneta.id, {
          tipo_herramienta_id: seleccion.tipo.id,
          cantidad_minima: parseInt(seleccion.cantidad_minima),
          observaciones: seleccion.observaciones
        });
      }

      toast.success(`${seleccionadas.length} configuración(es) agregada(s) exitosamente`);
      setSeleccionadas([]);
      await cargarDatos();

      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      console.error('Error al guardar configuraciones:', error);
      toast.error(error.message || 'Error al guardar configuraciones');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarConfiguracion = async (stockId, nombreHerramienta) => {
    if (!(await confirmarG3({ titulo: `¿Eliminar la configuración de ${nombreHerramienta}?`, datos: [['Equipo', camioneta?.nombre || '']], confirmar: 'Eliminar configuración', cancelar: 'No eliminar', peligro: true }))) return;

    try {
      await camionetasService.eliminarStockMinimo(camioneta.id, stockId);
      toast.success('Configuración eliminada');
      await cargarDatos();

      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      console.error('Error al eliminar configuración:', error);
      toast.error('Error al eliminar configuración');
    }
  };

  const editarConfiguracion = async (stock) => {
    // Diseño 3G encendido: cajón con el mismo campo y el mismo valor inicial (devuelve lo mismo que prompt(): el texto
    // o null). La validación de abajo es la de siempre.
    const nuevaCantidad = await pedirTextoG3({
        titulo: 'Cambiar la cantidad mínima',
        datos: [['Equipo', camioneta?.nombre || ''], ['Herramienta', stock.tipoHerramienta.nombre], ['Mínimo actual', String(stock.cantidad_minima)]],
        etiqueta: `Nueva cantidad mínima para ${stock.tipoHerramienta.nombre}`,
        valor: stock.cantidad_minima,
        modoTeclado: 'numeric',
        confirmar: 'Guardar cantidad', cancelar: 'Regresar',
      });

    if (!nuevaCantidad || nuevaCantidad === stock.cantidad_minima.toString()) {
      return;
    }

    const cantidad = parseInt(nuevaCantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      toast.error('La cantidad debe ser un número mayor a 0');
      return;
    }

    try {
      await camionetasService.configurarStockMinimo(camioneta.id, {
        tipo_herramienta_id: stock.tipo_herramienta_id,
        cantidad_minima: cantidad,
        observaciones: stock.observaciones
      });

      toast.success('Cantidad actualizada');
      await cargarDatos();

      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      toast.error('Error al actualizar cantidad');
    }
  };

  const obtenerImagenUrl = (tipo) => {
    return tipo.imagen_url || tipo.articuloOrigen?.imagen_url || null;
  };

  if (!camioneta) return null;

  return (
    <CajonMinimosEquipo
      camioneta={camioneta} onClose={onClose} cargando={cargando} guardando={guardando} busqueda={busqueda} setBusqueda={setBusqueda}
      tiposFiltrados={tiposFiltrados} seleccionadas={seleccionadas} stocksConfigurados={stocksConfigurados} agregarSeleccion={agregarSeleccion}
      quitarSeleccion={quitarSeleccion} actualizarCantidad={actualizarCantidad} actualizarObservaciones={actualizarObservaciones}
      guardarTodas={guardarTodas} eliminarConfiguracion={eliminarConfiguracion} editarConfiguracion={editarConfiguracion}
      obtenerImagenUrl={obtenerImagenUrl}
    />
  );
};

export default ConfigurarStockMinimoModal;

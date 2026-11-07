import { useState, useEffect } from 'react';
import { obtenerCalendarioMes, obtenerDistribucionEquipos } from '../services/calendario.service';
import { toast } from 'react-hot-toast';
import { useCalendario } from '../context/CalendarioContext';
import VistaCalendario from '../rediseno2/gestion/VistaCalendario';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const CalendarioPage = () => {
  const [mesActual, setMesActual] = useState(MESES[new Date().getMonth()]);
  const [calendario, setCalendario] = useState(null);
  const [calendarioSiguienteMes, setCalendarioSiguienteMes] = useState(null);
  const [calendarioMesAnterior, setCalendarioMesAnterior] = useState(null);
  const [distribucionEquipos, setDistribucionEquipos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [intervaloActualizacion] = useState(2); // en minutos
  const [actualizacionAutomatica] = useState(true);
  const [horaActual, setHoraActual] = useState(new Date());
  const [escala, setEscala] = useState(() => {
    const escalaGuardada = localStorage.getItem('calendarioEscala');
    return escalaGuardada ? parseFloat(escalaGuardada) : 100;
  });
  // Zoom de la vista normal: almacén, tabletas y teléfonos ajustan el tamaño a
  // su pantalla y queda recordado en ese dispositivo.
  const [escalaNormal, setEscalaNormal] = useState(() => {
    const guardada = localStorage.getItem('calendarioEscalaNormal');
    return guardada ? parseFloat(guardada) : 100;
  });
  const [mostrarControles, setMostrarControles] = useState(true);
  // Proyecto abierto desde el calendario: { proyecto, dia, mes }.
  // Almacén/calidad lo usa para ver la carpeta de ventas sin salir del calendario.
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const { modoPantallaCompleta, togglePantallaCompleta, setModoPantallaCompleta } = useCalendario();
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»

  // Cargar datos del calendario
  const cargarCalendario = async (mostrarToast = true) => {
    try {
      setLoading(true);

      // Mes anterior y siguiente: la semana que cruza de mes (ej. 27-sep → 3-oct)
      // puede vivir en la pestaña del mes anterior, y la pantalla completa la necesita.
      const indiceActual = MESES.indexOf(mesActual);
      const mesAnterior = MESES[indiceActual === 0 ? 11 : indiceActual - 1];
      const mesSiguiente = MESES[indiceActual === 11 ? 0 : indiceActual + 1];

      const [calendarioData, calendarioSiguienteData, calendarioAnteriorData, distribucionData] = await Promise.all([
        obtenerCalendarioMes(mesActual),
        obtenerCalendarioMes(mesSiguiente),
        obtenerCalendarioMes(mesAnterior).catch(() => ({ data: null })),
        obtenerDistribucionEquipos(mesActual)
      ]);

      setCalendario(calendarioData.data);
      setCalendarioSiguienteMes(calendarioSiguienteData.data);
      setCalendarioMesAnterior(calendarioAnteriorData.data);
      // Al arrancar el mes la pestaña aún no trae la tabla de equipos: se usa la
      // del mes anterior, que sigue vigente hasta que la capturen.
      let distribucion = distribucionData.data;
      if (!distribucion?.equipos?.length) {
        const anterior = await obtenerDistribucionEquipos(mesAnterior).catch(() => null);
        if (anterior?.data?.equipos?.length) distribucion = anterior.data;
      }
      setDistribucionEquipos(distribucion);
      setUltimaActualizacion(new Date());
      setErrorCargaR2(null);

      if (mostrarToast) {
        toast.success('Calendario actualizado');
      }
    } catch (error) {
      console.error('Error al cargar calendario:', error);
      toast.error('Error al cargar calendario');
      setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar calendario');
    } finally {
      setLoading(false);
    }
  };

  // Cargar calendario al montar y cuando cambia el mes
  useEffect(() => {
    cargarCalendario(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesActual]);

  // Auto-actualización configurable
  useEffect(() => {
    if (!actualizacionAutomatica) return;

    const intervalo = setInterval(() => {
      cargarCalendario(false);
    }, intervaloActualizacion * 60 * 1000);

    return () => clearInterval(intervalo);
  }, [mesActual, intervaloActualizacion, actualizacionAutomatica]);

  // Navegación entre meses
  const cambiarMes = (direccion) => {
    const indiceActual = MESES.indexOf(mesActual);
    let nuevoIndice = indiceActual + direccion;

    if (nuevoIndice < 0) nuevoIndice = 11;
    if (nuevoIndice > 11) nuevoIndice = 0;

    setMesActual(MESES[nuevoIndice]);
  };

  // Control de escala
  const aumentarEscala = () => {
    setEscala(prev => Math.min(prev + 10, 150)); // Máximo 150%
  };

  const reducirEscala = () => {
    setEscala(prev => Math.max(prev - 10, 30)); // Mínimo 30%
  };

  const aumentarEscalaNormal = () => {
    setEscalaNormal(prev => Math.min(prev + 10, 150));
  };

  const reducirEscalaNormal = () => {
    setEscalaNormal(prev => Math.max(prev - 10, 50));
  };

  // Guardar escala en localStorage
  useEffect(() => {
    localStorage.setItem('calendarioEscala', escala.toString());
  }, [escala]);

  useEffect(() => {
    localStorage.setItem('calendarioEscalaNormal', escalaNormal.toString());
  }, [escalaNormal]);

  // Actualizar reloj cada segundo
  useEffect(() => {
    const intervaloReloj = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);

    return () => clearInterval(intervaloReloj);
  }, []);

  // Escuchar cambios de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setModoPantallaCompleta(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setModoPantallaCompleta]);

  // Auto-ocultar controles en pantalla completa
  useEffect(() => {
    if (!modoPantallaCompleta) {
      setMostrarControles(true);
      return;
    }

    let temporizador;

    const manejarMovimientoMouse = () => {
      setMostrarControles(true);

      // Limpiar temporizador anterior
      if (temporizador) {
        clearTimeout(temporizador);
      }

      // Ocultar controles después de 3 segundos de inactividad
      temporizador = setTimeout(() => {
        setMostrarControles(false);
      }, 3000);
    };

    // Mostrar controles al mover el mouse
    document.addEventListener('mousemove', manejarMovimientoMouse);

    // Iniciar temporizador inicial
    manejarMovimientoMouse();

    return () => {
      document.removeEventListener('mousemove', manejarMovimientoMouse);
      if (temporizador) {
        clearTimeout(temporizador);
      }
    };
  }, [modoPantallaCompleta]);

  return (
    <VistaCalendario
      mesActual={mesActual} setMesActual={setMesActual} cambiarMes={cambiarMes}
      calendario={calendario} calendarioSiguienteMes={calendarioSiguienteMes} calendarioMesAnterior={calendarioMesAnterior}
      distribucionEquipos={distribucionEquipos} loading={loading} errorCarga={errorCargaR2} ultimaActualizacion={ultimaActualizacion}
      horaActual={horaActual} escala={escala} escalaNormal={escalaNormal} aumentarEscala={aumentarEscala} reducirEscala={reducirEscala}
      aumentarEscalaNormal={aumentarEscalaNormal} reducirEscalaNormal={reducirEscalaNormal} mostrarControles={mostrarControles}
      proyectoSeleccionado={proyectoSeleccionado} setProyectoSeleccionado={setProyectoSeleccionado}
      modoPantallaCompleta={modoPantallaCompleta} togglePantallaCompleta={togglePantallaCompleta} cargarCalendario={cargarCalendario}
    />
  );
};

export default CalendarioPage;

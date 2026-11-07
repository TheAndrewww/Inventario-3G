import { useState, useEffect } from 'react';
import { obtenerCalendarioMesPublico, obtenerDistribucionEquiposPublico } from '../services/calendario.service';
import { toast } from 'react-hot-toast';
import VistaCalendarioPublico from '../rediseno2/publicas/VistaCalendarioPublico';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const CalendarioPublicoPage = () => {
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
    const escalaGuardada = localStorage.getItem('calendarioPublicoEscala');
    return escalaGuardada ? parseFloat(escalaGuardada) : 100;
  });
  const [mostrarControles, setMostrarControles] = useState(true);
  const [modoPantallaCompleta, setModoPantallaCompleta] = useState(true); // Siempre inicia en modo pantalla completa

  // Función para toggle pantalla completa
  const togglePantallaCompleta = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

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
        obtenerCalendarioMesPublico(mesActual),
        obtenerCalendarioMesPublico(mesSiguiente),
        obtenerCalendarioMesPublico(mesAnterior).catch(() => ({ data: null })),
        obtenerDistribucionEquiposPublico(mesActual)
      ]);

      setCalendario(calendarioData.data);
      setCalendarioSiguienteMes(calendarioSiguienteData.data);
      setCalendarioMesAnterior(calendarioAnteriorData.data);
      // Al arrancar el mes la pestaña aún no trae la tabla de equipos: se usa la
      // del mes anterior, que sigue vigente hasta que la capturen.
      let distribucion = distribucionData.data;
      if (!distribucion?.equipos?.length) {
        const anterior = await obtenerDistribucionEquiposPublico(mesAnterior).catch(() => null);
        if (anterior?.data?.equipos?.length) distribucion = anterior.data;
      }
      setDistribucionEquipos(distribucion);
      setUltimaActualizacion(new Date());

      if (mostrarToast) {
        toast.success('Calendario actualizado');
      }
    } catch (error) {
      console.error('Error al cargar calendario:', error);
      toast.error('Error al cargar calendario');
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

  // Guardar escala en localStorage
  useEffect(() => {
    localStorage.setItem('calendarioPublicoEscala', escala.toString());
  }, [escala]);

  // Actualizar reloj cada segundo
  useEffect(() => {
    const intervaloReloj = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);

    return () => clearInterval(intervaloReloj);
  }, []);

  // Nota: El modo pantalla completa visual es independiente del fullscreen del navegador
  // Esto garantiza que siempre se muestre el diseño optimizado para pantallas

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
    <VistaCalendarioPublico
      meses={MESES}
      mesActual={mesActual}
      calendario={calendario}
      calendarioSiguienteMes={calendarioSiguienteMes}
      calendarioMesAnterior={calendarioMesAnterior}
      distribucionEquipos={distribucionEquipos}
      loading={loading}
      ultimaActualizacion={ultimaActualizacion}
      horaActual={horaActual}
      escala={escala}
      mostrarControles={mostrarControles}
      cargarCalendario={cargarCalendario}
      cambiarMes={cambiarMes}
      aumentarEscala={aumentarEscala}
      reducirEscala={reducirEscala}
      togglePantallaCompleta={togglePantallaCompleta}
    />
  );
};

export default CalendarioPublicoPage;

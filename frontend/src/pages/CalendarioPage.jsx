import { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  RefreshCw,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { obtenerCalendarioMes, obtenerDistribucionEquipos } from '../services/calendario.service';
import { toast } from 'react-hot-toast';
import { useCalendario } from '../context/CalendarioContext';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const COLORES_EQUIPO = {
  // Tipos de proyectos
  'NORMAL': { bg: 'bg-white', text: 'text-gray-800', border: 'border-gray-300' },
  'MANTENIMIENTO': { bg: 'bg-yellow-50', text: 'text-yellow-900', border: 'border-yellow-200' },
  'GARANTIA': { bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-200' },

  // Equipos (para las horas y distribución)
  'EQUIPO I': { bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-300' },
  'EQUIPO II': { bg: 'bg-green-100', text: 'text-green-900', border: 'border-green-300' },
  'EQUIPO III': { bg: 'bg-gray-200', text: 'text-gray-900', border: 'border-gray-400' },
  'EQUIPO IV': { bg: 'bg-orange-100', text: 'text-orange-900', border: 'border-orange-300' },
  'EQUIPO V': { bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-300' },
  'MANUFACTURA': { bg: 'bg-yellow-100', text: 'text-yellow-900', border: 'border-yellow-300' },
  'HERRERIA': { bg: 'bg-pink-100', text: 'text-pink-900', border: 'border-pink-300' },
  'PINTURA': { bg: 'bg-white', text: 'text-gray-800', border: 'border-gray-300' },
  'ALMACEN': { bg: 'bg-gray-300', text: 'text-gray-900', border: 'border-gray-500' },
  'FALLA': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' }
};

const CalendarioPage = () => {
  const [mesActual, setMesActual] = useState(MESES[new Date().getMonth()]);
  const [calendario, setCalendario] = useState(null);
  const [calendarioSiguienteMes, setCalendarioSiguienteMes] = useState(null);
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
  const [mostrarControles, setMostrarControles] = useState(true);
  const { modoPantallaCompleta, togglePantallaCompleta, setModoPantallaCompleta } = useCalendario();

  // Cargar datos del calendario
  const cargarCalendario = async (mostrarToast = true) => {
    try {
      setLoading(true);

      // Obtener mes siguiente
      const indiceActual = MESES.indexOf(mesActual);
      const indiceSiguiente = indiceActual === 11 ? 0 : indiceActual + 1;
      const mesSiguiente = MESES[indiceSiguiente];

      const [calendarioData, calendarioSiguienteData, distribucionData] = await Promise.all([
        obtenerCalendarioMes(mesActual),
        obtenerCalendarioMes(mesSiguiente),
        obtenerDistribucionEquipos(mesActual)
      ]);

      setCalendario(calendarioData.data);
      setCalendarioSiguienteMes(calendarioSiguienteData.data);
      setDistribucionEquipos(distribucionData.data);
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
    localStorage.setItem('calendarioEscala', escala.toString());
  }, [escala]);

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

  if (loading && !calendario) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div
      className={`h-screen flex flex-col ${modoPantallaCompleta ? 'p-2 bg-gray-900' : 'p-4 bg-gradient-to-br from-red-50 to-orange-100'} overflow-hidden`}
      style={modoPantallaCompleta && !mostrarControles ? { cursor: 'none' } : undefined}
    >
      {/* Header compacto - Solo en modo normal */}
      {!modoPantallaCompleta && (
        <div className="mb-4">
          <div className="flex items-center justify-between bg-white rounded-lg shadow-md p-3">
            <div className="flex items-center space-x-3">
              <Calendar className="w-8 h-8 text-red-700" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Calendario de Entregas 2026
                </h1>
                <div className="flex items-center space-x-4 mt-1">
                  <button
                    onClick={() => cambiarMes(-1)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <h2 className="text-xl font-bold text-gray-800">
                    {mesActual}
                  </h2>
                  <button
                    onClick={() => cambiarMes(1)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Botón actualizar manualmente */}
              <button
                onClick={() => cargarCalendario(true)}
                disabled={loading}
                className="p-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50"
                title="Actualizar ahora"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Botón pantalla completa */}
              <button
                onClick={togglePantallaCompleta}
                className="p-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
                title="Pantalla completa"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante para salir de pantalla completa */}
      {modoPantallaCompleta && (
        <button
          onClick={togglePantallaCompleta}
          className={`fixed top-4 right-4 z-50 p-3 bg-gray-800 bg-opacity-70 text-white rounded-full hover:bg-opacity-90 shadow-lg transition-all duration-300 ${
            mostrarControles ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
          title="Salir de pantalla completa"
        >
          <Minimize2 className="w-6 h-6" />
        </button>
      )}

      {/* Controles de zoom en pantalla completa */}
      {modoPantallaCompleta && (
        <div className={`fixed bottom-4 right-4 z-50 flex flex-col gap-2 transition-all duration-300 ${
          mostrarControles ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          {/* Indicador de escala */}
          <div className="bg-gray-800 bg-opacity-70 text-white px-3 py-2 rounded-lg text-center font-bold">
            {escala}%
          </div>

          {/* Botón aumentar zoom */}
          <button
            onClick={aumentarEscala}
            disabled={escala >= 150}
            className="p-3 bg-gray-800 bg-opacity-70 text-white rounded-full hover:bg-opacity-90 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-6 h-6" />
          </button>

          {/* Botón reducir zoom */}
          <button
            onClick={reducirEscala}
            disabled={escala <= 30}
            className="p-3 bg-gray-800 bg-opacity-70 text-white rounded-full hover:bg-opacity-90 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
            title="Reducir zoom"
          >
            <ZoomOut className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Contenedor con escala aplicada mediante variables CSS */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={modoPantallaCompleta ? {
          '--escala': escala / 100,
        } : undefined}
      >
        {/* Distribución de Equipos y Reloj */}
        {distribucionEquipos && distribucionEquipos.equipos && distribucionEquipos.equipos.length > 0 && (
          <div className={`${modoPantallaCompleta ? 'mb-2 grid-cols-6 gap-2' : 'mb-4 grid-cols-1 lg:grid-cols-3 gap-4'} grid`}>
          {modoPantallaCompleta ? (
            <>
              {/* Fila única: Logo + Fecha y Hora + Distribución de Equipos */}

              {/* Logo de la empresa */}
              <div className="p-4 flex items-center justify-center bg-gray-900 rounded-lg">
                <img
                  src="https://res.cloudinary.com/dd93jrilg/image/upload/v1763171532/logo_web_blanco_j8xeyh.png"
                  alt="Logo 3G"
                  className="w-full h-auto object-contain"
                />
              </div>

              {/* Fecha y Hora */}
              <div
                className="col-span-2 bg-gradient-to-br from-red-700 to-red-800 rounded-lg shadow-md flex items-center justify-between text-white"
                style={{ padding: `calc(0.5rem * var(--escala, 1))` }}
              >
                {/* Fecha a la izquierda */}
                <div className="flex-1">
                  <div
                    className="font-bold capitalize"
                    style={{
                      fontSize: `calc(1.5rem * var(--escala, 1))`,
                      marginBottom: `calc(0.25rem * var(--escala, 1))`
                    }}
                  >
                    {horaActual.toLocaleDateString('es-MX', {
                      weekday: 'long',
                      timeZone: 'America/Mexico_City'
                    })}
                  </div>
                  <div
                    className="font-medium opacity-90 capitalize"
                    style={{ fontSize: `calc(1.125rem * var(--escala, 1))` }}
                  >
                    {horaActual.toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'America/Mexico_City'
                    })}
                  </div>
                </div>

                {/* Hora a la derecha */}
                <div
                  className="flex items-center"
                  style={{ gap: `calc(0.5rem * var(--escala, 1))` }}
                >
                  <Clock style={{ width: `calc(1.5rem * var(--escala, 1))`, height: `calc(1.5rem * var(--escala, 1))` }} />
                  <div
                    className="font-bold tabular-nums"
                    style={{ fontSize: `calc(2.25rem * var(--escala, 1))` }}
                  >
                    {horaActual.toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                      timeZone: 'America/Mexico_City'
                    })}
                  </div>
                </div>
              </div>

              {/* Distribución de Equipos */}
              <div
                className="col-span-3 bg-white rounded-lg shadow-md flex flex-col"
                style={{ padding: `calc(0.375rem * var(--escala, 1))` }}
              >
                <div
                  className="flex items-center"
                  style={{
                    gap: `calc(0.25rem * var(--escala, 1))`,
                    marginBottom: `calc(0.25rem * var(--escala, 1))`
                  }}
                >
                  <Users style={{ width: `calc(0.75rem * var(--escala, 1))`, height: `calc(0.75rem * var(--escala, 1))` }} className="text-red-700" />
                  <h3
                    className="font-bold text-gray-800"
                    style={{ fontSize: `calc(0.625rem * var(--escala, 1))` }}
                  >
                    Distribución de Equipos
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div
                    className="flex flex-wrap content-start"
                    style={{ gap: `calc(0.25rem * var(--escala, 1))` }}
                  >
                    {distribucionEquipos.equipos.map((equipo, index) => {
                      const colores = COLORES_EQUIPO[equipo.tipoEquipo];

                      const estiloPersonalizado = !colores && equipo.color ? {
                        backgroundColor: `rgb(${equipo.color.red}, ${equipo.color.green}, ${equipo.color.blue})`,
                        borderColor: `rgb(${Math.max(0, equipo.color.red - 30)}, ${Math.max(0, equipo.color.green - 30)}, ${Math.max(0, equipo.color.blue - 30)})`,
                        color: (equipo.color.red + equipo.color.green + equipo.color.blue) / 3 > 180 ? '#1f2937' : '#ffffff'
                      } : null;

                      // Separar encargado del resto de integrantes
                      const encargado = equipo.integrantes && equipo.integrantes.length > 0 ? equipo.integrantes[0] : null;
                      const otrosIntegrantes = equipo.integrantes && equipo.integrantes.length > 1 ? equipo.integrantes.slice(1) : [];

                      return (
                        <div
                          key={index}
                          className={colores ? `${colores.bg} ${colores.border} border rounded-lg flex flex-col flex-1 min-w-fit` : `border rounded-lg flex flex-col flex-1 min-w-fit`}
                          style={{
                            ...estiloPersonalizado,
                            padding: `calc(0.25rem * var(--escala, 1))`,
                            gap: `calc(0.125rem * var(--escala, 1))`
                          }}
                        >
                          {/* Nombre del equipo */}
                          <div
                            className={`font-bold ${colores ? colores.text : ''}`}
                            style={{ fontSize: `calc(0.6875rem * var(--escala, 1))` }}
                          >
                            {equipo.nombre}
                          </div>
                          {/* Encargado */}
                          {encargado && (
                            <div
                              className={`font-semibold ${colores ? colores.text : ''} underline uppercase`}
                              style={{ fontSize: `calc(0.625rem * var(--escala, 1))` }}
                            >
                              {encargado}
                            </div>
                          )}
                          {/* Otros integrantes */}
                          {otrosIntegrantes.length > 0 && (
                            <div className={`flex flex-col ${colores ? colores.text : ''} opacity-75`}>
                              {otrosIntegrantes.map((integrante, idx) => (
                                <span
                                  key={idx}
                                  style={{ fontSize: `calc(0.5625rem * var(--escala, 1))` }}
                                >
                                  {integrante}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Vista Normal - Distribución de Equipos - 2/3 del ancho */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-3 flex-shrink-0">
                <div className="flex items-center space-x-1 mb-2">
                  <Users className="w-5 h-5 text-red-700" />
                  <h3 className="text-base font-bold text-gray-800">
                    Distribución de Equipos
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {distribucionEquipos.equipos.map((equipo, index) => {
                    const colores = COLORES_EQUIPO[equipo.tipoEquipo];

                    const estiloPersonalizado = !colores && equipo.color ? {
                      backgroundColor: `rgb(${equipo.color.red}, ${equipo.color.green}, ${equipo.color.blue})`,
                      borderColor: `rgb(${Math.max(0, equipo.color.red - 30)}, ${Math.max(0, equipo.color.green - 30)}, ${Math.max(0, equipo.color.blue - 30)})`,
                      color: (equipo.color.red + equipo.color.green + equipo.color.blue) / 3 > 180 ? '#1f2937' : '#ffffff'
                    } : null;

                    const encargado = equipo.integrantes && equipo.integrantes.length > 0 ? equipo.integrantes[0] : null;
                    const otrosIntegrantes = equipo.integrantes && equipo.integrantes.length > 1 ? equipo.integrantes.slice(1) : [];

                    return (
                      <div
                        key={index}
                        className={colores ? `${colores.bg} ${colores.border} border-2 rounded-lg p-4 flex items-center gap-3 flex-1 min-w-fit` : `border-2 rounded-lg p-4 flex items-center gap-3 flex-1 min-w-fit`}
                        style={estiloPersonalizado || undefined}
                      >
                        <div className="flex-shrink-0">
                          <div className={`text-lg font-bold ${colores ? colores.text : ''}`}>
                            {equipo.nombre}
                          </div>
                          {encargado && (
                            <div className={`text-lg font-semibold ${colores ? colores.text : ''} underline uppercase`}>
                              {encargado}
                            </div>
                          )}
                        </div>

                        {otrosIntegrantes.length > 0 && (
                          <div className={`flex flex-col text-base ${colores ? colores.text : ''} opacity-75`}>
                            {otrosIntegrantes.map((integrante, idx) => (
                              <span key={idx} className="whitespace-nowrap">
                                {integrante}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vista Normal - Reloj - 1/3 del ancho */}
              <div className="bg-gradient-to-br from-red-700 to-red-800 rounded-lg shadow-md p-6 flex flex-col items-center justify-center text-white">
                <div className="flex items-center space-x-2 mb-4">
                  <Clock className="w-8 h-8" />
                  <h3 className="text-lg font-bold">Hora Actual</h3>
                </div>

                <div className="text-center">
                  <div className="text-6xl font-bold mb-2 tabular-nums">
                    {horaActual.toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                      timeZone: 'America/Mexico_City'
                    })}
                  </div>
                  <div className="text-xl font-medium opacity-90">
                    {horaActual.toLocaleDateString('es-MX', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'America/Mexico_City'
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Calendario - Vista adaptativa según modo */}
      {calendario && (
        <>
          {modoPantallaCompleta ? (
            // Vista Pantalla Completa: Semana actual grande + 2 semanas siguientes
            (() => {
              const hoy = new Date();
              const diaHoy = hoy.getDate();

              // Combinar semanas del mes actual y el siguiente
              const todasLasSemanas = [
                ...(calendario?.semanas || []),
                ...(calendarioSiguienteMes?.semanas || [])
              ];

              // Encontrar la semana actual
              let semanaActualIndex = todasLasSemanas.findIndex(semana =>
                semana.dias.some(dia => dia.numero === diaHoy)
              );

              // Si no encontramos la semana actual, usar la primera
              if (semanaActualIndex === -1) semanaActualIndex = 0;

              const semanaActual = todasLasSemanas[semanaActualIndex];
              const semanaSiguiente1 = todasLasSemanas[semanaActualIndex + 1] || null;
              const semanaSiguiente2 = todasLasSemanas[semanaActualIndex + 2] || null;

              const renderSemana = (semana, esGrande = false) => {
                if (!semana) return null;

                const hoy = new Date();
                const diaHoy = hoy.getDate();

                return (
                  <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full">
                    <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200">
                      {semana.dias.map((dia, diaIndex) => {
                        const esDiaActual = esGrande && dia.numero === diaHoy;
                        const esAsueto = dia.proyectos.some(p => p.nombre.toUpperCase().includes('ASUETO'));

                        return (
                          <div key={diaIndex} className={`flex flex-col ${dia.numero === null ? 'bg-gray-100' : esAsueto ? 'bg-red-50' : esDiaActual ? 'bg-yellow-50' : ''} overflow-hidden relative`}>
                            {/* Header del día */}
                            <div
                              className={`${dia.numero === null ? 'bg-gray-400' : esAsueto ? 'bg-red-600' : esDiaActual ? 'bg-yellow-500' : 'bg-blue-600'} text-white ${esDiaActual || esAsueto ? 'shadow-lg' : ''}`}
                              style={{ padding: esGrande ? `calc(0.75rem * var(--escala, 1))` : `calc(0.25rem * var(--escala, 1))` }}
                            >
                              <div
                                className="font-bold"
                                style={{ fontSize: esGrande ? `calc(0.875rem * var(--escala, 1))` : `calc(0.375rem * var(--escala, 1))` }}
                              >
                                {dia.nombre}
                              </div>
                              <div
                                className="font-bold"
                                style={{ fontSize: esGrande ? `calc(1.875rem * var(--escala, 1))` : `calc(0.6875rem * var(--escala, 1))` }}
                              >
                                {dia.numero || '-'}
                              </div>
                              {esDiaActual && (
                                <div
                                  className="font-bold animate-pulse"
                                  style={{
                                    fontSize: esGrande ? `calc(0.625rem * var(--escala, 1))` : `calc(0.4375rem * var(--escala, 1))`,
                                    marginTop: `calc(0.25rem * var(--escala, 1))`
                                  }}
                                >
                                  HOY
                                </div>
                              )}
                              {esAsueto && (
                                <div
                                  className="font-bold animate-pulse"
                                  style={{
                                    fontSize: esGrande ? `calc(0.625rem * var(--escala, 1))` : `calc(0.4375rem * var(--escala, 1))`,
                                    marginTop: `calc(0.25rem * var(--escala, 1))`
                                  }}
                                >
                                  ASUETO
                                </div>
                              )}
                            </div>

                          {/* Proyectos del día */}
                          <div
                            className="flex-1 overflow-y-auto overflow-x-hidden"
                            style={{
                              padding: esGrande ? `calc(0.75rem * var(--escala, 1))` : `calc(0.25rem * var(--escala, 1))`,
                              gap: esGrande ? `calc(0.5rem * var(--escala, 1))` : `calc(0.125rem * var(--escala, 1))`,
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                          >
                            {dia.proyectos.filter(p => !p.nombre.toUpperCase().includes('ASUETO')).length === 0 ? (
                              <div
                                className="text-center text-gray-400"
                                style={{
                                  fontSize: esGrande ? `calc(0.875rem * var(--escala, 1))` : `calc(0.4375rem * var(--escala, 1))`,
                                  marginTop: `calc(0.5rem * var(--escala, 1))`
                                }}
                              >
                                Sin proyectos
                              </div>
                            ) : (
                              dia.proyectos.filter(p => !p.nombre.toUpperCase().includes('ASUETO')).map((proyecto, proyectoIndex) => {
                                const coloresProyecto = COLORES_EQUIPO[proyecto.tipoProyecto] || COLORES_EQUIPO['NORMAL'];
                                const coloresHora = COLORES_EQUIPO[proyecto.equipoHora] || COLORES_EQUIPO['NORMAL'];
                                const textoProyecto = proyecto.cliente
                                  ? `${proyecto.nombre} / ${proyecto.cliente}`
                                  : proyecto.nombre;

                                return (
                                  <div
                                    key={proyectoIndex}
                                    className="flex items-stretch"
                                    style={{
                                      gap: `calc(0.25rem * var(--escala, 1))`,
                                      marginBottom: `calc(0.25rem * var(--escala, 1))`
                                    }}
                                  >
                                    {/* Nombre del proyecto */}
                                    <div
                                      className={`flex-1 ${coloresProyecto.bg} ${coloresProyecto.border} border-l-4 rounded flex items-center overflow-hidden min-w-0`}
                                      style={{
                                        padding: esGrande ? `calc(0.625rem * var(--escala, 1)) calc(0.75rem * var(--escala, 1))` : `calc(0.375rem * var(--escala, 1))`
                                      }}
                                    >
                                      <span
                                        className={`font-medium ${coloresProyecto.text} leading-tight break-words w-full`}
                                        style={{ fontSize: esGrande ? `calc(1rem * var(--escala, 1))` : `calc(0.4375rem * var(--escala, 1))` }}
                                      >
                                        {textoProyecto}
                                      </span>
                                    </div>

                                    {/* Hora */}
                                    {proyecto.hora && (
                                      <div
                                        className={`${coloresHora.bg} ${coloresHora.text} rounded flex items-center justify-center flex-shrink-0 overflow-hidden`}
                                        style={{
                                          width: esGrande ? `calc(2rem * var(--escala, 1))` : `calc(0.875rem * var(--escala, 1))`,
                                          maxWidth: esGrande ? `calc(2rem * var(--escala, 1))` : `calc(0.875rem * var(--escala, 1))`,
                                          padding: esGrande ? `calc(0.625rem * var(--escala, 1)) calc(0.3125rem * var(--escala, 1))` : `calc(0.25rem * var(--escala, 1)) calc(0.125rem * var(--escala, 1))`
                                        }}
                                      >
                                        <div style={{
                                          writingMode: 'vertical-rl',
                                          textOrientation: 'mixed',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden'
                                        }}>
                                          <span
                                            className="font-bold text-center leading-tight"
                                            style={{ fontSize: esGrande ? `calc(0.875rem * var(--escala, 1))` : `calc(0.375rem * var(--escala, 1))` }}
                                          >
                                            {proyecto.hora}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              return (
                <div className="flex-1 grid grid-cols-3 gap-2 overflow-hidden">
                  {/* Semana actual - 2 columnas (grande) */}
                  <div className="col-span-2 flex h-full">
                    {renderSemana(semanaActual, true)}
                  </div>

                  {/* Siguientes 2 semanas - 1 columna */}
                  <div className="col-span-1 flex flex-col gap-2 h-full">
                    <div className="flex-1">
                      {renderSemana(semanaSiguiente1, false)}
                    </div>
                    <div className="flex-1">
                      {renderSemana(semanaSiguiente2, false)}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            // Vista Normal: Todas las semanas en 2 columnas
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
              {calendario.semanas.map((semana, semanaIndex) => {
                const hoy = new Date();
                const diaHoy = hoy.getDate();

                return (
                  <div key={semanaIndex} className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
                    <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200">
                      {semana.dias.map((dia, diaIndex) => {
                        const esDiaActual = dia.numero === diaHoy;
                        const esAsueto = dia.proyectos.some(p => p.nombre.toUpperCase().includes('ASUETO'));

                        return (
                          <div key={diaIndex} className={`flex flex-col ${dia.numero === null ? 'bg-gray-100' : esAsueto ? 'bg-red-50' : esDiaActual ? 'bg-yellow-50' : ''} overflow-hidden`}>
                            {/* Header del día */}
                            <div className={`${dia.numero === null ? 'bg-gray-400' : esAsueto ? 'bg-red-600' : esDiaActual ? 'bg-yellow-500' : 'bg-blue-600'} text-white p-1.5 ${esDiaActual || esAsueto ? 'shadow-md' : ''}`}>
                              <div className="font-bold text-[10px]">
                                {dia.nombre}
                              </div>
                              <div className="text-lg font-bold">
                                {dia.numero || '-'}
                              </div>
                              {esDiaActual && (
                                <div className="text-[8px] font-bold mt-0.5 animate-pulse">
                                  HOY
                                </div>
                              )}
                              {esAsueto && (
                                <div className="text-[8px] font-bold mt-0.5">
                                  ASUETO
                                </div>
                              )}
                            </div>

                        {/* Proyectos del día */}
                        <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto overflow-x-hidden">
                          {dia.proyectos.filter(p => !p.nombre.toUpperCase().includes('ASUETO')).length === 0 ? (
                            <div className="text-center text-gray-400 text-xs mt-2">
                              Sin proyectos
                            </div>
                          ) : (
                            dia.proyectos.filter(p => !p.nombre.toUpperCase().includes('ASUETO')).map((proyecto, proyectoIndex) => {
                              const coloresProyecto = COLORES_EQUIPO[proyecto.tipoProyecto] || COLORES_EQUIPO['NORMAL'];
                              const coloresHora = COLORES_EQUIPO[proyecto.equipoHora] || COLORES_EQUIPO['NORMAL'];
                              const textoProyecto = proyecto.cliente
                                ? `${proyecto.nombre} / ${proyecto.cliente}`
                                : proyecto.nombre;

                              return (
                                <div
                                  key={proyectoIndex}
                                  className="flex items-stretch gap-1 mb-1"
                                >
                                  {/* Nombre del proyecto con color del equipo */}
                                  <div className={`flex-1 ${coloresProyecto.bg} ${coloresProyecto.border} border-l-4 rounded px-2 py-2 flex items-center overflow-hidden min-w-0`}>
                                    <span className={`font-medium text-xs ${coloresProyecto.text} leading-relaxed break-words w-full`}>
                                      {textoProyecto}
                                    </span>
                                  </div>

                                  {/* Hora rotada 90° con color del equipo */}
                                  {proyecto.hora && (
                                    <div className={`${coloresHora.bg} ${coloresHora.text} rounded flex items-center justify-center flex-shrink-0 overflow-hidden`}
                                      style={{
                                        width: '24px',
                                        maxWidth: '24px',
                                        padding: '8px 4px'
                                      }}
                                    >
                                      <div style={{
                                        writingMode: 'vertical-rl',
                                        textOrientation: 'mixed',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden'
                                      }}>
                                        <span className="font-bold text-[10px] text-center leading-tight">
                                          {proyecto.hora}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      </div>
      {/* Fin del contenedor con escala */}
    </div>
  );
};

export default CalendarioPage;

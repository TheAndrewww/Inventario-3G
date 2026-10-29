// Rediseño 2 · Administración › Tabletas de calidad (/calidad/tabletas). Solo con PANEL_CALIDAD y para administración.
// Aquí se vincula la tableta de Charly (app «3G Calidad»): se genera un código de un solo uso que dura 15 minutos y se
// escribe en la app o se escanea su QR. La lista dice qué tabletas están vinculadas, cuándo se usaron y deja revocarlas.
// El código y el QR se ven una sola vez (Planta guarda solo su huella).
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Ban, EyeOff } from 'lucide-react';
import QRCode from 'qrcode';
import {
  Pagina, EncabezadoPagina, Tabla, Estado, Boton, Seccion, Nota, Fecha, Pila, plural, horaCorta, confirmarG3, avisoG3, motivoLegible,
} from '../fundacion';
import {
  generarCodigoCalidad, tabletasCalidad, revocarTabletaCalidad, enlaceVincular,
} from '../../services/calidad.service';
import './calidad.css';

const conGuion = (c) => (c && c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);
const motivoDe = (e) => e?.response?.data?.error || e?.message || 'Error desconocido';

export default function VistaTabletasCalidad() {
  const [tabletas, setTabletas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [codigo, setCodigo] = useState(null); // { codigo, vence, qr }
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setTabletas(await tabletasCalidad());
    } catch (e) {
      setError(motivoDe(e));
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    if (generando) return;
    setGenerando(true);
    try {
      const c = await generarCodigoCalidad();
      const qr = await QRCode.toDataURL(enlaceVincular(c.codigo), { margin: 1, width: 360, errorCorrectionLevel: 'M' });
      setCodigo({ ...c, qr });
    } catch (e) {
      avisoG3(`No se pudo generar el código: ${motivoLegible(motivoDe(e))}`, 'mal');
    } finally {
      setGenerando(false);
    }
  };

  const revocar = async (t) => {
    const si = await confirmarG3({
      titulo: `¿Revocar «${t.nombre}»?`,
      texto: 'La tableta deja de entrar al panel de calidad en su siguiente petición. Lo que tenga sin mandar se queda en ella; para volver a usarla hay que vincularla con un código nuevo.',
      confirmar: 'Revocar tableta', cancelar: 'No revocar', peligro: true,
    });
    if (!si) return;
    try {
      await revocarTabletaCalidad(t.id);
      avisoG3(`«${t.nombre}» ya no puede entrar.`, 'ok');
      cargar();
    } catch (e) {
      avisoG3(`No se pudo revocar: ${motivoLegible(motivoDe(e))}`, 'mal');
    }
  };

  const activas = tabletas.filter((t) => !t.revocado).length;
  const columnas = [
    { id: 'nombre', titulo: 'Tableta', celda: (t) => <span className="r2c-fuerte">{t.nombre}</span> },
    { id: 'vinculada', titulo: 'Vinculada', ancho: '170px', celda: (t) => <Fecha valor={t.creado} /> },
    { id: 'uso', titulo: 'Último uso', ancho: '170px', ocultarEn: 'celular-ancho', celda: (t) => <Fecha valor={t.ultimoUso} vacio="Nunca" /> },
    { id: 'estado', titulo: 'Estado', ancho: '150px', celda: (t) => (t.revocado ? <Estado tono="neutro" texto="Revocada" /> : <Estado tono="ok" texto="Vinculada" />) },
  ];

  return (
    <Pagina titulo="Tabletas de calidad" ancho="lectura">
      <EncabezadoPagina
        titulo="Tabletas de calidad"
        dato={cargando ? null : plural(activas, 'vinculada', 'vinculadas')}
        ayuda="La tableta de Calidad (app 3G Calidad) se vincula con un código de un solo uso que dura 15 minutos: se escribe en la app o se escanea su QR."
        principal={{ texto: 'Generar código', corto: 'Código', icono: KeyRound, alHacer: generar, cargando: generando }}
      />
      {codigo && (
        <Seccion titulo="Código para vincular" dato={`vence a las ${horaCorta(codigo.vence)}`}
          accion={<Boton nivel="fantasma" icono={EyeOff} alHacer={() => setCodigo(null)}>Ocultar código</Boton>}>
          <div className="r2c-codigo">
            <img className="r2c-qr" src={codigo.qr} alt={`QR para vincular la tableta con el código ${conGuion(codigo.codigo)}`} width={180} height={180} />
            <Pila separacion={8}>
              <p className="r2c-codigo-texto" aria-label={`Código ${codigo.codigo.split('').join(' ')}`}>{conGuion(codigo.codigo)}</p>
              <Nota>En la tableta: abre 3G Calidad, toca «Vincular» y escribe el código (o escanea el QR). Sirve una sola vez y solo los próximos 15 minutos; después de cerrar esta pantalla ya no se puede volver a ver.</Nota>
            </Pila>
          </div>
        </Seccion>
      )}
      <Seccion titulo="Tabletas">
        <Tabla
          etiqueta="Tabletas de calidad"
          clave="id"
          columnas={columnas}
          filas={tabletas}
          accion={(t) => (!t.revocado && <Boton nivel="peligro" tamano="chico" icono={Ban} alHacer={() => revocar(t)}>Revocar</Boton>)}
          filaCelular={(t) => ({
            principal: t.nombre,
            secundario: t.ultimoUso ? <>Último uso <Fecha valor={t.ultimoUso} /></> : 'Sin usar todavía',
            debajo: t.revocado ? <Estado tono="neutro" texto="Revocada" /> : <Estado tono="ok" texto="Vinculada" />,
          })}
          cargando={cargando}
          error={error && { mensaje: 'No se pudo cargar la lista de tabletas.', motivo: error, alReintentar: cargar }}
          vacio={{ titulo: 'Todavía no hay tabletas vinculadas', texto: 'Genera un código y escríbelo en la app 3G Calidad, o escanea su QR.' }}
        />
      </Seccion>
    </Pagina>
  );
}

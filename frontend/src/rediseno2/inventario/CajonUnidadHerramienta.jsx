// Rediseño 2 · grupo inventario · detalle de una unidad de herramienta de renta (UnidadHerramientaDetalleModal encendido).
// Cajón normal: cabecera con la herramienta, el código de la unidad y su estado; arriba «Descargar» e «Imprimir» el código;
// en el cuerpo, la asignación y el código QR (que el componente de siempre ya pidió).
import { Download, Printer } from 'lucide-react';
import { Cajon, CajonCabecera, CajonDecision, CajonCuerpo, SeccionCajon } from '../fundacion/piezas/Cajon';
import { Boton } from '../fundacion/piezas/Boton';
import { Estado } from '../fundacion/piezas/Estado';
import { Datos } from '../fundacion/piezas/Datos';
import { Fecha } from '../fundacion/piezas/Fecha';
import './inventario.css';

const TONO = { disponible: 'ok', asignada: 'info', en_reparacion: 'aviso', perdida: 'mal', baja: 'neutro' };

export default function CajonUnidadHerramienta({ unidad, tipoHerramienta, abierto, alCerrar, etiquetaEstado, qr, cargandoQr, alDescargar, alImprimir }) {
  const asignada = unidad.estado === 'asignada' && (unidad.usuarioAsignado || unidad.equipoAsignado);
  return (
    <Cajon abierto={abierto} alCerrar={alCerrar} etiqueta={`Unidad ${unidad.codigo_unico}`}>
      <CajonCabecera titulo={tipoHerramienta.nombre} dato={<span className="r2-inv-unidad-codigo">{unidad.codigo_unico}</span>}
        estado={<Estado tono={TONO[unidad.estado] || 'ok'} texto={etiquetaEstado} />} alCerrar={alCerrar} />
      <CajonDecision>
        <Boton nivel="tonal" icono={Download} alHacer={alDescargar}>Descargar código</Boton>
        <Boton nivel="tonal" icono={Printer} alHacer={alImprimir}>Imprimir código</Boton>
      </CajonDecision>
      <CajonCuerpo>
        <SeccionCajon titulo="Datos de la unidad">
          <Datos columnas={2} datos={[
            ['Número de unidad', `n.º ${unidad.id}`],
            ['Código', unidad.codigo_unico],
            asignada && unidad.usuarioAsignado ? ['Asignada a', unidad.usuarioAsignado.nombre] : null,
            asignada && unidad.equipoAsignado ? ['Equipo', unidad.equipoAsignado.nombre] : null,
            asignada && unidad.fecha_asignacion ? ['Desde', <Fecha key="f" valor={unidad.fecha_asignacion} />] : null,
          ]} />
        </SeccionCajon>
        <SeccionCajon titulo="Código QR">
          <div className="r2-inv-codigo-placa r2-inv-codigo-placa--qr" aria-busy={cargandoQr || undefined}>
            {cargandoQr ? <span className="r2-hueso r2-inv-qr-hueso" aria-hidden="true" />
              : qr ? <img src={qr} alt={`Código QR ${unidad.codigo_unico}`} />
                : <p className="r2-inv-codigo-error" role="alert">No se pudo cargar el código QR.</p>}
          </div>
        </SeccionCajon>
      </CajonCuerpo>
    </Cajon>
  );
}

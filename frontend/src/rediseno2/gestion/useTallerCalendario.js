// Rediseño 2 · Gestión · lee lo que el Calendario necesita del taller (ver tallerCalendario.js): el panel de producción
// (endpoint público de las TV, cada 2 min) y las órdenes de compra enviadas o parciales (cada 5 min). Solo lee.
import { useEffect, useMemo, useState } from 'react';
import { useProduccionData } from '../../hooks/useProduccionData';
import ordenesCompraService from '../../services/ordenesCompra.service';
import { armarTaller } from './tallerCalendario';

const CADA_ORDENES = 5 * 60 * 1000;

/** Trabajos de taller para el calendario (se refresca solo: producción cada 2 min, compras cada 5 min). */
export function useTallerCalendario() {
  const { proyectos } = useProduccionData({ isPublic: true, refreshInterval: 2 * 60 * 1000 });
  const [ordenes, setOrdenes] = useState([]);
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const [enviadas, parciales] = await Promise.all([
          ordenesCompraService.listarOrdenes({ estado: 'enviada', limit: 200 }),
          ordenesCompraService.listarOrdenes({ estado: 'parcial', limit: 200 }),
        ]);
        if (vivo) setOrdenes([...(enviadas?.data?.ordenes || []), ...(parciales?.data?.ordenes || [])]);
      } catch (e) {
        console.warn('Calendario: no se pudieron leer las órdenes de compra', e?.message);
      }
    };
    cargar();
    const id = setInterval(cargar, CADA_ORDENES);
    return () => { vivo = false; clearInterval(id); };
  }, []);
  return useMemo(() => armarTaller(proyectos, ordenes), [proyectos, ordenes]);
}

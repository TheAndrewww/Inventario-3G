// Rediseño 2 · ayudas de las pantallas de piso (TV y terminal) (DISENO-v2 §3.6 y §4.16). Ninguna pide nada al servidor.
//
// const tema = useTemaPiso('tv');                       → 'oscuro' | 'claro'
//   1) ?tema=claro|oscuro en la liga de esta carga (index.html lo anota en window.G3_TEMA_PISO); 2) el tema guardado en ese
//   navegador (diseno-3g-tema; «automático» sigue al equipo); 3) por omisión: TV oscuro, terminal claro.
// const pag = usePaginasAuto(obras, 8, 20);              → { visibles, numero, total, segundos }
//   Reparte la lista que YA llegó en páginas y las cambia solas cada 20 s (no pide nada). Mismo orden de la lista.
// const hora = useHoraDeDatos(proyectos);                → { hora: Date | null, viejo: boolean }
//   Guarda la hora en que cambiaron los datos; si en 3 minutos no cambian (la red se cayó), viejo = true.
import { useEffect, useState } from 'react';

export function useTemaPiso(tipo = 'tv') {
  const [tema] = useState(() => {
    let q = window.G3_TEMA_PISO;
    if (!q) { try { q = new URLSearchParams(window.location.search).get('tema'); } catch { q = null; } }
    if (q === 'claro' || q === 'oscuro') return q;
    try {
      const t = window.localStorage.getItem('diseno-3g-tema');
      if (t === 'claro' || t === 'oscuro') return t;
      if (t === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    } catch { /* sin almacenamiento */ }
    return tipo === 'tv' ? 'oscuro' : 'claro';
  });
  return tema;
}

export function usePaginasAuto(lista = [], porPagina = 8, segundos = 20) {
  const total = Math.max(1, Math.ceil((lista?.length || 0) / porPagina));
  const [pagina, setPagina] = useState(0);
  const actual = Math.min(pagina, total - 1);
  useEffect(() => {
    if (total <= 1) return undefined;
    const t = window.setInterval(() => setPagina((p) => (Math.min(p, total - 1) + 1) % total), segundos * 1000);
    return () => window.clearInterval(t);
  }, [total, segundos]);
  return {
    visibles: (lista || []).slice(actual * porPagina, actual * porPagina + porPagina),
    numero: actual + 1,
    total,
    segundos,
  };
}

const TRES_MIN = 3 * 60 * 1000;
export function useHoraDeDatos(datos) {
  const [hora, setHora] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (datos === undefined || datos === null) return;
    setHora(new Date());
  }, [datos]);
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 30 * 1000);
    return () => window.clearInterval(t);
  }, []);
  return { hora, viejo: Boolean(hora) && ahora - hora.getTime() > TRES_MIN };
}

import React, { useState, useEffect } from 'react';
import miEquipoService from '../services/miEquipo.service';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import VistaMiEquipo from '../rediseno2/gestion/VistaMiEquipo';

const MiEquipoPage = () => {
    const { user } = useAuth();
    const esAdmin = user?.rol === 'administrador';
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(''); // '' = mi propio equipo
    const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»

    useEffect(() => {
        fetchData(usuarioSeleccionado || null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioSeleccionado]);

    useEffect(() => {
        if (esAdmin) {
            miEquipoService.listarUsuariosConEquipo()
                .then(setUsuariosDisponibles)
                .catch(() => setUsuariosDisponibles([]));
        }
    }, [esAdmin]);

    const fetchData = async (usuarioId = null) => {
        try {
            setLoading(true);
            const response = await miEquipoService.obtenerMiEquipo(usuarioId);
            setData(response);
            setErrorCargaR2(null);
        } catch (error) {
            console.error('Error al cargar datos:', error);
            toast.error('Error al cargar los datos');
            setErrorCargaR2(error?.message || 'Error al cargar los datos');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData(usuarioSeleccionado || null);
        setRefreshing(false);
        toast.success('Datos actualizados');
    };

    return (
        <VistaMiEquipo user={user} esAdmin={esAdmin} loading={loading} data={data} refreshing={refreshing} handleRefresh={handleRefresh}
            usuariosDisponibles={usuariosDisponibles} usuarioSeleccionado={usuarioSeleccionado} setUsuarioSeleccionado={setUsuarioSeleccionado}
            errorCarga={errorCargaR2} recargar={() => fetchData(usuarioSeleccionado || null)} />
    );
};

export default MiEquipoPage;

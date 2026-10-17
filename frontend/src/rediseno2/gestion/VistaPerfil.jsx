// Rediseño 2 · Gestión · Mi perfil (/perfil), vista ENCENDIDA. Todos, rara vez: ver con qué cuenta están y cerrar sesión.
// Antes: avatar de 128 px, una tarjeta de 850 px y «Cambiar contraseña» y «Configuración» con aspecto de acción principal
// aunque no hacen nada. Ahora: una columna de lectura con los datos de la cuenta, «Cerrar sesión» como la acción de la
// pantalla y las dos opciones sin función como renglones desactivados con «Pronto» (anexo A, 8).
import { LogOut, KeyRound, Settings } from 'lucide-react';
import { Pagina, EncabezadoPagina, Datos, Seccion, Boton, iniciales } from '../fundacion';
import { nombreRol } from './comunes';
import './gestion.css';

export default function VistaPerfil({ user, handleLogout }) {
  return (
    <Pagina className="r2g-pagina" titulo="Mi perfil" ancho="lectura">
      <EncabezadoPagina titulo="Mi perfil" />
      <div className="r2g-perfil">
        <span className="g3-avatar r2g-perfil-avatar" aria-hidden="true">{iniciales(user?.nombre)}</span>
        <div className="r2g-celda-doble">
          <span className="r2g-perfil-nombre">{user?.nombre || 'Usuario'}</span>
          <span className="r2g-sec">{nombreRol(user?.rol)}</span>
        </div>
      </div>
      <Seccion titulo="Tu cuenta">
        <Datos columnas={2} datos={[['Nombre', user?.nombre], ['Rol', nombreRol(user?.rol)], { etiqueta: 'Correo', valor: user?.email, ancho: 'doble' }]} />
      </Seccion>
      <Seccion titulo="Opciones">
        <ul className="r2g-lista-simple">
          <li className="r2g-lista-simple-fila r2g-opcion-pronto" aria-disabled="true">
            <KeyRound size={20} aria-hidden="true" className="r2g-sec" />
            <span className="r2g-celda-doble r2g-crece"><span className="r2g-fuerte">Cambiar contraseña</span><span className="r2g-sec">Actualiza tu contraseña</span></span>
            <span className="r2g-pronto">Pronto</span>
          </li>
          <li className="r2g-lista-simple-fila r2g-opcion-pronto" aria-disabled="true">
            <Settings size={20} aria-hidden="true" className="r2g-sec" />
            <span className="r2g-celda-doble r2g-crece"><span className="r2g-fuerte">Configuración</span><span className="r2g-sec">Preferencias de la cuenta</span></span>
            <span className="r2g-pronto">Pronto</span>
          </li>
        </ul>
      </Seccion>
      <div className="r2g-perfil-salir">
        <Boton nivel="contorno" icono={LogOut} alHacer={handleLogout}>Cerrar sesión</Boton>
        <span className="r2g-sec">Sales de Planta en este equipo.</span>
      </div>
    </Pagina>
  );
}

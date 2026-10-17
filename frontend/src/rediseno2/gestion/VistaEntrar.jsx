// Rediseño 2 · Gestión · Entrar (/login) y «Entrando…» (/entrar/regreso), vistas ENCENDIDAS.
// Antes: «ERP 3G Inventario», «Iniciar Sesión», «Correo Electrónico», un logo de otra marca y un pie «© 2025 3G Textil»: tres
// nombres para el mismo sistema. Ahora: un solo bloque de 400 px con «Planta · 3G Velarias», correo, contraseña (con
// «Mostrar»), «Entrar» como única acción azul y el error en una caja bajo el formulario. Mismo envío (handleSubmit →
// POST /auth/login), mismos mensajes (incluido «Demasiados intentos. Espera N minutos.») y la misma entrada con Cuentas 3G
// cuando VITE_CUENTAS3G_MODO la pide.
import { useState } from 'react';
import { AlertCircle, LogIn, Eye, EyeOff } from 'lucide-react';
import { Campo, Entrada, Boton } from '../fundacion';
import './gestion.css';

function Marca({ subtitulo }) {
  return (
    <div className="r2g-entrar-marca">
      <span className="g3-logo-marca r2g-entrar-logo" aria-hidden="true">3G</span>
      <h1 className="r2g-entrar-titulo">Planta <span className="r2g-entrar-titulo-sec">· 3G Velarias</span></h1>
      {subtitulo && <p className="r2g-sec">{subtitulo}</p>}
    </div>
  );
}

function CajaError({ texto }) {
  if (!texto) return null;
  return (
    <div className="r2g-entrar-error" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}

export default function VistaEntrar({
  formData, handleChange, handleSubmit, loading, error, conC3g, botonC3g, conFormulario, emergenciaC3g, yendoC3g, entrarConC3g,
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="r2g-entrar">
      <main className="r2g-entrar-bloque">
        <Marca subtitulo="Entra con tu cuenta de trabajo" />

        {conC3g && (
          <div className="r2g-entrar-c3g">
            <CajaError texto={error} />
            {botonC3g && (
              <>
                <Boton nivel="principal" tamano="grande" anchoCompleto icono={LogIn} alHacer={entrarConC3g} deshabilitado={yendoC3g}>
                  {yendoC3g ? 'Abriendo Cuentas 3G…' : 'Entrar con tu cuenta 3G'}
                </Boton>
                <p className="r2g-sec r2g-centro">Con tu cuenta de Google de 3G: una sola cuenta para todos los sistemas.</p>
              </>
            )}
            {!conFormulario && (
              <p className="r2g-sec r2g-centro">El acceso con correo y contraseña ya no se usa en Planta. ¿No puedes entrar? Pide ayuda a Dirección.</p>
            )}
            {conFormulario && botonC3g && (
              <div className="r2g-entrar-separador" aria-hidden="true"><span>{emergenciaC3g ? 'Acceso de emergencia · solo Dirección' : 'o usa el acceso de siempre'}</span></div>
            )}
            {emergenciaC3g && <p className="r2g-sec">Úsalo solo si Cuentas 3G no responde. Es solo para Dirección y cada entrada queda en el registro.</p>}
          </div>
        )}

        {conFormulario && (
          <form className="r2g-entrar-form" onSubmit={handleSubmit}>
            <Campo etiqueta="Correo">
              <Entrada type="email" name="email" value={formData.email} onChange={handleChange} placeholder="nombre@empresa.com" autoComplete="username" required />
            </Campo>
            <Campo etiqueta="Contraseña">
              <span className="r2g-entrar-clave">
                <Entrada type={ver ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} autoComplete="current-password" required />
                <button type="button" className="r2g-entrar-ver" onClick={() => setVer((v) => !v)} aria-pressed={ver} aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}>
                  {ver ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  <span>{ver ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </span>
            </Campo>
            {!conC3g && <CajaError texto={error} />}
            <Boton nivel={conC3g && botonC3g ? 'contorno' : 'principal'} tamano="grande" tipo="submit" anchoCompleto cargando={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Boton>
            {/* Igual que hoy: el enlace no lleva a ningún lado (error que ya existe, anexo B 10) */}
            <a href="#" className="r2g-enlace r2g-centro r2g-entrar-olvido">¿Olvidaste tu contraseña?</a>
          </form>
        )}
      </main>
    </div>
  );
}

/** «Entrando…» mientras Planta canjea el regreso de Cuentas 3G (mismo texto de la página). */
export function VistaEntrando({ texto }) {
  return (
    <div className="r2g-entrar">
      <main className="r2g-entrar-bloque" role="status" aria-live="polite">
        <Marca />
        <div className="r2g-entrar-esqueleto" aria-hidden="true">
          <span className="r2-hueso" style={{ width: '70%' }} />
          <span className="r2-hueso r2-hueso--tenue" style={{ width: '90%' }} />
        </div>
        <p className="r2g-fuerte r2g-centro">{texto}</p>
        <p className="r2g-sec r2g-centro">Cuentas 3G ya revisó tu cuenta; Planta está abriendo tu sesión.</p>
      </main>
    </div>
  );
}

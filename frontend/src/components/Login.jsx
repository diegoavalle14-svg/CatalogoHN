import React, { useState, useEffect } from 'react';
import { Building2, Check, Eye, EyeOff, X } from 'lucide-react';
import { api } from '../lib/api';
import { resolveMediaUrl } from './Comunes';

export function Login({ onLogin, theme, onThemeToggle }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotValue, setForgotValue] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState('kolben');
  const [selectedTenantName, setSelectedTenantName] = useState('');
  const [superadminMode, setSuperadminMode] = useState(false);
  const [tenantTiles, setTenantTiles] = useState([]);

  // Estados para Modal Solicitar Acceso
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const [requestAccessForm, setRequestAccessForm] = useState({ empresa_nombre: '', contacto: '', email: '', telefono: '', rubro: '', mensaje: '' });
  const [requestAccessErrors, setRequestAccessErrors] = useState({});
  const [requestAccessLoading, setRequestAccessLoading] = useState(false);
  const [requestAccessSuccess, setRequestAccessSuccess] = useState(false);

  // Estados para Modal Soporte Técnico
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportForm, setSupportForm] = useState({ nombre: '', contacto: '', tipo_problema: 'Acceso / Contraseña', descripcion: '' });
  const [supportErrors, setSupportErrors] = useState({});
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);

  async function submitRequestAccess(e) {
    e.preventDefault();
    const errors = {};
    if (!requestAccessForm.empresa_nombre.trim()) errors.empresa_nombre = 'El nombre de la empresa es obligatorio';
    if (!requestAccessForm.contacto.trim()) errors.contacto = 'El nombre de contacto es obligatorio';
    if (!requestAccessForm.email.trim() && !requestAccessForm.telefono.trim()) {
      errors.contacto_info = 'Ingresa un correo o un teléfono';
    } else if (requestAccessForm.email.trim() && !/\S+@\S+\.\S+/.test(requestAccessForm.email.trim())) {
      errors.email = 'Correo electrónico inválido';
    }

    if (Object.keys(errors).length > 0) {
      setRequestAccessErrors(errors);
      return;
    }

    setRequestAccessLoading(true);
    setRequestAccessErrors({});
    try {
      await api.createRegistrationRequest(requestAccessForm);
      setRequestAccessSuccess(true);
    } catch (err) {
      setRequestAccessErrors({ submit: err.message || 'No se pudo enviar la solicitud' });
    } finally {
      setRequestAccessLoading(false);
    }
  }

  async function submitSupportRequest(e) {
    e.preventDefault();
    const errors = {};
    if (!supportForm.nombre.trim()) errors.nombre = 'Tu nombre o empresa es obligatorio';
    if (!supportForm.contacto.trim()) errors.contacto = 'Tu contacto (correo o celular) es obligatorio';
    if (!supportForm.descripcion.trim()) errors.descripcion = 'Describe brevemente el problema';

    if (Object.keys(errors).length > 0) {
      setSupportErrors(errors);
      return;
    }

    setSupportLoading(true);
    setSupportErrors({});
    try {
      await api.createSupportRequest(supportForm);
      setSupportSuccess(true);
    } catch (err) {
      setSupportErrors({ submit: err.message || 'No se pudo enviar la solicitud de soporte' });
    } finally {
      setSupportLoading(false);
    }
  }

  useEffect(() => {
    document.documentElement.classList.add('landing-html');
    const meta = document.querySelector('meta[name="theme-color"]');
    const originalColor = meta ? meta.getAttribute('content') : '#F5C200';
    if (meta) meta.setAttribute('content', '#1a1a1e');

    return () => {
      document.documentElement.classList.remove('landing-html');
      if (meta) meta.setAttribute('content', originalColor);
    };
  }, []);

  useEffect(() => {
    api.publicTenants()
      .then((payload) => {
        const params = new URLSearchParams(window.location.search);
        const requestedSlug = params.get('tenant') || params.get('empresa');
        const activeTenants = (payload.tenants || [])
          .filter((tenant) => tenant.activa !== false)
          .map((tenant) => ({
            slug: tenant.slug,
            name: tenant.nombre || tenant.slug?.toUpperCase() || 'Empresa',
            sector: tenant.subnombre || '',
            logo_url: tenant.logo_url,
            color_primario: tenant.color_primario,
            color_secundario: tenant.color_secundario,
            fuente: tenant.fuente,
            domain: `${tenant.slug}.catalogohn.com`,
            status: 'ACTIVO',
            available: true
          }));
        if (activeTenants.length) {
          setTenantTiles(activeTenants);
          const requestedTenant = activeTenants.find((tenant) => tenant.slug === requestedSlug);
          setSelectedTenant((current) => requestedTenant?.slug || (activeTenants.some((tenant) => tenant.slug === current) ? current : activeTenants[0].slug));
          setSelectedTenantName(requestedTenant?.name || activeTenants[0].name);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (path === '/santi' || params.has('santi')) {
      setSuperadminMode(true);
      setUsername('');
      setPassword('');
      setLoginOpen(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onLogin(await api.login({ username, password, tenantSlug: superadminMode ? 'kolben' : selectedTenant, superadminMode }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotMessage('');
    try {
      const result = await api.forgotPassword({
        username: forgotValue || username,
        tenantSlug: superadminMode ? 'kolben' : selectedTenant
      });
      if (result?.temp_password) {
        setForgotMessage(`Contraseña temporal: ${result.temp_password}`);
      } else {
        setForgotMessage(result?.message || 'Si el usuario existe, recibirás una contraseña temporal.');
      }
    } catch (err) {
      setForgotError(err.message || 'No se pudo iniciar la recuperación');
    } finally {
      setForgotLoading(false);
    }
  }

  function closeLoginModal() {
    if (loading || forgotLoading) return;
    setLoginOpen(false);
    setError('');
    setForgotOpen(false);
    setForgotValue('');
    setForgotError('');
    setForgotMessage('');
  }

  return (
    <main className="login-screen landing-screen">
      <div className="login-screen-inner">

        {/* -- Encabezado principal -- */}
        <div className="landing-logo-wrap">
          <span className="landing-logo">
            Catálogo<span className="landing-logo-hn">HN</span>
          </span>
          <p className="landing-subtitle">Crea tu catálogo digital con precios personalizados para cada cliente.</p>
        </div>

        <div className="landing-divider" />

        {/* -- Grid de empresas -- */}
        <div className="tenant-grid">
          {tenantTiles.map((tenant) => (
            <button
              className="tenant-tile active"
              key={tenant.slug}
              onClick={() => {
                setSelectedTenant(tenant.slug);
                setSelectedTenantName(tenant.name);
                setSuperadminMode(false);
                setForgotOpen(false);
                setForgotValue('');
                setForgotError('');
                setForgotMessage('');
                setLoginOpen(true);
              }}
              aria-label={`Seleccionar ${tenant.name}`}
            >
              <div className="tenant-tile-logo-badge">
                {tenant.logo_url ? (
                  <img className="tenant-tile-logo" src={resolveMediaUrl(tenant.logo_url)} alt={tenant.name} />
                ) : (
                  <Building2 size={24} className="tenant-tile-placeholder-icon" />
                )}
              </div>
              <span className="tenant-tile-name">{tenant.name}</span>
            </button>
          ))}
          {Array.from({ length: Math.max(0, 6 - tenantTiles.length) }).map((_, i) => (
            <div className="tenant-tile coming-soon" key={`soon-${i}`}>
              <div className="tenant-tile-logo-badge soon-badge">
                <Building2 size={24} className="tenant-tile-placeholder-icon" />
              </div>
              <span className="tenant-tile-name">próximamente</span>
            </div>
          ))}
        </div>

        <div className="landing-divider" />

        {/* -- Sección inferior -- */}
        <div className="landing-bottom">
          <div className="landing-bottom-block">
            <strong>Registra tu<br />empresa</strong>
            <button
              className="landing-outline-btn"
              type="button"
              onClick={() => {
                setRequestAccessForm({ empresa_nombre: '', contacto: '', email: '', telefono: '', rubro: '', mensaje: '' });
                setRequestAccessErrors({});
                setRequestAccessSuccess(false);
                setRequestAccessOpen(true);
              }}
            >
              SOLICITAR ACCESO
            </button>
          </div>
          <div className="landing-bottom-block">
            <strong>¿Problemas para<br />ingresar a tu cuenta?</strong>
            <button
              className="landing-outline-btn"
              type="button"
              onClick={() => {
                setSupportForm({ nombre: '', contacto: '', tipo_problema: 'Acceso / Contraseña', descripcion: '' });
                setSupportErrors({});
                setSupportSuccess(false);
                setSupportOpen(true);
              }}
            >
              CONTACTAR SOPORTE
            </button>
          </div>
        </div>

      </div>

      {/* -- Modal Solicitar Acceso -- */}
      {requestAccessOpen && (
        <div className="login-modal-backdrop" onClick={() => !requestAccessLoading && setRequestAccessOpen(false)}>
          <section className="login-modal modal-form-custom" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-head">
              <h2>Solicitar Acceso a CatálogoHN</h2>
              <button className="icon-button" onClick={() => setRequestAccessOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            {requestAccessSuccess ? (
              <div className="modal-success-state">
                <div className="success-icon-badge">
                  <Check size={32} />
                </div>
                <h3>¡Solicitud Enviada!</h3>
                <p>Hemos recibido tu información. Nuestro equipo se pondrá en contacto contigo muy pronto para brindarte acceso.</p>
                <button type="button" className="landing-outline-btn primary-btn" onClick={() => setRequestAccessOpen(false)}>
                  Entendido
                </button>
              </div>
            ) : (
              <>
                <p>Llena tus datos para registrar tu empresa en la plataforma:</p>
                {requestAccessErrors.submit && <div className="form-error-alert">{requestAccessErrors.submit}</div>}
                <form onSubmit={submitRequestAccess} className="login-modal-form custom-form-grid">
                  <label>
                    Nombre de la Empresa *
                    <input
                      value={requestAccessForm.empresa_nombre}
                      onChange={(e) => setRequestAccessForm({ ...requestAccessForm, empresa_nombre: e.target.value })}
                      className={requestAccessErrors.empresa_nombre ? 'input-error' : ''}
                    />
                    {requestAccessErrors.empresa_nombre && <span className="field-error">{requestAccessErrors.empresa_nombre}</span>}
                  </label>
                  <label>
                    Nombre de Contacto *
                    <input
                      value={requestAccessForm.contacto}
                      onChange={(e) => setRequestAccessForm({ ...requestAccessForm, contacto: e.target.value })}
                      className={requestAccessErrors.contacto ? 'input-error' : ''}
                    />
                    {requestAccessErrors.contacto && <span className="field-error">{requestAccessErrors.contacto}</span>}
                  </label>
                  <div className="form-row-2">
                    <label>
                      Correo Electrónico
                      <input
                        type="email"
                        value={requestAccessForm.email}
                        onChange={(e) => setRequestAccessForm({ ...requestAccessForm, email: e.target.value })}
                        className={requestAccessErrors.email || requestAccessErrors.contacto_info ? 'input-error' : ''}
                      />
                      {requestAccessErrors.email && <span className="field-error">{requestAccessErrors.email}</span>}
                    </label>
                    <label>
                      Teléfono / WhatsApp
                      <input
                        type="tel"
                        value={requestAccessForm.telefono}
                        onChange={(e) => setRequestAccessForm({ ...requestAccessForm, telefono: e.target.value })}
                        className={requestAccessErrors.contacto_info ? 'input-error' : ''}
                      />
                    </label>
                  </div>
                  {requestAccessErrors.contacto_info && <span className="field-error block-error">{requestAccessErrors.contacto_info}</span>}
                  <label>
                    Rubro / Categoría
                    <input
                      value={requestAccessForm.rubro}
                      onChange={(e) => setRequestAccessForm({ ...requestAccessForm, rubro: e.target.value })}
                    />
                  </label>
                  <label>
                    Mensaje adicional (opcional)
                    <textarea
                      rows={3}
                      value={requestAccessForm.mensaje}
                      onChange={(e) => setRequestAccessForm({ ...requestAccessForm, mensaje: e.target.value })}
                    />
                  </label>
                  <button type="submit" className="login-submit-button" disabled={requestAccessLoading}>
                    {requestAccessLoading ? 'Enviando...' : 'ENVIAR SOLICITUD'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {/* -- Modal Contactar Soporte -- */}
      {supportOpen && (
        <div className="login-modal-backdrop" onClick={() => !supportLoading && setSupportOpen(false)}>
          <section className="login-modal modal-form-custom" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-head">
              <h2>Soporte Técnico CatálogoHN</h2>
              <button className="icon-button" onClick={() => setSupportOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            {supportSuccess ? (
              <div className="modal-success-state">
                <div className="success-icon-badge">
                  <Check size={32} />
                </div>
                <h3>¡Reporte Enviado!</h3>
                <p>Tu solicitud de soporte técnico fue registrada. Nos comunicaremos contigo a la brevedad para ayudarte.</p>
                <button type="button" className="landing-outline-btn primary-btn" onClick={() => setSupportOpen(false)}>
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <p>¿Tienes problemas para ingresar o dudas sobre tu cuenta?</p>
                {supportErrors.submit && <div className="form-error-alert">{supportErrors.submit}</div>}
                <form onSubmit={submitSupportRequest} className="login-modal-form custom-form-grid">
                  <label>
                    Tu Nombre o Nombre de Empresa *
                    <input
                      value={supportForm.nombre}
                      onChange={(e) => setSupportForm({ ...supportForm, nombre: e.target.value })}
                      className={supportErrors.nombre ? 'input-error' : ''}
                    />
                    {supportErrors.nombre && <span className="field-error">{supportErrors.nombre}</span>}
                  </label>
                  <label>
                    Correo o Número de Teléfono / WhatsApp *
                    <input
                      value={supportForm.contacto}
                      onChange={(e) => setSupportForm({ ...supportForm, contacto: e.target.value })}
                      className={supportErrors.contacto ? 'input-error' : ''}
                    />
                    {supportErrors.contacto && <span className="field-error">{supportErrors.contacto}</span>}
                  </label>
                  <label>
                    Tipo de Consulta o Inconveniente
                    <select
                      value={supportForm.tipo_problema}
                      onChange={(e) => setSupportForm({ ...supportForm, tipo_problema: e.target.value })}
                    >
                      <option value="Acceso / Contraseña">Olvido o restablecimiento de contraseña</option>
                      <option value="Usuario Bloqueado">Usuario o cuenta bloqueada</option>
                      <option value="Problema en Catálogo">Inconveniente con productos o precios</option>
                      <option value="Otro">Otro problema técnico</option>
                    </select>
                  </label>
                  <label>
                    Descripción del Problema *
                    <textarea
                      rows={3}
                      value={supportForm.descripcion}
                      onChange={(e) => setSupportForm({ ...supportForm, descripcion: e.target.value })}
                      className={supportErrors.descripcion ? 'input-error' : ''}
                    />
                    {supportErrors.descripcion && <span className="field-error">{supportErrors.descripcion}</span>}
                  </label>
                  <button type="submit" className="login-submit-button" disabled={supportLoading}>
                    {supportLoading ? 'Enviando reporte...' : 'ENVIAR MENSAJE DE SOPORTE'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {/* -- Modal de login -- */}
      {loginOpen && (
        <div className="login-modal-backdrop" onClick={closeLoginModal}>
          <section className="login-modal" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-head">
              <h2>{superadminMode ? 'Ingreso superadministrador' : `Ingreso ${selectedTenantName}`}</h2>
              <button className="icon-button" onClick={closeLoginModal} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <p>{superadminMode ? 'Acceso exclusivo de plataforma' : `Acceso privado de ${selectedTenantName}`}</p>
            <form onSubmit={submit} className="login-modal-form">
              <label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
              <label>
                Contraseña
                <div className="password-input-wrapper">
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type={showLoginPassword ? "text" : "password"} autoComplete="current-password" />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowLoginPassword(!showLoginPassword)} tabIndex="-1" aria-label={showLoginPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {error && <small className="form-error">{error}</small>}

              <button className="primary-button" disabled={loading}>
                {loading ? 'Validando...' : 'Ingresar'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

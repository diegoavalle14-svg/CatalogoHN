import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Activity, AlertTriangle, BadgeCheck, BadgeDollarSign, Bell, BellOff, Building2, Check, ChevronDown, ChevronUp, ClipboardList, Copy, Edit2, ExternalLink, Eye, EyeOff, Folder, LogOut, Menu, Moon, MoreVertical, Package, PackageSearch, Plus, RefreshCw, RotateCcw, Search, Settings2, ShoppingCart, Sun, Tags, Trash2, Users, UserX, UserCheck, WifiOff, X } from 'lucide-react';
import { API_PUBLIC_ORIGIN, api } from './lib/api';
import { bootstrapSessionFromUrl, clearSession, clearTemporarySession, clearUiState, loadSession, loadUiState, saveSession, updateUiState } from './lib/storage';
import './styles.css';

const money = (value) => `L.\u00A0${Number(value || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;
const THEME_STORAGE_KEY = 'catalogohn-theme';

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedTheme() {
  if (typeof localStorage === 'undefined') return null;
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return ['light', 'dark'].includes(saved) ? saved : null;
}

function stockMeta(product) {
  const stock = Number(product?.stock_actual ?? 0);
  const minimum = Number(product?.stock_minimo ?? 0);
  if (stock <= 0) return { stock, label: 'Agotado', tone: 'out' };
  if (minimum > 0 && stock <= minimum) return { stock, label: `Quedan ${stock}`, tone: 'low' };
  return { stock, label: `Stock ${stock}`, tone: 'ok' };
}

function resolveMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (typeof window === 'undefined') return raw;

  if (raw.startsWith('/uploads/')) {
    return `${API_PUBLIC_ORIGIN}${raw}`;
  }

  try {
    const url = new URL(raw);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      url.hostname = window.location.hostname;
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const isToday = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};
const SITE_SUBNAME_OPTIONS = [];
const SUBNAME_OPTIONS_KEY = 'catalogohn.superadmin.subnames.v2';

function loadSubnombreOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUBNAME_OPTIONS_KEY) || '[]');
    const merged = [...SITE_SUBNAME_OPTIONS, ...(Array.isArray(saved) ? saved : [])]
      .map((option) => String(option || '').trim())
      .filter(Boolean);
    return [...new Set(merged)];
  } catch {
    return [];
  }
}

function saveSubnombreOptions(options) {
  const clean = [...new Set((options || []).map((option) => String(option || '').trim()).filter(Boolean))];
  localStorage.setItem(SUBNAME_OPTIONS_KEY, JSON.stringify(clean));
}
const SITE_FONT_OPTIONS = [
  { value: 'Aptos', label: 'Aptos' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'Bahnschrift', label: 'Bahnschrift' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Inter Tight', label: 'Inter Tight' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
  { value: 'IBM Plex Sans', label: 'IBM Plex Sans' },
  { value: 'Barlow', label: 'Barlow' },
  { value: 'Archivo Narrow', label: 'Archivo Narrow' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Nunito Sans', label: 'Nunito Sans' },
  { value: 'Merriweather Sans', label: 'Merriweather Sans' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Lora', label: 'Lora' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Fraunces', label: 'Fraunces' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Roboto Condensed', label: 'Roboto Condensed' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono' }
];

function defaultViewForRole(role) {
  if (role === 'superadmin') return 'superadmin';
  if (role === 'cliente') return 'catalog';
  if (role === 'admin') return 'admin';
  return 'catalog';
}

function resolveInitialView(session, uiState) {
  const role = session?.user?.rol;
  if (!role) return 'catalog';
  if (role === 'cliente') {
    return uiState?.appView === 'history' ? 'history' : 'catalog';
  }
  return defaultViewForRole(role);
}

function App() {
  bootstrapSessionFromUrl();
  const [session, setSession] = useState(() => loadSession());
  const [view, setView] = useState(() => resolveInitialView(loadSession(), loadUiState()));
  const [themeOverride, setThemeOverride] = useState(() => getSavedTheme());
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
  const theme = themeOverride || systemTheme;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeOverride(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  useEffect(() => {
    api.setTenantSlug(session?.tenant?.slug || 'kolben');
  }, [session?.tenant?.slug]);

  const handleLogin = (nextSession) => {
    const nextView = defaultViewForRole(nextSession?.user?.rol);
    api.setTenantSlug(nextSession?.tenant?.slug || 'kolben');
    saveSession(nextSession);
    setSession(nextSession);
    setView(nextView);
    updateUiState((current) => ({ ...current, appView: nextView }));
  };

  const logout = () => {
    if (session?.impersonated_from?.user?.rol === 'superadmin') {
      const originalSession = session.impersonated_from;
      api.setTenantSlug(originalSession?.tenant?.slug || 'kolben');
      clearTemporarySession();
      saveSession(originalSession);
      setSession(originalSession);
      setView('superadmin');
      return;
    }
    api.setTenantSlug('kolben');
    clearSession();
    clearUiState();
    setSession(null);
    setView('catalog');
  };

  useEffect(() => {
    if (!session || session.user?.rol !== 'cliente') return;
    updateUiState((current) => ({ ...current, appView: view }));
  }, [session, view]);

  if (!session) return <Login onLogin={handleLogin} theme={theme} onThemeToggle={toggleTheme} />;

  if (session.user.rol === 'superadmin') {
    return <SuperAdminShell
      session={session}
      onLogout={logout}
      onSessionChange={setSession}
      onViewChange={setView}
      theme={theme}
      onThemeToggle={toggleTheme}
    />;
  }

  if (session.user.rol === 'admin') {
    return <Admin session={session} onLogout={logout} onAuthExpired={logout} onRestoreSuperadmin={session?.impersonated_from?.user?.rol === 'superadmin' ? () => {
      const originalSession = session.impersonated_from;
      api.setTenantSlug(originalSession?.tenant?.slug || 'kolben');
      clearTemporarySession();
      saveSession(originalSession);
      setSession(originalSession);
      setView('superadmin');
    } : null} theme={theme} onThemeToggle={toggleTheme} onTenantUpdated={(tenant) => {
      const nextSession = { ...session, tenant };
      api.setTenantSlug(tenant?.slug || session?.tenant?.slug || 'kolben');
      saveSession(nextSession);
      setSession(nextSession);
    }} />;
  }

  const updateClientSession = ({ tenant, user }) => {
    if (!tenant && !user) return;
    setSession((current) => {
      if (!current) return current;
      const previous = current.tenant || {};
      const previousUser = current.user || {};
      const tenantChanged = tenant && ['nombre', 'subnombre', 'slug', 'logo_url', 'color_primario', 'color_secundario', 'fuente']
        .some((key) => String(previous[key] || '') !== String(tenant[key] || ''));
      const userChanged = user && ['nombre', 'username', 'email', 'condicion_credito', 'cliente_activo', 'aplica_isv']
        .some((key) => String(previousUser[key] || '') !== String(user[key] || ''));
      const changed = tenantChanged || userChanged;
      if (!changed) return current;
      const nextSession = {
        ...current,
        tenant: tenant ? { ...previous, ...tenant } : previous,
        user: user ? { ...previousUser, ...user } : previousUser
      };
      saveSession(nextSession);
      api.setTenantSlug(nextSession.tenant?.slug || 'kolben');
      return nextSession;
    });
  };

  return (
    <Shell session={session} view={view} setView={setView} onLogout={logout} theme={theme} onThemeToggle={toggleTheme}>
      {view === 'catalog' && <Catalog session={session} onSessionUpdated={updateClientSession} />}
      {view === 'history' && <History session={session} />}
      {view === 'admin' && <Admin session={session} />}
    </Shell>
  );
}

function Shell({ session, view, setView, onLogout, theme, onThemeToggle, children }) {
  const [cartCount, setCartCount] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const tenant = session.tenant || {};

  useEffect(() => {
    const updateCartCount = (event) => setCartCount(event.detail?.count || 0);
    window.addEventListener('catalog:cart-count', updateCartCount);
    return () => window.removeEventListener('catalog:cart-count', updateCartCount);
  }, []);

  useEffect(() => {
    const handleCartOpenState = (event) => setIsCartOpen(event.detail?.open || false);
    window.addEventListener('catalog:cart-open-state', handleCartOpenState);
    return () => window.removeEventListener('catalog:cart-open-state', handleCartOpenState);
  }, []);

  function goToCatalog() {
    setView('catalog');
    window.dispatchEvent(new Event('catalog:close-cart'));
  }

  function openCart() {
    if (view !== 'catalog') {
      setView('catalog');
      window.setTimeout(() => window.dispatchEvent(new Event('catalog:open-cart')), 0);
      return;
    }
    if (isCartOpen) {
      window.dispatchEvent(new Event('catalog:close-cart'));
    } else {
      window.dispatchEvent(new Event('catalog:open-cart'));
    }
  }
  const topbarRef = useRef(null);

  useEffect(() => {
    if (!topbarRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        document.documentElement.style.setProperty('--catalog-topbar-height', `${entry.target.offsetHeight}px`);
      }
    });
    observer.observe(topbarRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell" style={tenantBrandStyle(tenant)}>
      <header className="topbar" ref={topbarRef}>
        <button className="brand-lockup" onClick={goToCatalog} aria-label="Abrir catálogo">
          <TenantLogoMark tenant={tenant} />
          <span>
            <strong>{tenant.nombre || 'Empresa'}</strong>
            <small style={{ '--subnombre-size': `${tenant.subnombre_size || 18}px` }}>{tenant.subnombre || 'Catálogo privado'}</small>
          </span>
        </button>

        <div className="welcome-line">
          <span>Bienvenido,</span>
          <b>{session.user.nombre}</b>
        </div>

        <div className="topbar-actions">
          <button className={`catalog-button ${view === 'catalog' && !isCartOpen ? 'active' : ''}`} onClick={goToCatalog}>
            <Package size={15} />
            <span>Catálogo</span>
          </button>
          <button className={`checkout-button ${view === 'catalog' && isCartOpen ? 'active' : ''}`} onClick={openCart}>
            <ShoppingCart size={18} />
            <span>Ver Pedido</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
          <button className={`orders-button ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>
            <ClipboardList size={14} />
            <span>Mis Pedidos</span>
          </button>
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <button className="logout-button" onClick={onLogout}>
            <LogOut size={15} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

function SuperAdminShell({ session, onLogout, onSessionChange, onViewChange, theme, onThemeToggle }) {
  return (
    <div className="superadmin-shell">
      <main className="login-screen superadmin-screen">
        <SuperAdmin token={session.token} onLogout={onLogout} theme={theme} onThemeToggle={onThemeToggle} />
      </main>
    </div>
  );
}

function ThemeToggle({ theme, onToggle, label = '' }) {
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  return (
    <button className="theme-toggle-button" type="button" onClick={onToggle} aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}>
      <Icon size={15} />
      {label && <span>{label}</span>}
    </button>
  );
}

function ProductStockPill({ product, className = '' }) {
  const stock = stockMeta(product);
  return <span className={`stock-pill ${stock.tone} ${className}`.trim()}>{stock.label}</span>;
}

function TenantLogoMark({ tenant, size = 'normal' }) {
  const label = tenant?.nombre || 'Empresa';
  const logoUrl = resolveMediaUrl(tenant?.logo_url);
  const hasLogo = Boolean(logoUrl);
  return (
    <span className={`logo-mark tenant-logo-mark ${size === 'small' ? 'small' : ''} ${hasLogo ? 'has-logo' : 'needs-logo'}`}>
      {hasLogo ? (
        <img src={logoUrl} alt={`Logo de ${label}`} />
      ) : (
        <>
          <b>Logo</b>
        </>
      )}
    </span>
  );
}

function Login({ onLogin, theme, onThemeToggle }) {
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

function Catalog({ session, onSessionUpdated }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [cart, setCart] = useState({});
  const cartLoadedRef = useRef(false);
  const cartDirtyRef = useRef(false);
  const userIdRef = useRef(session?.user?.id);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  function showToast(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1000);
  }

  useEffect(() => {
    let cancelled = false;
    api.setTenantSlug(session?.tenant?.slug || 'kolben');
    const loadCatalog = () => {
      api.catalog(session.token)
        .then((payload) => {
          if (cancelled) return;
          setData(payload);
          if (payload.tenant || payload.user) onSessionUpdated?.({ tenant: payload.tenant, user: payload.user });
        })
        .catch(console.error);
    };
    loadCatalog();
    const timer = window.setInterval(loadCatalog, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session.token, session?.tenant?.slug]);

  // Cargar carrito del servidor al montar o cambiar de usuario
  useEffect(() => {
    userIdRef.current = session?.user?.id;
    cartLoadedRef.current = false;
    cartDirtyRef.current = false;
    if (!session?.token) return;
    let cancelled = false;
    api.cartLoad(session.token)
      .then((serverCart) => {
        if (cancelled) return;
        setCart(serverCart || {});
        cartLoadedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) cartLoadedRef.current = true;
      });
    return () => { cancelled = true; };
  }, [session?.user?.id, session?.token]);

  // Auto-sync: recargar carrito del servidor cada 10s (solo si no hay cambios locales pendientes)
  useEffect(() => {
    if (!session?.token) return;
    const interval = window.setInterval(() => {
      if (!cartLoadedRef.current || cartDirtyRef.current) return;
      api.cartLoad(session.token)
        .then((serverCart) => {
          if (!cartDirtyRef.current) {
            setCart(serverCart || {});
          }
        })
        .catch(() => {});
    }, 10000);
    return () => window.clearInterval(interval);
  }, [session?.token]);

  // Guardar carrito en el servidor con debounce
  useEffect(() => {
    if (!cartLoadedRef.current || !session?.token) return;
    cartDirtyRef.current = true;
    const timer = window.setTimeout(() => {
      api.cartSave(session.token, cart)
        .then(() => { cartDirtyRef.current = false; })
        .catch(() => { cartDirtyRef.current = false; });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cart, session?.token]);

  const products = useMemo(() => {
    if (!data) return [];
    return data.productos.filter((product) => {
      const haystack = `${product.sku} ${product.descripcion} ${product.marca} ${product.categoria}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesCategory = category === 'all' || Number(product.categoria_id) === Number(category);
      const matchesBrand = brand === 'all' || Number(product.marca_id) === Number(brand);
      return matchesQuery && matchesCategory && matchesBrand;
    });
  }, [data, query, category, brand]);
  const categoryBrands = useMemo(() => {
    if (!data || category === 'all') return [];
    const brandIds = new Set(
      data.productos
        .filter((product) => Number(product.categoria_id) === Number(category))
        .map((product) => Number(product.marca_id))
        .filter(Boolean)
    );
    return (data.marcas || []).filter((item) => brandIds.has(Number(item.id)));
  }, [data, category]);
  const catalogStats = useMemo(() => {
    if (!data) return { total: 0, available: 0, promos: 0, categories: 0 };
    const total = data.productos.length;
    const available = data.productos.filter((product) => stockMeta(product).tone !== 'out').length;
    const promos = data.productos.filter((product) => product.en_promocion).length;
    return {
      total,
      available,
      promos,
      categories: (data.categorias || []).length
    };
  }, [data]);

  const lines = useMemo(() => flattenCart(cart, data), [cart, data]);
  const total = lines.reduce((sum, line) => sum + (Number(line.cantidad) || 0) * line.precio_unitario, 0);
  const cartCount = lines.reduce((sum, line) => sum + (Number(line.cantidad) || 0), 0);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('catalog:cart-count', { detail: { count: cartCount } }));
  }, [cartCount]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('catalog:cart-open-state', { detail: { open: cartOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('catalog:cart-open-state', { detail: { open: false } }));
    };
  }, [cartOpen]);

  useEffect(() => {
    const openCart = () => setCartOpen(true);
    const closeCart = () => setCartOpen(false);
    const handleToast = (e) => showToast(e.detail);
    window.addEventListener('catalog:open-cart', openCart);
    window.addEventListener('catalog:close-cart', closeCart);
    window.addEventListener('catalog:toast', handleToast);
    return () => {
      window.removeEventListener('catalog:open-cart', openCart);
      window.removeEventListener('catalog:close-cart', closeCart);
      window.removeEventListener('catalog:toast', handleToast);
    };
  }, []);

  function updateQty(product, branchId, qty) {
    setCart((current) => {
      const key = String(product.id);
      const nextProduct = { ...(current[key] || {}) };
      const value = qty === '' ? '' : Math.max(0, Number(qty) || 0);
      if (value === 0 && qty !== '') delete nextProduct[branchId];
      else nextProduct[branchId] = value;

      const next = { ...current };
      if (Object.keys(nextProduct).length === 0) delete next[key];
      else next[key] = nextProduct;
      return next;
    });
  }

  function addProductQty(product, branchId, qty) {
    updateQty(product, branchId, qty);
    showToast('Producto agregado al pedido');
  }

  async function sendOrder() {
    setSending(true);
    setOrderError('');
    try {
      const validLines = lines.filter((line) => Number(line.cantidad) > 0);
      if (!validLines.length) throw new Error('El pedido no tiene productos con cantidades válidas.');
      const payload = await api.createOrder(session.token, validLines);
      api.cartClear(session.token).catch(() => {});
      setCart({});
      setConfirming(false);
      setCartOpen(false);
      showToast(payload.pedido?.numero ? `Pedido ${payload.pedido.numero} enviado correctamente` : 'Pedido enviado correctamente');
    } catch (error) {
      setOrderError(error.message || 'No se pudo enviar el pedido');
    } finally {
      setSending(false);
    }
  }

  if (!data) return <Loading label="Cargando catálogo" />;

  return (
    <section className="catalog-page">
      <div className="catalog-sticky-tools">
        <ClearableSearchInput
          className="search-box"
          iconSize={18}
          placeholder="Buscar por codigo, marca o categoria..."
          value={query}
          onChange={setQuery}
        />

        <CategoryFilterStrip categories={data.categorias || []} value={category} onChange={(value) => { setCategory(value); setBrand('all'); }} />
        {category !== 'all' && <BrandFilterStrip brands={categoryBrands} value={brand} onChange={setBrand} />}
      </div>

      <div className="product-count-row">
        <p className="product-count">{products.length} productos</p>
        {(query || category !== 'all' || brand !== 'all') && (
          <button type="button" onClick={() => {
            setQuery('');
            setCategory('all');
            setBrand('all');
          }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="catalog-empty-state">
          <PackageSearch size={28} />
          <strong>No encontramos productos con esos filtros</strong>
          <span>Prueba buscando por SKU, marca, aplicación o categoría.</span>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryMeta={data.categorias.find((item) => Number(item.id) === Number(product.categoria_id))}
              brandMeta={(data.marcas || []).find((item) => Number(item.id) === Number(product.marca_id))}
              branches={withBranchLetters(data.sucursales)}
              quantities={cart[product.id] || {}}
              onQty={updateQty}
              onAdd={addProductQty}
            />
          ))}
        </div>
      )}

      {toast && createPortal(<div className="catalog-toast">{toast}</div>, document.body)}

      {cartOpen && createPortal(
        <CartPanel
          aplicaIsv={session?.user?.aplica_isv === true}
          lines={lines}
          total={total}
          confirming={confirming}
          sending={sending}
          orderError={orderError}
          onClose={() => {
            setCartOpen(false);
            setConfirming(false);
          }}
          onRemove={updateQty}
          onQty={updateQty}
          onReview={() => setConfirming(false)}
          onConfirm={() => setConfirming(true)}
          onSend={sendOrder}
        />,
        document.body
      )}
    </section>
  );
}

function ProductCard({ product, categoryMeta, brandMeta, branches, quantities, onQty, onAdd, enableLightbox = true }) {
  const availableBranches = Array.isArray(branches) ? branches : [];
  const [drafts, setDrafts] = useState({});
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const currentPrice = Number(product.precio_final || product.precio || 0);
  const oldPrice = Number(product.precio || 0);
  const productImages = cleanProductImages(product.imagenes);
  const stock = stockMeta(product);
  const isOutOfStock = stock.tone === 'out';
  const canOrder = availableBranches.length > 0 && !isOutOfStock;

  function draftFor(branchId) {
    return drafts[branchId] !== undefined ? drafts[branchId] : '';
  }

  function setDraft(branchId, value) {
    if (value === '') {
      setDrafts((current) => ({ ...current, [branchId]: '' }));
      return;
    }
    const next = Math.max(0, Number(value) || 0);
    
    let otherTotal = 0;
    availableBranches.forEach(b => {
      if (b.id !== branchId) {
        otherTotal += (Number(drafts[b.id]) || 0) + (Number(quantities[b.id]) || 0);
      }
    });
    const inCart = Number(quantities[branchId]) || 0;
    const maxAllowed = stock.stock > 0 ? Math.max(0, stock.stock - otherTotal - inCart) : undefined;
    
    let finalVal = next;
    if (maxAllowed !== undefined && next > maxAllowed) {
      finalVal = maxAllowed;
      window.dispatchEvent(new CustomEvent('catalog:toast', { detail: `Límite: Solo hay ${stock.stock} disponibles en total` }));
    }

    setDrafts((current) => ({
      ...current,
      [branchId]: finalVal
    }));
  }

  function stepDraft(branchId, delta) {
    if (!canOrder) return;
    const currentVal = Number(draftFor(branchId)) || 0;
    setDraft(branchId, currentVal + delta);
  }

  function addMultipleBranches() {
    if (!canOrder) return;
    const branchesToAdd = availableBranches.filter((b) => (Number(draftFor(b.id)) || 0) > 0);
    if (branchesToAdd.length === 0) return;

    let first = true;
    branchesToAdd.forEach((branch) => {
      const branchId = branch.id;
      const draftNum = Number(draftFor(branchId)) || 0;
      const nextQty = (Number(quantities[branchId]) || 0) + draftNum;
      if (first) {
        onAdd(product, branchId, nextQty);
        first = false;
      } else {
        onQty(product, branchId, nextQty);
      }
    });

    availableBranches.forEach((branch) => {
      setDraft(branch.id, '');
    });
  }

  const hasAnyDrafts = availableBranches.some((b) => (Number(draftFor(b.id)) || 0) > 0);

  return (
    <article className="product-card">
      {product.en_promocion && <span className="promo-ribbon">PROMO</span>}
      <button className="product-image" type="button" onClick={() => enableLightbox && productImages.length && setLightboxIndex(0)} aria-label={`Ver fotos de ${product.descripcion}`}>
        <SafeImage 
          src={productImages[0]} 
          alt={product.descripcion} 
          fallback={<DefaultProductArtwork product={product} categoryMeta={categoryMeta} />} 
        />
        {productImages.length > 1 && <span className="photo-count">{productImages.length} fotos</span>}
        <BrandImageBadge brand={brandMeta || product} label={product.marca || brandMeta?.nombre || 'Marca'} />
      </button>
      <div className="product-body">
        <div className="sku-stock-line">
          <span className="sku-code">{product.sku}</span>
        </div>
        <span className="product-category-badge" style={categoryBadgeStyle(categoryMeta)}>{product.categoria || categoryMeta?.nombre || 'Sin categoría'}</span>
        {product.descripcion && (
          <p>
            {product.descripcion.includes('LAND CRUISER') 
              ? product.descripcion.replace('LAND CRUISER', '\nLAND CRUISER').split('\n').map((line, i, arr) => (
                  <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                ))
              : product.descripcion
            }
          </p>
        )}
        {product.specs?.aplicacion && <p>{product.specs.aplicacion}</p>}
        {product.specs?.medida && product.specs.medida.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => <p key={index}>{line}</p>)}
      </div>
      <div className="branch-qty">
        <div className="product-stock-row">
          <span className={`stock-pill ${stock.tone}`}>{stock.label}</span>
        </div>
        {availableBranches.length === 0 && (
          <div className="product-cart-control no-branches">
            <button className="add-to-cart-button" type="button" disabled>
              Sin sucursal
            </button>
          </div>
        )}
        {availableBranches.map((branch, index) => {
          const branchId = branch.id;
          const draft = draftFor(branchId);
          const branchLabel = branch.letra || branch.codigo || branch.nombre || 'Sucursal';
          const branchTitle = [branchLabel, branch.nombre, branch.direccion].filter(Boolean).join(' · ');
          const isFirstBranch = index === 0;
          return (
            <div className="product-cart-control" key={branchId}>
              <div className="branch-price-row">
                <span className="branch-code" title={branchTitle}>{branchLabel}</span>
                {isFirstBranch && (
                  <div className="price-line">
                    {product.en_promocion && oldPrice > currentPrice && <span>{money(oldPrice)}</span>}
                    <b className={product.en_promocion ? 'promo-price' : ''}>{money(currentPrice)}</b>
                  </div>
                )}
              </div>
              <div className="quantity-stepper" aria-label={`Cantidad para ${product.sku} en ${branchLabel}`}>
                <button type="button" onClick={() => stepDraft(branchId, -1)} disabled={!canOrder || (Number(draftFor(branchId)) || 0) <= 0} aria-label={`Restar cantidad para ${branchLabel}`}>-</button>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  max={stock.stock > 0 ? stock.stock : undefined}
                  inputMode="numeric"
                  value={draftFor(branchId)}
                  disabled={!canOrder}
                  onChange={(event) => setDraft(branchId, event.target.value)}
                  aria-label={`Cantidad para ${branchLabel}`}
                />
                <button type="button" onClick={() => stepDraft(branchId, 1)} disabled={!canOrder || (stock.stock > 0 && (Number(draftFor(branchId)) || 0) >= stock.stock)} aria-label={`Sumar cantidad para ${branchLabel}`}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      {availableBranches.length > 0 && (
        <button className="add-to-cart-button global-add" type="button" onClick={addMultipleBranches} disabled={!canOrder || !hasAnyDrafts}>
          {isOutOfStock ? 'Agotado' : '+ Agregar'}
        </button>
      )}
      {enableLightbox && <ImageLightbox images={productImages} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />}
    </article>
  );
}

function ClearableSearchInput({ className, iconSize = 16, placeholder, value, onChange }) {
  return (
    <label className={className}>
      <Search size={iconSize} />
      <input placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      {value && (
        <button type="button" className="search-clear-button" onClick={() => onChange('')} aria-label="Borrar búsqueda">
          <X size={iconSize} />
        </button>
      )}
    </label>
  );
}

function BrandImageBadge({ brand, label }) {
  const image = brand?.logo_url || brand?.marca_logo_url ? resolveMediaUrl(brand.logo_url || brand.marca_logo_url) : '';
  const fallback = <BadgeCheck size={16} strokeWidth={2.4} />;
  return (
    <span className="product-category-logo" title={label} aria-label={label}>
      <SafeImage src={image} fallback={fallback} alt="" />
    </span>
  );
}

function CartPanel({ lines, total, confirming, sending, orderError, onClose, onRemove, onQty, onConfirm, onReview, onSend, aplicaIsv = true }) {
  const [lightbox, setLightbox] = useState(null);
  const isv = aplicaIsv ? (total * 0.15) : 0;
  const grandTotal = total + isv;

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyHeight = document.body.style.height;
    const originalHtmlHeight = document.documentElement.style.height;

    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.height = originalBodyHeight;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.height = originalHtmlHeight;
    };
  }, []);

  return (
    <div className="cart-overlay">
      <button className="cart-scrim" onClick={onClose} aria-label="Cerrar pedido" />
      <aside className="cart-panel" aria-label="Mi pedido">
        <div className="cart-head">
          <h2>Mi Pedido</h2>
          <button className="cart-close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="cart-lines">
          {lines.length === 0 && (
            <div className="cart-empty-state">
              <p>Aun no hay productos agregados.</p>
              <button type="button" onClick={onClose}>Volver al catálogo</button>
            </div>
          )}
          {(() => {
            // Agrupar por sucursal
            const branchMap = new Map();
            for (const line of lines) {
              if (!branchMap.has(line.sucursal_id)) {
                branchMap.set(line.sucursal_id, { sucursal: line.sucursal, items: [] });
              }
              branchMap.get(line.sucursal_id).items.push(line);
            }
            return [...branchMap.entries()].map(([sucursalId, { sucursal, items }]) => (
              <div key={sucursalId} style={{ marginBottom: '16px' }}>
                {/* Título de sucursal */}
                <div style={{ padding: '6px 0 6px 2px', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
                  Sucursal {sucursal}
                </div>
                {/* Tabla de Productos de esta sucursal */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-color)', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                      <th style={{ padding: '6px 4px', fontSize: '9px', textTransform: 'uppercase', border: '1px solid var(--border-color)', width: '36px', textAlign: 'center' }}>Foto</th>
                      <th style={{ padding: '6px 6px', fontSize: '9px', textTransform: 'uppercase', border: '1px solid var(--border-color)', textAlign: 'left' }}>Detalle</th>
                      <th style={{ padding: '6px 4px', fontSize: '9px', textTransform: 'uppercase', border: '1px solid var(--border-color)', width: '54px', textAlign: 'center' }}>Cant.</th>
                      <th style={{ padding: '6px 6px', fontSize: '9px', textTransform: 'uppercase', border: '1px solid var(--border-color)', width: '70px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '6px 4px', border: '1px solid var(--border-color)', width: '24px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((line) => {
                      const otherTotal = lines.filter(l => l.producto_id === line.producto_id && l.sucursal_id !== line.sucursal_id).reduce((sum, l) => sum + (Number(l.cantidad) || 0), 0);
                      const maxAllowed = line.stock_actual > 0 ? Math.max(0, line.stock_actual - otherTotal) : undefined;
                      return (
                        <tr key={`${line.producto_id}-${line.sucursal_id}`}>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)', textAlign: 'center', verticalAlign: 'middle' }}>
                            <div className="cart-branch-img" onClick={() => { if (line.imagen) setLightbox({ images: [line.imagen], index: 0 }); }} style={{ cursor: 'pointer', display: 'inline-block' }}>
                              <ProductImageThumb images={line.imagen ? [line.imagen] : []} />
                            </div>
                          </td>
                          <td style={{ padding: '6px 6px', border: '1px solid var(--border-color)', verticalAlign: 'middle', minWidth: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className="cart-sku" style={{ display: 'inline-flex', fontSize: '8px', minHeight: '14px', padding: '1px 4px', width: 'fit-content' }}>{line.sku}</span>
                              <span style={{ color: 'var(--text-color)', fontWeight: 600, fontSize: '11px', wordBreak: 'break-word', display: 'block', lineHeight: '1.2' }}>{line.descripcion}</span>
                            </div>
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)', textAlign: 'center', verticalAlign: 'middle' }}>
                            <input
                              type="number"
                              min="1"
                              max={maxAllowed}
                              value={line.cantidad}
                              onChange={(event) => {
                                let val = event.target.value;
                                if (val !== '' && maxAllowed !== undefined && Number(val) > maxAllowed) {
                                  val = maxAllowed;
                                  window.dispatchEvent(new CustomEvent('catalog:toast', { detail: `Límite: Solo hay ${line.stock_actual} disponibles en total` }));
                                }
                                onQty({ id: line.producto_id }, line.sucursal_id, val);
                              }}
                              style={{ width: '46px', height: '28px', textAlign: 'center', padding: '2px', border: '1.5px solid var(--yellow-strong, #c59b00)', borderRadius: '4px', fontWeight: 'bold', background: 'rgba(245, 194, 0, 0.06)', color: 'var(--text-color)', fontSize: '11px', outline: 'none' }}
                            />
                          </td>
                          <td style={{ padding: '6px 6px', border: '1px solid var(--border-color)', textAlign: 'right', fontWeight: '700', color: 'var(--text-color)', fontSize: '12px', verticalAlign: 'middle' }}>
                            {money(line.precio_unitario * line.cantidad)}
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button onClick={() => onRemove({ id: line.producto_id }, line.sucursal_id, 0)} aria-label="Quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'inline-flex', alignItems: 'center' }}>
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Total por sucursal */}
                {(() => {
                  const branchTotal = items.reduce((sum, item) => sum + (Number(item.precio_unitario) * Number(item.cantidad || 0)), 0);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '6px 0', borderTop: '1px dashed var(--border-color)', marginTop: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                      <span style={{ marginRight: '6px', textTransform: 'uppercase' }}>Subtotal Sucursal:</span>
                      <span style={{ color: 'var(--text-color)', fontSize: '12px', fontWeight: '900' }}>{money(branchTotal)}</span>
                    </div>
                  );
                })()}
              </div>
            ));
          })()}
        </div>

        <footer className="cart-footer">
          <div><span>Subtotal</span><b>{money(total)}</b></div>
          {aplicaIsv && <div><span>ISV 15%</span><b>{money(isv)}</b></div>}
          <div className="cart-total"><strong>Total</strong><strong>{money(grandTotal)}</strong></div>
          {confirming && (
            <section className="cart-confirm-box">
              <h3>Confirmar pedido</h3>
              <p>Revisa las cantidades antes de enviar. Una vez enviado no podra modificarse.</p>
              {orderError && <small className="form-error">{orderError}</small>}
              <div>
                <button type="button" onClick={onReview} disabled={sending}>Revisar</button>
                <button type="button" onClick={onSend} disabled={sending}>{sending ? 'Enviando...' : 'Enviar pedido'}</button>
              </div>
            </section>
          )}
          {!confirming && <button className="cart-send-button" onClick={onConfirm} disabled={lines.length === 0}>Enviar Pedido</button>}
        </footer>
      </aside>
      {lightbox && (
        <ImageLightbox 
          images={lightbox.images} 
          index={lightbox.index} 
          onClose={() => setLightbox(null)} 
          onIndexChange={(index) => setLightbox((current) => current ? { ...current, index } : current)} 
        />
      )}
    </div>
  );
}

function History({ session }) {
  const [orders, setOrders] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    api.setTenantSlug(session?.tenant?.slug || 'kolben');
    api.orders(session.token).then((payload) => setOrders(payload.pedidos)).catch(console.error);
  }, [session.token, session?.tenant?.slug]);

  const toggleOrder = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const stateLabel = (state) => {
    if (state === 'pendiente') return 'Pendiente';
    if (state === 'preparando') return 'Preparando';
    if (state === 'enviado') return 'Enviado';
    return state;
  };

  const handleDelete = async (orderId) => {
    try {
      await api.deleteOrder(session.token, orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      window.dispatchEvent(new CustomEvent('catalog:toast', { detail: 'Pedido eliminado con éxito' }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('catalog:toast', { detail: err.message || 'Error al eliminar pedido' }));
    } finally {
      setConfirmDeleteOrder(null);
    }
  };

  const handleQtyChange = (orderId, itemId, nextQty) => {
    let qty;
    if (nextQty === '') {
      qty = '';
    } else {
      qty = Math.max(1, Number(nextQty) || 1);
    }
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const updatedItems = (order.items || []).map((item) => {
          if (item.id !== itemId) return item;
          return { ...item, cantidad: qty };
        });

        const subtotal = updatedItems.reduce((sum, item) => sum + Number(item.precio_unitario || 0) * Number(item.cantidad || 0), 0);
        const aplicaIsv = order.aplica_isv === true;
        const isv = aplicaIsv ? subtotal * 0.15 : 0;
        const total = subtotal + isv;

        return {
          ...order,
          items: updatedItems,
          total,
          isv,
          isModified: true
        };
      })
    );
  };

  const handleSave = async (order) => {
    const invalid = (order.items || []).some(item => !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0);
    if (invalid) {
      window.alert('Por favor ingrese cantidades válidas mayores a cero.');
      return;
    }
    try {
      await api.updateOrderItems(session.token, order.id, order.items);
      window.dispatchEvent(new CustomEvent('catalog:toast', { detail: 'Pedido actualizado con éxito' }));
      setOrders((current) =>
        current.map((o) => (o.id === order.id ? { ...o, isModified: false } : o))
      );
    } catch (err) {
      window.alert(err.message || 'No se pudo actualizar el pedido');
    }
  };

  const handleUndo = async (orderId) => {
    try {
      const payload = await api.orders(session.token);
      setOrders(payload.pedidos);
      window.dispatchEvent(new CustomEvent('catalog:toast', { detail: 'Cambios revertidos' }));
    } catch (err) {
      window.alert('No se pudieron revertir los cambios');
    }
  };

  if (!orders) return <Loading label="Cargando historial" />;

  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'all') return true;
    return order.estado === statusFilter;
  });

  return (
    <section className="list-page">
      <h1>Historial de pedidos</h1>

      {/* Filtros de Estado */}
      <div className="history-filter-row">
        {[
          ['all', 'Todos'],
          ['pendiente', 'Pendientes'],
          ['preparando', 'Preparando'],
          ['enviado', 'Enviados']
        ].map(([value, label]) => (
          <button 
            type="button" 
            key={value} 
            className={statusFilter === value ? 'active' : ''} 
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '16px', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
        {filteredOrders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            <strong>No hay pedidos con este estado en tu historial.</strong>
          </div>
        )}
        {filteredOrders.map((order) => {
          const isExpanded = expandedOrders[order.id];
          const totalUnidades = (order.items || []).reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
          
          // Ordenar items por Sucursal (A-Z) y luego por SKU
          const sortedItems = [...(order.items || [])].sort((a, b) => {
            const sucA = String(a.sucursal || '').toLowerCase();
            const sucB = String(b.sucursal || '').toLowerCase();
            if (sucA < sucB) return -1;
            if (sucA > sucB) return 1;
            const skuA = String(a.sku || '').toLowerCase();
            const skuB = String(b.sku || '').toLowerCase();
            if (skuA < skuB) return -1;
            if (skuA > skuB) return 1;
            return 0;
          });

          return (
            <article className="admin-order-card" key={order.id} style={{ margin: 0 }}>
              <div className="admin-order-card-head" onClick={() => toggleOrder(order.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px' }}>
                <div className="admin-order-main">
                  <span>Pedido</span>
                  <strong>{order.numero}</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '6px', marginTop: '4px', alignItems: 'center' }}>
                    <span style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(order.fecha).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(order.fecha).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span style={{ whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--text-muted)' }}>
                      <b style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-color)' }}>{money(order.total)}</b>
                    </span>
                    <span style={{ whiteSpace: 'nowrap', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-color)', padding: '1px 6px', borderRadius: '6px', fontWeight: '700', border: '1px solid var(--border-color)' }}>
                      {totalUnidades} uds.
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <b className={`admin-state ${order.estado}`} style={{ fontSize: '12px', padding: '2px 8px' }}>{stateLabel(order.estado)}</b>
                  {isExpanded ? <ChevronUp size={16} style={{ color: '#888' }} /> : <ChevronDown size={16} style={{ color: '#888' }} />}
                </div>
              </div>

              {isExpanded && (
                <div className="admin-order-items" style={{ padding: '0 14px 10px', borderTop: '1px solid var(--border-color)', fontSize: '11px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', border: '1px solid var(--border-color)' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-color)', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        <th style={{ padding: '6px 8px', fontSize: '10px', textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>Código</th>
                        <th style={{ padding: '6px 8px', fontSize: '10px', textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>Suc.</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', textTransform: 'uppercase', border: '1px solid var(--border-color)', width: '60px' }}>Cant.</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItems.map((item) => (
                        <tr key={`${item.producto_id}-${item.sucursal_id}`}>
                          <td style={{ padding: '6px 8px', fontWeight: '700', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>{item.sku}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-color)', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>{item.descripcion}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>{item.sucursal || '-'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                            {order.estado === 'pendiente' ? (
                              <input
                                type="number"
                                min="1"
                                value={item.cantidad}
                                onChange={(e) => handleQtyChange(order.id, item.id, e.target.value)}
                                style={{ width: '45px', textAlign: 'center', padding: '2px', border: '1.5px solid var(--yellow-strong, #c59b00)', borderRadius: '3px', fontWeight: 'bold', background: 'rgba(245, 194, 0, 0.06)', color: 'var(--text-color)', fontSize: '11px', outline: 'none' }}
                              />
                            ) : (
                              item.cantidad
                            )}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>{money(Number(item.precio_unitario || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--surface-color)' }}>
                        <td colSpan={2} style={{ padding: '6px 8px', fontWeight: '800', fontSize: '11px', textAlign: 'right', border: '1px solid var(--border-color)' }}>Subtotal:</td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', fontSize: '11px', border: '1px solid var(--border-color)' }}>{money(Number(order.total) - Number(order.isv))}</td>
                      </tr>
                      <tr style={{ background: 'var(--surface-color)' }}>
                        <td colSpan={2} style={{ padding: '6px 8px', fontWeight: '800', fontSize: '11px', textAlign: 'right', border: '1px solid var(--border-color)' }}>
                          ISV ({order.aplica_isv ? '15%' : 'Exento'}):
                        </td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', fontSize: '11px', border: '1px solid var(--border-color)' }}>{money(order.isv)}</td>
                      </tr>
                      <tr style={{ background: 'var(--surface-color)', borderTop: '2px solid var(--border-color)' }}>
                        <td colSpan={2} style={{ padding: '6px 8px', fontWeight: '900', fontSize: '11px', textAlign: 'right', border: '1px solid var(--border-color)' }}>Total:</td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '900', fontSize: '11px', border: '1px solid var(--border-color)' }}>{totalUnidades} uds.</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '900', fontSize: '12px', border: '1px solid var(--border-color)' }}>{money(order.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {order.estado === 'pendiente' && (
                <footer style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px', borderTop: '1px dashed var(--border-color)', gap: '8px' }}>
                  {order.isModified && (
                    <>
                      <button 
                        className="pill-action save" 
                        onClick={() => handleSave(order)} 
                        style={{ background: '#20935f', color: '#fff', borderColor: '#20935f', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #20935f' }}
                      >
                        Guardar
                      </button>
                      <button 
                        className="pill-action undo" 
                        onClick={() => handleUndo(order.id)} 
                        style={{ background: '#7b8491', color: '#fff', borderColor: '#7b8491', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #7b8491' }}
                      >
                        Deshacer
                      </button>
                    </>
                  )}
                  <button 
                    className="pill-action delete" 
                    onClick={() => setConfirmDeleteOrder(order.id)}
                    style={{ background: 'var(--color-danger, #d32f2f)', color: '#fff', borderColor: 'var(--color-danger, #d32f2f)', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid var(--color-danger, #d32f2f)' }}
                  >
                    Eliminar Pedido
                  </button>
                </footer>
              )}
            </article>
          );
        })}
      </div>

      {confirmDeleteOrder && (
        <AdminConfirmModal
          title="Eliminar Pedido"
          message="¿Estás seguro de que deseas eliminar este pedido permanentemente? Esta acción no se puede deshacer."
          confirmText="Sí, eliminar"
          cancelText="Cancelar"
          onConfirm={() => handleDelete(confirmDeleteOrder)}
          onCancel={() => setConfirmDeleteOrder(null)}
        />
      )}
    </section>
  );
}



function Admin({ session, onLogout, onAuthExpired, onRestoreSuperadmin, onTenantUpdated, theme, onThemeToggle }) {
  const [confirmAction, setConfirmAction] = useState(null);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const tenantSlug = session?.tenant?.slug || 'kolben';
  const [tab, setTab] = useState(() => loadUiState().adminTabByTenant?.[tenantSlug] || 'orders');
  const [tabHydrated, setTabHydrated] = useState(false);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [priceData, setPriceData] = useState(null);
  const [adminLoadError, setAdminLoadError] = useState('');
  const [adminReloadKey, setAdminReloadKey] = useState(0);
  const [editor, setEditor] = useState(null);
  const [liveTenantDraft, setLiveTenantDraft] = useState(null);
  const adminHeaderRef = useRef(null);
  const [adminHeaderSpace, setAdminHeaderSpace] = useState(116);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [selectedClientOptions, setSelectedClientOptions] = useState(null);

  function showToast(message, tone = '') {
    setToast({ message, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1000);
  }

  useEffect(() => {
    let cancelled = false;
    setAdminLoadError('');
    setSummary(null);
    setCatalog(null);
    setPriceData(null);
    const reportLoadError = (label) => (error) => {
      if (cancelled) return;
      if (error?.status === 401 && onAuthExpired) {
        onAuthExpired();
        return;
      }
      setAdminLoadError(`${label}: ${error.message || 'No se pudo cargar'}`);
    };
    const applyCatalogPayload = (payload) => {
      if (cancelled) return;
      setCatalog(payload);
      // Clean up duplicate positions by renumbering sequentially
      const sorted = [...payload.productos].sort((a, b) => Number(a.posicion || 0) - Number(b.posicion || 0));
      const cleaned = sorted.map((product, index) => ({ ...product, posicion: index, visible: product.visible !== false }));
      setProducts(cleaned);
      setBrands(payload.marcas || []);
      setCategories(payload.categorias || []);
    };
    const loadOrders = () => {
      api.orders(session.token).then((payload) => {
        if (cancelled) return;
        setOrders((current) => {
          return (payload.pedidos || []).map((newOrder) => {
            const existing = (current || []).find((o) => o.id === newOrder.id);
            if (existing && existing.isModified) {
              return existing;
            }
            return newOrder;
          });
        });
      }).catch(console.error);
    };
    const loadCatalog = () => {
      api.adminCatalog(session.token).then(applyCatalogPayload).catch(reportLoadError('Catálogo'));
    };

    api.setTenantSlug(tenantSlug);
    api.adminSummary(session.token).then((payload) => {
      if (!cancelled) setSummary(payload);
    }).catch(reportLoadError('Resumen'));
    loadOrders();
    api.adminClients(session.token).then((payload) => setClients((payload.clientes || []).map(normalizeAdminClient))).catch(() => setClients([]));
    api.adminPrices(session.token).then((payload) => {
      if (!cancelled) setPriceData(normalizeAdminPriceData(payload));
    }).catch(() => {
      if (!cancelled) setPriceData(normalizeAdminPriceData({ listas: [], productos: [] }));
    });
    loadCatalog();

    const ordersTimer = window.setInterval(loadOrders, 5000);
    const catalogTimer = window.setInterval(loadCatalog, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(ordersTimer);
      window.clearInterval(catalogTimer);
    };
  }, [session.token, tenantSlug, adminReloadKey]);

  useEffect(() => {
    const storedTab = loadUiState().adminTabByTenant?.[tenantSlug];
    if (storedTab) {
      setTab(storedTab);
    } else {
      setTab('orders');
    }
    setTabHydrated(true);
  }, [tenantSlug]);

  useEffect(() => {
    if (!tabHydrated) return;
    updateUiState((current) => ({
      ...current,
      appView: 'admin',
      adminTabByTenant: {
        ...(current.adminTabByTenant || {}),
        [tenantSlug]: tab
      }
    }));
  }, [tenantSlug, tab, tabHydrated]);

  useEffect(() => {
    const header = adminHeaderRef.current;
    if (!header) return undefined;

    const updateHeaderSpace = () => {
      setAdminHeaderSpace(Math.ceil(header.getBoundingClientRect().height));
    };

    updateHeaderSpace();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeaderSpace) : null;
    resizeObserver?.observe(header);
    window.addEventListener('resize', updateHeaderSpace);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateHeaderSpace);
    };
  }, [summary, tab, onRestoreSuperadmin]);

  useEffect(() => {
    function handleOnline() {
      if (adminLoadError) {
        setAdminLoadError('');
        setAdminReloadKey((current) => current + 1);
      }
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [adminLoadError]);

  if (adminLoadError) {
    const isNetworkError = /failed to fetch|networkerror|internet|offline|disconnected/i.test(adminLoadError);
    return (
      <section className="admin-load-error">
        <div className="admin-error-icon-box">
          {isNetworkError ? <WifiOff size={32} /> : <AlertTriangle size={32} />}
        </div>
        <strong>{isNetworkError ? 'Conexión en pausa' : 'No se pudo cargar el panel admin'}</strong>
        <p>
          {isNetworkError
            ? 'Parece que tu equipo estuvo en modo reposo o se interrumpió la red. Reanudaremos automáticamente al detectar conexión.'
            : adminLoadError}
        </p>
        <div className="admin-error-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setAdminLoadError('');
              setAdminReloadKey((current) => current + 1);
            }}
          >
            <RefreshCw size={15} /> Reintentar ahora
          </button>
          {onLogout && (
            <button className="secondary-button" type="button" onClick={onLogout}>
              Salir
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!summary || !catalog || !priceData) return <Loading label="Cargando panel admin" />;

  const liveTenant = liveTenantDraft || summary.tenant;
  const adminShellStyle = {
    ...tenantBrandStyle(liveTenant),
    '--admin-header-space': `${adminHeaderSpace}px`
  };
  const displayOrders = orders;
  const pending = displayOrders.filter((order) => order.estado === 'pendiente').length;
  const preparing = displayOrders.filter((order) => order.estado === 'preparando').length;
  const sentToday = displayOrders.filter((order) => order.estado === 'enviado' && isToday(order.fecha)).length;
  const priceLists = priceData.listas || [];
  const priceProducts = priceData.productos || [];
  const missingPriceCount = priceLists.reduce((sum, list) => sum + Number(list.productos_faltantes || 0), 0);

  async function updateProduct(id, changes) {
    const currentProduct = products.find((product) => product.id === id);
    const previousProducts = products;
    
    // Shift positions locally for instant feedback (only for "all categories" filter)
    let positionUpdates = [];
    if (changes.posicion !== undefined && changes.posicion !== currentProduct.posicion) {
      const oldPos = currentProduct.posicion;
      const newPos = changes.posicion;
      
      setProducts((current) => {
        const next = current.map((product) => {
          let pos = product.posicion;
          if (product.id === id) {
            pos = newPos;
            positionUpdates.push({ id: product.id, posicion: newPos });
          } else {
            // Shift other products to avoid duplicates (all products)
            if (newPos > oldPos) {
              // Moving down: shift products between oldPos and newPos down by 1
              if (pos > oldPos && pos <= newPos) {
                pos = pos - 1;
                positionUpdates.push({ id: product.id, posicion: pos });
              }
            } else {
              // Moving up: shift products between newPos and oldPos up by 1
              if (pos >= newPos && pos < oldPos) {
                pos = pos + 1;
                positionUpdates.push({ id: product.id, posicion: pos });
              }
            }
          }
          return { ...product, posicion: pos };
        });
        return [...next].sort((a, b) => Number(a.posicion || 0) - Number(b.posicion || 0));
      });
    } else {
      const optimistic = { ...currentProduct, ...changes };
      setProducts((current) => current.map((product) => (product.id === id ? optimistic : product)));
    }

    try {
      // If position changed, update all affected products
      if (positionUpdates.length > 0) {
        for (const update of positionUpdates) {
          await api.adminSaveProduct(session.token, { id: update.id, posicion: update.posicion });
        }
        // Reload catalog to get final state
        const freshCatalog = await api.adminCatalog(session.token);
        const sorted = [...freshCatalog.productos].sort((a, b) => Number(a.posicion || 0) - Number(b.posicion || 0));
        const cleaned = sorted.map((product, index) => ({ 
          ...product, 
          posicion: index, 
          visible: product.visible !== false 
        }));
        setProducts(cleaned);
      } else {
        await api.adminSaveProduct(session.token, changes.id ? changes : { ...changes, id });
        const freshCatalog = await api.adminCatalog(session.token);
        
        // Only renumber if this was a position change, otherwise just update the product
        if (changes.posicion !== undefined) {
          const sorted = [...freshCatalog.productos].sort((a, b) => Number(a.posicion || 0) - Number(b.posicion || 0));
          const cleaned = sorted.map((product, index) => ({
            ...product,
            posicion: index,
            visible: product.visible !== false
          }));
          setProducts(cleaned);
        } else {
          // For existing products, update the specific product while maintaining current order
          setProducts((current) => {
            const updatedMap = new Map(freshCatalog.productos.map(p => [Number(p.id), p]));
            return current.map(product => {
              const updated = updatedMap.get(Number(product.id));
              if (updated) {
                // Keep the original position from current array, only update other fields
                return { ...product, ...updated, posicion: product.posicion };
              }
              return product;
            });
          });
        }
      }
    } catch (error) {
      setProducts(previousProducts);
      window.alert(error.message || 'No se pudo guardar el producto');
    }
  }

  async function saveProduct(payload) {
    const existingImages = cleanProductImages(payload.imagenes);
    let finalImages = [...existingImages];
    
    if (payload.imageFile1) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.imageFile1, 'product');
        finalImages[0] = upload.url;
      } catch (error) {
        window.alert(error.message || 'No se pudo subir la imagen 1');
        return;
      }
    }
    
    if (payload.imageFile2) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.imageFile2, 'product');
        finalImages[1] = upload.url;
      } catch (error) {
        window.alert(error.message || 'No se pudo subir la imagen 2');
        return;
      }
    }
    
    const nextPayload = prepareProductPayload(
      {
        ...payload,
        imageFile: undefined,
        imageFiles: undefined,
        imageFile1: undefined,
        imageFile2: undefined,
        imagenes: finalImages.filter(Boolean).slice(0, 2)
      },
      products,
      brands,
      categories
    );
    try {
      await api.adminSaveProduct(session.token, nextPayload);
      const freshCatalog = await api.adminCatalog(session.token);
      
      // Only renumber positions if creating a new product
      if (!payload.id) {
        const sorted = [...freshCatalog.productos].sort((a, b) => Number(a.posicion || 0) - Number(b.posicion || 0));
        const cleaned = sorted.map((product, index) => ({
          ...product,
          posicion: index,
          visible: product.visible !== false
        }));
        setProducts(cleaned);
      } else {
        // For existing products, update the specific product while maintaining current order
        setProducts((current) => {
          const updatedMap = new Map(freshCatalog.productos.map(p => [Number(p.id), p]));
          return current.map(product => {
            const updated = updatedMap.get(Number(product.id));
            if (updated) {
              // Keep the original position from current array, only update other fields
              return { ...product, ...updated, posicion: product.posicion };
            }
            return product;
          });
        });
      }
      
      setEditor(null);
      showToast(payload.id ? 'Producto actualizado correctamente' : 'Producto agregado correctamente');
    } catch (error) {
      window.alert(error.message || 'No se pudo guardar el producto');
      return;
    }
  }

  async function saveClient(payload) {
    const nextPayload = prepareClientPayload(payload);
    if (!nextPayload.nombre || !nextPayload.username) {
      window.alert('Nombre y usuario son requeridos');
      throw new Error('Nombre y usuario son requeridos');
    }
    const previousClients = clients;
    if (nextPayload.id) {
      setClients((current) => current.map((item) => (
        item.id === nextPayload.id
          ? normalizeAdminClient({
              ...item,
              ...nextPayload,
              username: nextPayload.username,
              condicion_credito: nextPayload.condicion_credito,
              lista_precio_id: nextPayload.lista_precio_id,
              sucursales: nextPayload.sucursales
            })
          : item
      )));
    }
    try {
      const saved = await api.adminSaveClient(session.token, nextPayload);
      try {
        const latestClients = await api.adminClients(session.token);
        setClients((latestClients.clientes || []).map(normalizeAdminClient));
      } catch {
        const client = normalizeAdminClient(saved.cliente);
        setClients((current) => (nextPayload.id ? current.map((item) => (item.id === nextPayload.id ? client : item)) : [client, ...current]));
      }
      const latestPrices = await api.adminPrices(session.token);
      setPriceData(normalizeAdminPriceData(latestPrices));
      if (saved.password_changed) showToast('Contraseña del cliente actualizada correctamente.');
      else showToast(nextPayload.id ? 'Cliente actualizado correctamente' : 'Cliente agregado correctamente');
      setEditor(null);
    } catch (error) {
      setClients(previousClients);
      window.alert(error.message || 'No se pudo guardar el cliente');
      throw error;
    } finally {
    }
  }

  async function savePrice(payload) {
    if (editor?.type === 'price-list') {
      try {
        const targetClient = editor.value?.client || clients.find((client) => Number(client.id) === Number(payload.client_id));
        const clienteIds = targetClient
          ? [Number(targetClient.id)]
          : Object.keys(payload)
            .filter((key) => key.startsWith('cliente_') && payload[key])
            .map((key) => Number(key.replace('cliente_', '')))
            .filter(Boolean);
        const listName = payload.nombre || (targetClient ? `Precios - ${targetClient.nombre} #${targetClient.id}` : 'Lista de precios');
        const saved = await api.adminSavePriceList(session.token, { ...payload, nombre: listName, cliente_ids: clienteIds });
        const listId = saved.lista.id;
        const precios = priceProducts.map((product) => ({
          producto_id: product.id,
          precio: Number(payload[`precio_${product.id}`] || 0),
          precio_promocion: payload[`promo_${product.id}`] === '' ? null : Number(payload[`promo_${product.id}`] || 0) || null,
          promo_activa: payload[`promo_activa_${product.id}`] === true,
          visible_cliente: payload[`visible_${product.id}`] !== false
        }));
        await api.adminSaveListPrices(session.token, listId, precios);
        const latest = await api.adminPrices(session.token);
        setPriceData(normalizeAdminPriceData(latest));
        const latestClients = await api.adminClients(session.token);
        setClients((latestClients.clientes || []).map(normalizeAdminClient));
      } finally {
        setEditor(null);
      }
      return;
    }

    const precios = priceProducts.map((product) => ({
      producto_id: product.id,
      precio: Number(payload[`precio_${product.id}`] || 0),
      precio_promocion: payload[`promo_${product.id}`] === '' ? null : Number(payload[`promo_${product.id}`] || 0) || null,
      promo_activa: payload[`promo_activa_${product.id}`] === true,
      visible_cliente: payload[`visible_${product.id}`] !== false
    }));
    try {
      const saved = await api.adminSaveListPrices(session.token, payload.id, precios);
      setPriceData((current) => ({
        ...current,
        listas: current.listas.map((list) => (list.id === payload.id ? { ...list, precios: saved.precios } : list))
      }));
    } finally {
      setEditor(null);
    }
  }

  async function toggleClient(client) {
    const nextActive = !client.activo;
    setClients((current) => current.map((item) => (item.id === client.id ? { ...item, activo: nextActive } : item)));
    try {
      const saved = await api.adminSetClientActive(session.token, client.id, nextActive);
      setClients((current) => current.map((item) => (item.id === client.id ? normalizeAdminClient(saved.cliente) : item)));
    } catch {
      setClients((current) => current.map((item) => (item.id === client.id ? client : item)));
    }
  }

  async function logoutClientSessions(client) {
    try {
      await api.adminClientLogout(session.token, client.id);
      showToast(`Sesiones de ${client.nombre} cerradas`);
    } catch (err) {
      window.alert(err.message || 'No se pudo cerrar las sesiones del cliente');
    }
  }

  function updateOrderState(id, estado) {
    setConfirmAction({
      title: 'Cambiar estado de pedido',
      message: `¿Confirmar cambio a "${stateLabel(estado)}"?`,
      confirmText: 'Cambiar',
      onConfirm: async () => {
        setConfirmAction(null);
    const previous = orders;
    setOrders((current) => current.map((order) => (order.id === id ? { ...order, estado } : order)));
    try {
      const saved = await api.updateOrderStatus(session.token, id, estado);
      setOrders((current) => current.map((order) => (order.id === id ? { ...order, ...saved.pedido } : order)));
      const [ordersPayload, catalogPayload] = await Promise.all([
        api.orders(session.token),
        api.adminCatalog(session.token)
      ]);
      setOrders(ordersPayload.pedidos);
      setCatalog(catalogPayload);
      // Clean up duplicate positions
      const sorted = [...catalogPayload.productos].sort((a, b) => Number(a.posicion || 0) - Number(b.posicion || 0));
      const cleaned = sorted.map((product, index) => ({ ...product, posicion: index, visible: product.visible !== false }));
      setProducts(cleaned);
      setBrands(catalogPayload.marcas || []);
      setCategories(catalogPayload.categorias || []);
      showToast(`Pedido ${saved.pedido?.numero || ''} cambiado a ${stateLabel(estado)}`, estado);
      } catch (error) {
        setOrders(previous);
        window.alert(error.message || 'No se pudo cambiar el estado del pedido');
      }
    }
    });
  }

  function handleOrderQtyChange(orderId, itemId, nextQty) {
    let qty;
    if (nextQty === '') {
      qty = '';
    } else {
      qty = Math.max(1, Number(nextQty) || 1);
    }
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const updatedItems = (order.items || []).map((item) => {
          if (item.id !== itemId) return item;
          return { ...item, cantidad: qty };
        });

        const subtotal = updatedItems.reduce((sum, item) => sum + Number(item.precio_unitario || 0) * Number(item.cantidad || 0), 0);
        const aplicaIsv = order.aplica_isv === true;
        const isv = aplicaIsv ? subtotal * 0.15 : 0;
        const total = subtotal + isv;

        return {
          ...order,
          items: updatedItems,
          total,
          isv,
          isModified: true
        };
      })
    );
  }

  async function saveOrderItems(order) {
    const invalid = (order.items || []).some(item => !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0);
    if (invalid) {
      window.alert('Por favor ingrese cantidades válidas mayores a cero.');
      return;
    }
    try {
      await api.updateOrderItems(session.token, order.id, order.items);
      showToast('Pedido actualizado correctamente');
      setOrders((current) =>
        current.map((o) => (o.id === order.id ? { ...o, isModified: false } : o))
      );
    } catch (error) {
      window.alert(error.message || 'No se pudo actualizar el pedido');
    }
  }

  async function undoOrderChanges(orderId) {
    try {
      const payload = await api.orders(session.token);
      setOrders(payload.pedidos);
      showToast('Cambios revertidos');
    } catch (error) {
      window.alert('No se pudieron revertir los cambios');
    }
  }

  function deleteProduct(product) {
    setConfirmAction({
      title: 'Eliminar producto',
      message: `¿Seguro que quieres eliminar "${product.sku || product.descripcion}"?`,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        setConfirmAction(null);
    const previousProducts = products;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    try {
      await api.adminDeleteProduct(session.token, product.id);
      const latestPrices = await api.adminPrices(session.token);
      setPriceData(normalizeAdminPriceData(latestPrices));
      const freshCatalog = await api.adminCatalog(session.token);
      const sorted = [...freshCatalog.productos].sort((a, b) => Number(a.posicion || 0) - Number(b.posicion || 0));
      const cleaned = sorted.map((product, index) => ({
        ...product,
        posicion: index,
        visible: product.visible !== false
      }));
      
      // Update positions in backend to maintain sequential order
      for (const product of cleaned) {
        await api.adminSaveProduct(session.token, { id: product.id, posicion: product.posicion });
      }
      
      setProducts(cleaned);
      showToast('Producto eliminado');
      } catch (error) {
        setProducts(previousProducts);
        window.alert(error.message || 'No se pudo eliminar el producto');
      }
    }
    });
  }

  function deleteClient(client) {
    setConfirmAction({
      title: 'Eliminar cliente',
      message: `¿Seguro que quieres eliminar a "${client.nombre}"?`,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        setConfirmAction(null);
    const previousClients = clients;
    setClients((current) => current.filter((item) => item.id !== client.id));
    try {
      await api.adminDeleteClient(session.token, client.id);
      const latestPrices = await api.adminPrices(session.token);
      setPriceData(normalizeAdminPriceData(latestPrices));
      showToast('Cliente eliminado');
      } catch (error) {
        setClients(previousClients);
        window.alert(error.message || 'No se pudo eliminar el cliente');
      }
    }
    });
  }

  function deleteOrder(id) {
    setConfirmAction({
      title: 'Eliminar pedido',
      message: '¿Seguro que quieres eliminar este pedido permanentemente?',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        setConfirmAction(null);
    const previous = orders;
    setOrders((current) => current.filter((order) => order.id !== id));
    try {
      await api.deleteOrder(session.token, id);
      } catch {
        setOrders(previous);
        window.alert('No se pudo eliminar el pedido');
      }
    }
    });
  }

  async function saveBrand(payload) {
    let logoUrl = payload.logo_url;
    if (payload.logoFile) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.logoFile, 'brand');
        logoUrl = upload.url;
      } catch (error) {
        window.alert(error.message || 'No se pudo subir el logo');
        return;
      }
    }
    const nextPayload = { ...payload, logoFile: undefined, ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}) };
    try {
      const saved = await api.adminSaveBrand(session.token, nextPayload);
      setBrands((current) => (nextPayload.id ? current.map((item) => (item.id === nextPayload.id ? saved.marca : item)) : [saved.marca, ...current]));
      showToast(nextPayload.id ? 'Marca actualizada correctamente' : 'Marca agregada correctamente');
    } catch (error) {
      window.alert(error.message || 'No se pudo guardar la marca');
    }
  }

  async function syncPriceList(list) {
    try {
      const payload = await api.adminSyncPriceList(session.token, list.id);
      setPriceData(normalizeAdminPriceData(payload));
    } catch (error) {
      window.alert(error.message || 'No se pudo sincronizar la lista de precios');
    }
  }

  async function syncAllPriceLists() {
    const listsToSync = priceLists.filter((list) => Number(list.productos_faltantes || 0) > 0);
    if (listsToSync.length === 0) return;
    try {
      let latestPayload = null;
      for (const list of listsToSync) {
        latestPayload = await api.adminSyncPriceList(session.token, list.id);
      }
      if (latestPayload) setPriceData(normalizeAdminPriceData(latestPayload));
    } catch (error) {
      window.alert(error.message || 'No se pudieron sincronizar todas las listas');
    }
  }

  async function saveCategory(payload) {
    let imageUrl = payload.imagen_url;
    if (payload.imageFile) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.imageFile, 'category');
        imageUrl = upload.url;
      } catch (error) {
        window.alert(error.message || 'No se pudo subir la imagen de la categoría');
        return;
      }
    }
    const nextPayload = { ...payload, imageFile: undefined, ...(imageUrl !== undefined ? { imagen_url: imageUrl } : {}) };
    try {
      const saved = await api.adminSaveCategory(session.token, nextPayload);
      setCategories((current) => (
        nextPayload.id
          ? current.map((item) => (item.id === nextPayload.id ? saved.categoria : item))
          : [saved.categoria, ...current]
      ).sort(sortByPositionThenName));
      showToast(nextPayload.id ? 'Categoría actualizada correctamente' : 'Categoría agregada correctamente');
    } catch (error) {
      window.alert(error.message || 'No se pudo guardar la categoria');
    }
  }

  async function deleteBrand(id) {
    try {
      await api.adminDeleteBrand(session.token, id);
      setBrands((current) => current.filter((item) => item.id !== id));
      showToast('Marca eliminada');
    } catch (error) {
      window.alert(error.message || 'No se pudo eliminar la marca');
    }
  }

  async function deleteCategory(id) {
    try {
      await api.adminDeleteCategory(session.token, id);
      setCategories((current) => current.filter((item) => item.id !== id));
      showToast('Categoría eliminada');
    } catch (error) {
      window.alert(error.message || 'No se pudo eliminar la categoria');
    }
  }

  async function saveSite(payload) {
    let logoUrl = payload.logo_url || summary.tenant.logo_url || '';
    if (payload.logoFile) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.logoFile, 'tenant');
        logoUrl = upload.url;
      } catch (error) {
        window.alert(error.message || 'No se pudo subir el logo');
        return;
      }
    }
    const nextPayload = { ...payload, logo_url: logoUrl, logoFile: undefined };
    try {
      const saved = await api.adminUpdateSite(session.token, nextPayload);
      const nextTenant = saved.tenant;
      setSummary((current) => ({ ...current, tenant: nextTenant }));
      setLiveTenantDraft(null);
      onTenantUpdated?.(nextTenant);
      setEditor(null);
    } catch (error) {
      window.alert(error.message || 'No se pudo guardar la configuración');
      return;
    } finally {
    }
  }

  async function saveAccountPassword(payload) {
    return api.changePassword(session.token, {
      current_password: payload.current_password,
      new_password: payload.new_password
    });
  }

  return (
    <div className="admin-mobile-shell" style={adminShellStyle}>
      {toast && <div className={`catalog-toast admin-toast ${toast.tone || ''}`}>{toast.message}</div>}
      <header className="admin-mobile-topbar admin-mobile-topbar-fixed" ref={adminHeaderRef}>
        <button className="admin-brand-button" onClick={() => setEditor({ type: 'site', title: 'Configuración del sitio', value: liveTenant })}>
          <TenantLogoMark tenant={liveTenant} size="small" />
          <span><strong>{liveTenant?.nombre || 'Empresa'}</strong><small style={{ '--subnombre-size': `${liveTenant?.subnombre_size || 18}px` }}>{liveTenant?.subnombre || 'Panel Admin'}</small></span>
        </button>
        <div className="admin-quick-actions">
          <button className="admin-logo-button" onClick={() => setEditor({ type: 'site', title: 'Configuración del sitio', value: liveTenant })}>
            <Settings2 size={14} /> Configurar
          </button>
          {onRestoreSuperadmin && (
            <button className="admin-logo-button" onClick={onRestoreSuperadmin}>
              <Users size={14} /> Volver al superadmin
            </button>
          )}
          <button className="admin-logo-button" onClick={() => setEditor({ type: 'account-password', title: 'Cambiar contraseña', value: {} })}>
            Contraseña
          </button>
          <button className="admin-logo-button" onClick={onThemeToggle}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} Tema
          </button>
          <button className="admin-exit-button" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main className="admin-mobile-page">
        {tab === 'orders' && (
          <AdminOrdersSection
            orders={displayOrders}
            pending={pending}
            preparing={preparing}
            sentToday={sentToday}
            clients={clients}
            onState={updateOrderState}
            onDelete={deleteOrder}
            onQtyChange={handleOrderQtyChange}
            onSaveItems={saveOrderItems}
            onUndoItems={undoOrderChanges}
          />
        )}

        {tab === 'catalog' && (
          <AdminCatalogSection
            products={products}
            brands={brands}
            categories={categories}
            onNew={() => setEditor({ type: 'product', title: 'Nuevo producto', value: {} })}
            onProductEdit={(product) => setEditor({ type: 'product', title: 'Editar producto', value: product })}
            onToggle={(product) => updateProduct(product.id, { visible: !product.visible })}
            onPosition={(product, posicion) => updateProduct(product.id, { posicion })}
            onDelete={deleteProduct}
            onBrands={() => setEditor({ type: 'brands', title: 'Marcas', value: brands })}
            onCategories={() => setEditor({ type: 'categories', title: 'Categorías', value: categories })}
          />
        )}

        {tab === 'clients' && (
          <AdminClientsSection
            clients={clients}
            onNew={() => setEditor({ type: 'client', title: 'Nuevo cliente', value: {} })}
            onOptions={setSelectedClientOptions}
          />
        )}

        {tab === 'prices' && (
          <AdminPricesSection
            lists={priceLists}
            products={priceProducts}
            clients={clients}
            categories={categories}
            brands={brands}
            session={session}
            setPriceData={setPriceData}
            setClients={setClients}
            onSyncList={syncPriceList}
            onSyncAll={syncAllPriceLists}
          />
        )}

        {tab === 'preview' && (
          <AdminCustomerPreview
            tenant={liveTenant}
            products={products}
            clients={clients}
            priceLists={priceLists}
            brands={brands}
            categories={categories}
          />
        )}
      </main>

      <AdminBottomNav tab={tab} setTab={setTab} pending={pending} missingPrices={missingPriceCount} />

      {selectedClientOptions && (
        <div className="admin-modal-backdrop modal-centered" onClick={() => setSelectedClientOptions(null)}>
          <section className="admin-modal" style={{ maxWidth: '380px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Opciones del cliente</h2>
              <button onClick={() => setSelectedClientOptions(null)}><X size={18} /></button>
            </header>
             <div style={{ display: 'grid', gap: '8px', padding: '20px' }}>
               <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '1px solid var(--line)', paddingBottom: '15px' }}>
                 <strong style={{ fontSize: '15px', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>{selectedClientOptions.nombre}</strong>
                 <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--mist)', padding: '3px 8px', borderRadius: '12px' }}>@{selectedClientOptions.usuario}</span>
               </div>
 
               <button
                 type="button"
                 className="admin-option-item"
                 onClick={() => {
                   setEditor({ type: 'client-detail', title: 'Detalle de Cliente', value: selectedClientOptions });
                   setSelectedClientOptions(null);
                 }}
               >
                 <Eye size={16} />
                 <span>Ver detalle de cuenta</span>
               </button>
 
               <button
                 type="button"
                 className="admin-option-item"
                 onClick={() => {
                   setEditor({ type: 'client', title: 'Editar cliente', value: selectedClientOptions });
                   setSelectedClientOptions(null);
                 }}
               >
                 <Edit2 size={16} />
                 <span>Editar información del cliente</span>
               </button>
 
               <button
                 type="button"
                 className="admin-option-item"
                 onClick={() => {
                   toggleClient(selectedClientOptions);
                   setSelectedClientOptions(null);
                 }}
               >
                 {selectedClientOptions.activo ? <UserX size={16} style={{ color: 'var(--danger)' }} /> : <UserCheck size={16} style={{ color: 'var(--yellow)' }} />}
                 <span>{selectedClientOptions.activo ? 'Desactivar acceso' : 'Activar acceso'}</span>
               </button>
 
               <button
                 type="button"
                 className="admin-option-item"
                 onClick={() => {
                   logoutClientSessions(selectedClientOptions);
                   setSelectedClientOptions(null);
                 }}
               >
                 <LogOut size={16} />
                 <span>Cerrar todas las sesiones</span>
               </button>
 
               <button
                 type="button"
                 className="admin-option-item danger"
                 style={{ marginTop: '10px' }}
                 onClick={() => {
                   deleteClient(selectedClientOptions);
                   setSelectedClientOptions(null);
                 }}
               >
                 <Trash2 size={16} />
                 <span>Eliminar cliente permanentemente</span>
               </button>
             </div>
          </section>
        </div>
      )}

      {confirmAction && (
        <AdminConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {editor && (
        <AdminEditor
          editor={editor}
          brands={brands}
          categories={categories}
          priceLists={priceLists}
          priceProducts={priceProducts}
          clients={clients}
          onClose={() => setEditor(null)}
          onSaveProduct={saveProduct}
          onSaveClient={saveClient}
          onSavePrice={savePrice}
          onSaveBrand={saveBrand}
          onSaveCategory={saveCategory}
          onSaveSite={saveSite}
          onSiteDraftChange={setLiveTenantDraft}
          onSaveAccountPassword={saveAccountPassword}
          onDeleteBrand={deleteBrand}
          onDeleteCategory={deleteCategory}
          theme={theme}
          onThemeToggle={onThemeToggle}
        />
      )}
    </div>
  );
}


function AdminConfirmModal({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, onCancel }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div className="admin-modal-backdrop" onClick={onCancel} style={{ placeItems: 'center' }}>
      <section className="admin-modal" onClick={e => e.stopPropagation()} style={{ width: 'min(360px, calc(100% - 32px))', padding: '24px', textAlign: 'center', borderRadius: '16px', margin: 'auto' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'grid', gap: '8px' }}>
          <button className="primary-button" onClick={onConfirm} style={{ background: 'var(--color-danger, #d32f2f)' }}>{confirmText}</button>
          <button className="secondary-button" onClick={onCancel}>{cancelText}</button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function AdminOrdersSection({ orders, pending, preparing, sentToday, clients = [], onState, onDelete, onQtyChange, onSaveItems, onUndoItems }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState(null);
  const [itemsSortKeys, setItemsSortKeys] = useState({});

  useEffect(() => {
    if (selectedHistoryOrder) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [selectedHistoryOrder]);

  const handleSort = (orderId, key) => {
    setItemsSortKeys((current) => {
      const existing = current[orderId] || { key: 'sku', asc: true };
      if (existing.key === key) {
        return { ...current, [orderId]: { key, asc: !existing.asc } };
      } else {
        return { ...current, [orderId]: { key, asc: true } };
      }
    });
  };

  const toggleOrder = (orderId) => {
    setExpandedOrders(current => ({ ...current, [orderId]: !current[orderId] }));
  };

  const [selectedYearFilter, setSelectedYearFilter] = useState('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');

  const uniqueYears = useMemo(() => {
    const sent = (orders || []).filter(o => o.estado === 'enviado');
    const years = sent.map(o => new Date(o.fecha).getFullYear());
    return ['all', ...new Set(years)].sort((a, b) => b - a);
  }, [orders]);

  const monthsList = [
    { value: 'all', label: 'Todos los meses' },
    { value: '0', label: 'Enero' },
    { value: '1', label: 'Febrero' },
    { value: '2', label: 'Marzo' },
    { value: '3', label: 'Abril' },
    { value: '4', label: 'Mayo' },
    { value: '5', label: 'Junio' },
    { value: '6', label: 'Julio' },
    { value: '7', label: 'Agosto' },
    { value: '8', label: 'Septiembre' },
    { value: '9', label: 'Octubre' },
    { value: '10', label: 'Noviembre' },
    { value: '11', label: 'Diciembre' }
  ];

  const groupedOrders = useMemo(() => {
    const sent = (orders || []).filter(o => {
      if (o.estado !== 'enviado') return false;
      const date = new Date(o.fecha);
      if (selectedYearFilter !== 'all' && date.getFullYear() !== Number(selectedYearFilter)) return false;
      if (selectedMonthFilter !== 'all' && date.getMonth() !== Number(selectedMonthFilter)) return false;
      return true;
    });
    const sorted = [...sent].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    const yearsMap = {};
    sorted.forEach(order => {
      const date = new Date(order.fecha);
      const year = date.getFullYear();
      const monthNum = date.getMonth();
      const monthName = date.toLocaleString('es-HN', { month: 'long' });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      
      if (!yearsMap[year]) {
        yearsMap[year] = { year, monthsMap: {} };
      }
      if (!yearsMap[year].monthsMap[monthNum]) {
        yearsMap[year].monthsMap[monthNum] = { monthName: capitalizedMonth, monthNum, orders: [] };
      }
      yearsMap[year].monthsMap[monthNum].orders.push(order);
    });

    return Object.values(yearsMap)
      .sort((a, b) => b.year - a.year)
      .map(y => ({
        year: y.year,
        months: Object.values(y.monthsMap)
          .sort((a, b) => b.monthNum - a.monthNum)
      }));
  }, [orders, selectedYearFilter, selectedMonthFilter]);
  const urgentLabel = pending > 0
    ? `${pending} pedido${pending === 1 ? '' : 's'} por revisar`
    : preparing > 0
      ? `${preparing} pedido${preparing === 1 ? '' : 's'} en preparación`
      : 'Operación al día';
  const urgentCopy = pending > 0
    ? 'Marca como Preparando al confirmar inventario y despacho.'
    : preparing > 0
      ? 'Cierra el flujo cuando el pedido salga hacia el cliente.'
      : 'No hay pedidos pendientes en este momento.';
  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (orders || []).filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.estado === statusFilter;
      const haystack = `${order.numero || ''} ${order.cliente_nombre || ''} ${order.fecha_label || ''}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [orders, query, statusFilter]);
  return (
    <>
      <AdminSectionTitle title="Pedidos" subtitle="Gestiona los pedidos recibidos" />
      <div className="admin-priority-strips-container" style={{ marginTop: '12px' }}>
        <div className="admin-priority-strip warning">
          <ClipboardList size={13} />
          <span>
            <strong>{pending} Pendientes</strong>
          </span>
        </div>
        <div className="admin-priority-strip active">
          <Activity size={13} />
          <span>
            <strong>{preparing} Preparando</strong>
          </span>
        </div>
        <div className="admin-priority-strip clear">
          <Check size={13} />
          <span>
            <strong>{sentToday} Enviados hoy</strong>
          </span>
        </div>
        <div className="admin-priority-strip historic">
          <Package size={13} />
          <span>
            <strong>{orders.filter(o => o.estado === 'enviado').length} Historial</strong>
          </span>
        </div>
      </div>
      <div className="admin-filter-bar">
        <ClearableSearchInput className="admin-search-inline" iconSize={15} placeholder="Buscar pedido o cliente" value={query} onChange={setQuery} />
        <div className="admin-chip-row">
          {[
            ['all', 'Todos'],
            ['pendiente', 'Pendientes'],
            ['preparando', 'Preparando'],
            ['enviado', 'Enviados']
          ].map(([value, label]) => (
            <button type="button" key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <small className="admin-results-count">{filteredOrders.length} resultados</small>
      </div>
      <div className="admin-order-list">
        {filteredOrders.length === 0 && (
          <div className="admin-empty-state">
            <strong>{orders.length === 0 ? 'Aun no hay pedidos' : 'No hay pedidos con ese filtro'}</strong>
            <span>{orders.length === 0 ? 'Los pedidos apareceran aqui cuando un cliente creado por Kolben haga una compra.' : 'Prueba con otro estado o una busqueda mas amplia.'}</span>
          </div>
        )}
        {filteredOrders.map((order) => {
          const isExpanded = expandedOrders[order.id];
          const sortInfo = itemsSortKeys[order.id] || { key: 'sucursal', asc: true };
          const totalUnidades = (order.items || []).reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
          return (
            <article className="admin-order-card" key={order.id}>
              <div className="admin-order-card-head" onClick={() => toggleOrder(order.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div className="admin-order-main">
                  <span>Pedido</span>
                  <strong>{order.cliente_nombre || 'Cliente mayorista'}</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '6px', marginTop: '4px', alignItems: 'center' }}>
                    <span style={{ whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--text-muted)' }}>{order.fecha_label || `${new Date(order.fecha).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${new Date(order.fecha).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })}`}</span>
                    <span style={{ whiteSpace: 'nowrap', fontSize: '16px', color: 'var(--text-muted)' }}><b style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-color)' }}>{money(order.total)}</b></span>
                    <span style={{ whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text-muted)', background: 'var(--surface-color)', padding: '1px 7px', borderRadius: '8px', fontWeight: '700', border: '1px solid var(--border-color)' }}>{totalUnidades} uds.</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {order.estado !== 'pendiente' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onState(order.id, order.estado === 'enviado' ? 'preparando' : 'pendiente');
                      }}
                      title="Revertir estado"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#7b8491',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        marginRight: '2px'
                      }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                  <b className={`admin-state ${order.estado}`}>{stateLabel(order.estado)}</b>
                  {isExpanded ? <ChevronUp size={16} style={{ color: '#888' }} /> : <ChevronDown size={16} style={{ color: '#888' }} />}
                </div>
              </div>

              {isExpanded && (
                <div className="admin-order-items" style={{ padding: '0 12px 10px', borderTop: '1px solid var(--border-color)', fontSize: '11px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', border: '1px solid var(--border-color)' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-color)', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        <th onClick={() => handleSort(order.id, 'sku')} style={{ padding: '6px 8px', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', color: sortInfo.key === 'sku' ? 'var(--text-color)' : 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            Código <span style={{ fontSize: '8px', opacity: sortInfo.key === 'sku' ? 1 : 0.25 }}>{sortInfo.key === 'sku' ? (sortInfo.asc ? '▲' : '▼') : '▲'}</span>
                          </span>
                        </th>
                        <th style={{ padding: '6px 8px', fontSize: '10px', textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>Descripción</th>
                        <th onClick={() => handleSort(order.id, 'sucursal')} style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', color: sortInfo.key === 'sucursal' ? 'var(--text-color)' : 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center', width: '100%' }}>
                            Suc. <span style={{ fontSize: '8px', opacity: sortInfo.key === 'sucursal' ? 1 : 0.25 }}>{sortInfo.key === 'sucursal' ? (sortInfo.asc ? '▲' : '▼') : '▲'}</span>
                          </span>
                        </th>
                        <th onClick={() => handleSort(order.id, 'cantidad')} style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', color: sortInfo.key === 'cantidad' ? 'var(--text-color)' : 'var(--text-muted)', border: '1px solid var(--border-color)', width: '60px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center', width: '100%' }}>
                            Cant. <span style={{ fontSize: '8px', opacity: sortInfo.key === 'cantidad' ? 1 : 0.25 }}>{sortInfo.key === 'cantidad' ? (sortInfo.asc ? '▲' : '▼') : '▲'}</span>
                          </span>
                        </th>
                        <th onClick={() => handleSort(order.id, 'precio_unitario')} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', color: sortInfo.key === 'precio_unitario' ? 'var(--text-color)' : 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%' }}>
                            Precio <span style={{ fontSize: '8px', opacity: sortInfo.key === 'precio_unitario' ? 1 : 0.25 }}>{sortInfo.key === 'precio_unitario' ? (sortInfo.asc ? '▲' : '▼') : '▲'}</span>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(order.items || [])].sort((a, b) => {
                        let valA, valB;
                        if (sortInfo.key === 'sku') {
                          valA = String(a.sku || '').toLowerCase();
                          valB = String(b.sku || '').toLowerCase();
                        } else if (sortInfo.key === 'sucursal') {
                          valA = String(a.sucursal || '').toLowerCase();
                          valB = String(b.sucursal || '').toLowerCase();
                        } else if (sortInfo.key === 'cantidad') {
                          valA = Number(a.cantidad || 0);
                          valB = Number(b.cantidad || 0);
                        } else if (sortInfo.key === 'precio_unitario') {
                          valA = Number(a.precio_unitario || 0);
                          valB = Number(b.precio_unitario || 0);
                        }
                        if (valA < valB) return sortInfo.asc ? -1 : 1;
                        if (valA > valB) return sortInfo.asc ? 1 : -1;
                        return 0;
                      }).map((item) => (
                        <tr key={`${item.producto_id}-${item.sucursal_id}`}>
                          <td style={{ padding: '6px 8px', fontWeight: '700', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>{item.sku}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-color)', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>{item.descripcion}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>{item.sucursal || '-'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                            {order.estado === 'pendiente' ? (
                              <input
                                type="number"
                                min="1"
                                value={item.cantidad}
                                onChange={(e) => onQtyChange(order.id, item.id, e.target.value)}
                                style={{ width: '45px', textAlign: 'center', padding: '2px', border: '1.5px solid var(--yellow-strong, #c59b00)', borderRadius: '3px', fontWeight: 'bold', background: 'rgba(245, 194, 0, 0.06)', color: 'var(--text-color)', fontSize: '11px', outline: 'none' }}
                              />
                            ) : (
                              item.cantidad
                            )}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500', border: '1px solid var(--border-color)', verticalAlign: 'middle' }}>{money(Number(item.precio_unitario || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--surface-color)' }}>
                        <td colSpan={2} style={{ padding: '6px 8px', fontWeight: '800', fontSize: '11px', textAlign: 'right', border: '1px solid var(--border-color)' }}>Subtotal:</td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', fontSize: '11px', border: '1px solid var(--border-color)' }}>{money(Number(order.total) - Number(order.isv))}</td>
                      </tr>
                      <tr style={{ background: 'var(--surface-color)' }}>
                        <td colSpan={2} style={{ padding: '6px 8px', fontWeight: '800', fontSize: '11px', textAlign: 'right', border: '1px solid var(--border-color)' }}>
                          ISV ({order.aplica_isv ? '15%' : 'Exento'}):
                        </td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', fontSize: '11px', border: '1px solid var(--border-color)' }}>{money(order.isv)}</td>
                      </tr>
                      <tr style={{ background: 'var(--surface-color)', borderTop: '2px solid var(--border-color)' }}>
                        <td colSpan={2} style={{ padding: '6px 8px', fontWeight: '900', fontSize: '11px', textAlign: 'right', border: '1px solid var(--border-color)' }}>Total:</td>
                        <td style={{ border: '1px solid var(--border-color)' }}></td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '900', fontSize: '11px', border: '1px solid var(--border-color)' }}>{totalUnidades} uds.</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '900', fontSize: '12px', border: '1px solid var(--border-color)' }}>{money(order.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <footer>
                <span className="admin-ticket">{order.numero}</span>
                <div className="admin-order-actions">
                  {order.isModified && (
                    <>
                      <button className="pill-action save" onClick={() => onSaveItems(order)} style={{ background: '#20935f', color: '#fff', borderColor: '#20935f' }}>
                        Guardar
                      </button>
                      <button className="pill-action undo" onClick={() => onUndoItems(order.id)} style={{ background: '#7b8491', color: '#fff', borderColor: '#7b8491' }}>
                        Deshacer
                      </button>
                    </>
                  )}
                  {order.estado === 'pendiente' && (
                    <>
                      <button className="pill-action" onClick={() => onState(order.id, 'preparando')}>
                        Preparando
                      </button>
                      <button className="pill-action" onClick={() => onState(order.id, 'enviado')}>
                        Enviado
                      </button>
                    </>
                  )}
                  {order.estado === 'preparando' && (
                    <button className="pill-action" onClick={() => onState(order.id, 'enviado')}>
                      Enviado
                    </button>
                  )}
                  <button className="pill-action delete" onClick={() => onDelete(order.id)}>
                    Eliminar
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
      <h2 className="admin-small-heading" style={{ marginTop: '40px' }}>Historial de pedidos (Enviados)</h2>
      
      <div className="history-filters" style={{ display: 'flex', gap: '10px', marginTop: '14px', marginBottom: '14px' }}>
        <select
          value={selectedYearFilter}
          onChange={(e) => {
            setSelectedYearFilter(e.target.value);
            setSelectedMonthFilter('all');
          }}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', background: 'var(--paper)', color: 'var(--text)', fontWeight: 'bold' }}
        >
          <option value="all">Todos los años</option>
          {uniqueYears.filter(y => y !== 'all').map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <select
          value={selectedMonthFilter}
          onChange={(e) => setSelectedMonthFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', background: 'var(--paper)', color: 'var(--text)', fontWeight: 'bold' }}
        >
          {monthsList.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      
      {groupedOrders.length === 0 ? (
        <div className="admin-empty-state" style={{ marginTop: '10px' }}>
          <strong>No hay pedidos enviados en el historial</strong>
          <span>Los pedidos con estado "Enviado" aparecerán aquí clasificados por fecha.</span>
        </div>
      ) : (
        groupedOrders.map(({ year, months }) => (
          <div key={year} className="history-year-group">
            <h3 className="history-year-title">{year}</h3>
            {months.map(({ monthName, orders }) => (
              <div key={monthName} className="history-month-group">
                <h4 className="history-month-title">{monthName}</h4>
                <div className="history-table-card">
                  <div className="history-header-row">
                    <span>Fecha</span>
                    <span>Cliente</span>
                    <span>N. Pedido</span>
                    <span>Monto</span>
                    <span>Detalle</span>
                  </div>
                  {orders.map((order) => (
                    <div key={order.id} className="history-item-row">
                      <span className="history-date-cell">{formatShortDate(order.fecha)}</span>
                      <strong className="history-client-cell" title={order.cliente_nombre}>{order.cliente_nombre || 'Cliente'}</strong>
                      <div className="history-meta-group">
                        <span className="history-ticket">{order.numero}</span>
                      </div>
                      <b className="history-total-cell">{money(order.total)}</b>
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryOrder(order)}
                        className="pill-blue small-pill history-action-btn"
                        style={{ cursor: 'pointer' }}
                      >
                        Ver Pedido
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {selectedHistoryOrder && createPortal(
        <div className="cart-overlay" style={{ zIndex: 2000 }}>
          <button className="cart-scrim" onClick={() => setSelectedHistoryOrder(null)} aria-label="Cerrar detalle" />
          <aside className="cart-panel" style={{ maxHeight: '85vh', overflow: 'hidden' }}>
            <div className="cart-head">
              <h2>Detalle de Pedido {selectedHistoryOrder.numero}</h2>
              <button className="cart-close-button" onClick={() => setSelectedHistoryOrder(null)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '16px', fontSize: '12px', background: 'var(--mist)', padding: '10px', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 6px 0' }}><strong>Cliente:</strong> {selectedHistoryOrder.cliente_nombre}</p>
                <p style={{ margin: '0 0 6px 0' }}><strong>Fecha:</strong> {new Date(selectedHistoryOrder.fecha).toLocaleString('es-HN')}</p>
                <p style={{ margin: 0 }}><strong>Monto Total:</strong> {money(selectedHistoryOrder.total)}</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {(() => {
                  const historySortInfo = itemsSortKeys[selectedHistoryOrder.id] || { key: 'sku', asc: true };
                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left', color: 'var(--muted)', fontWeight: 'bold' }}>
                          <th onClick={() => handleSort(selectedHistoryOrder.id, 'sku')} style={{ padding: '6px 4px 6px 0', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', color: historySortInfo.key === 'sku' ? 'var(--text)' : 'var(--muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              Código <span style={{ fontSize: '8px', opacity: historySortInfo.key === 'sku' ? 1 : 0.25 }}>{historySortInfo.key === 'sku' ? (historySortInfo.asc ? '▲' : '▼') : '▲'}</span>
                            </span>
                          </th>
                          <th style={{ padding: '6px 4px', fontSize: '10px', textTransform: 'uppercase' }}>Descripción</th>
                          <th onClick={() => handleSort(selectedHistoryOrder.id, 'sucursal')} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', color: historySortInfo.key === 'sucursal' ? 'var(--text)' : 'var(--muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center', width: '100%' }}>
                              Sucursal <span style={{ fontSize: '8px', opacity: historySortInfo.key === 'sucursal' ? 1 : 0.25 }}>{historySortInfo.key === 'sucursal' ? (historySortInfo.asc ? '▲' : '▼') : '▲'}</span>
                            </span>
                          </th>
                          <th onClick={() => handleSort(selectedHistoryOrder.id, 'cantidad')} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', color: historySortInfo.key === 'cantidad' ? 'var(--text)' : 'var(--muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center', width: '100%' }}>
                              Cantidad <span style={{ fontSize: '8px', opacity: historySortInfo.key === 'cantidad' ? 1 : 0.25 }}>{historySortInfo.key === 'cantidad' ? (historySortInfo.asc ? '▲' : '▼') : '▲'}</span>
                            </span>
                          </th>
                          <th onClick={() => handleSort(selectedHistoryOrder.id, 'precio_unitario')} style={{ padding: '6px 0', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', color: historySortInfo.key === 'precio_unitario' ? 'var(--text)' : 'var(--muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%' }}>
                              Precio <span style={{ fontSize: '8px', opacity: historySortInfo.key === 'precio_unitario' ? 1 : 0.25 }}>{historySortInfo.key === 'precio_unitario' ? (historySortInfo.asc ? '▲' : '▼') : '▲'}</span>
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(selectedHistoryOrder.items || [])].sort((a, b) => {
                          let valA, valB;
                          if (historySortInfo.key === 'sku') {
                            valA = String(a.sku || '').toLowerCase();
                            valB = String(b.sku || '').toLowerCase();
                          } else if (historySortInfo.key === 'sucursal') {
                            valA = String(a.sucursal || '').toLowerCase();
                            valB = String(b.sucursal || '').toLowerCase();
                          } else if (historySortInfo.key === 'cantidad') {
                            valA = Number(a.cantidad || 0);
                            valB = Number(b.cantidad || 0);
                          } else if (historySortInfo.key === 'precio_unitario') {
                            valA = Number(a.precio_unitario || 0);
                            valB = Number(b.precio_unitario || 0);
                          }
                          if (valA < valB) return historySortInfo.asc ? -1 : 1;
                          if (valA > valB) return historySortInfo.asc ? 1 : -1;
                          return 0;
                        }).map((item) => (
                      <tr key={`${item.producto_id}-${item.sucursal_id}`} style={{ borderBottom: '1px solid var(--soft-line)' }}>
                        <td style={{ padding: '8px 4px 8px 0', fontWeight: '700' }}>{item.sku}</td>
                        <td style={{ padding: '8px 4px' }}>{item.descripcion}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>{item.sucursal}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '700' }}>{item.cantidad}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500' }}>{money(Number(item.precio_unitario || 0))}</td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}

function ProductPositionInput({ product, onPosition }) {
  const [localVal, setLocalVal] = useState(() => String(product.posicion !== undefined ? product.posicion : 0));

  useEffect(() => {
    setLocalVal(String(product.posicion !== undefined ? product.posicion : 0));
  }, [product.posicion]);

  const handleBlurOrEnter = async () => {
    const num = parseInt(localVal, 10);
    if (!isNaN(num) && num >= 0 && num !== product.posicion) {
      await onPosition(product, num);
      setLocalVal(String(num));
    } else {
      setLocalVal(String(product.posicion !== undefined ? product.posicion : 0));
    }
  };

  return (
    <input
      type="number"
      min="0"
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlurOrEnter}
      onKeyDown={async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await handleBlurOrEnter();
          e.target.blur();
        }
      }}
      className="admin-posicion-input"
      style={{
        width: '70px',
        padding: '4px 8px',
        border: '1px solid var(--line)',
        borderRadius: '4px',
        fontSize: '0.9rem',
        textAlign: 'center',
        background: 'var(--paper)',
        color: 'var(--text)',
        fontWeight: '600'
      }}
    />
  );
}

function AdminCatalogSection({ products, brands, categories, onNew, onProductEdit, onToggle, onPosition, onDelete, onBrands, onCategories }) {
  const [query, setQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lightbox, setLightbox] = useState(null);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (products || []).filter((product) => {
      const matchesVisibility = visibilityFilter === 'all'
        || (visibilityFilter === 'visible' && product.visible !== false)
        || (visibilityFilter === 'hidden' && product.visible === false);
      const matchesCategory = categoryFilter === 'all' || String(product.categoria_id || '') === categoryFilter || String(product.categoria || '') === categoryFilter;
      const haystack = `${product.sku || ''} ${product.descripcion || ''} ${product.marca || ''} ${product.categoria || ''}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesVisibility && matchesCategory && matchesQuery;
    });
  }, [products, query, visibilityFilter, categoryFilter]);
  return (
    <>
      <div className="admin-title-row">
        <AdminSectionTitle title="Catálogo" subtitle="Productos activos e inactivos" />
        <div>
          <button onClick={onBrands}><Tags size={13} /> Marcas</button>
          <button onClick={onCategories}><Folder size={13} /> Categorías</button>
          <button className="admin-new-button" onClick={onNew}><Plus size={13} /> Nuevo producto</button>
        </div>
      </div>
      <div className="admin-filter-bar">
        <ClearableSearchInput className="admin-search-inline" iconSize={15} placeholder="Buscar sku, marca o categoria" value={query} onChange={setQuery} />
        <div className="admin-chip-row">
          {[
            ['all', 'Todos'],
            ['visible', 'Visibles'],
            ['hidden', 'Ocultos']
          ].map(([value, label]) => (
            <button type="button" key={value} className={visibilityFilter === value ? 'active' : ''} onClick={() => setVisibilityFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="admin-category-filter">
          <Folder size={14} />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Todas las categorias</option>
            {categories.map((category) => (
              <option value={String(category.id)} key={category.id}>{category.nombre}</option>
            ))}
          </select>
        </label>
        <small className="admin-results-count">{filteredProducts.length} productos</small>
      </div>
      <div className="admin-product-list">
        {filteredProducts.map((product) => (
          <article className={product.visible ? 'admin-product-row' : 'admin-product-row muted'} key={product.id}>
            <div className="admin-product-top">
              <ProductImageThumb images={product.imagenes} onClick={() => { const images = cleanProductImages(product.imagenes); if (images.length) setLightbox({ images, index: 0 }); }} />
              <div>
                <span className="sku-code">{product.sku}</span>
                <small>{[product.marca, product.specs?.aplicacion || product.descripcion].filter(Boolean).join(' · ')}</small>
                <ProductStockPill product={product} className="admin-stock-badge" />
              </div>
              <div className="admin-row-actions">
                <button onClick={() => onProductEdit(product)}>Editar</button>
                <button className="danger-icon-button" onClick={() => onDelete(product)}>Eliminar</button>
              </div>
            </div>
            <footer>
              <label>Pos.<ProductPositionInput product={product} onPosition={onPosition} /></label>
              <label className="switch-line">{product.visible ? 'Visible' : 'Oculto'}<input type="checkbox" checked={product.visible} onChange={() => onToggle(product)} /><span /></label>
            </footer>
          </article>
        ))}
      </div>
      <small className="admin-muted-note">{brands.length} marcas · {categories.length} categorias</small>
      <ImageLightbox images={lightbox?.images || []} index={lightbox?.index ?? null} onClose={() => setLightbox(null)} onIndexChange={(index) => setLightbox((current) => current ? { ...current, index } : current)} />
    </>
  );
}

function AdminClientsSection({ clients, onNew, onOptions }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (clients || []).filter((client) => {
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && client.activo)
        || (statusFilter === 'inactive' && !client.activo);
      const haystack = `${client.nombre || ''} ${client.usuario || ''} ${client.lista || ''} ${client.tipo || ''}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [clients, query, statusFilter]);
  return (
    <>
      <div className="admin-title-row">
        <AdminSectionTitle title="Clientes" subtitle="Cuentas y accesos" />
        <button className="admin-new-button" onClick={onNew}><Plus size={13} /> Nuevo</button>
      </div>
      <div className="admin-filter-bar">
        <ClearableSearchInput className="admin-search-inline" iconSize={15} placeholder="Buscar cliente o usuario" value={query} onChange={setQuery} />
        <div className="admin-chip-row">
          {[
            ['all', 'Todos'],
            ['active', 'Activos'],
            ['inactive', 'Inactivos']
          ].map(([value, label]) => (
            <button type="button" key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <small className="admin-results-count">{filteredClients.length} clientes</small>
      </div>
      <div className="admin-client-card">
        {filteredClients.length === 0 && (
          <div className="admin-empty-state">
            <strong>{clients.length === 0 ? 'No hay clientes creados' : 'No hay clientes con ese filtro'}</strong>
            <span>{clients.length === 0 ? 'Usa Nuevo para crear el primer acceso mayorista de Kolben.' : 'Prueba con otro estado o una busqueda mas amplia.'}</span>
          </div>
        )}
        {filteredClients.map((client) => (
          <article className="admin-client-row" key={client.id}>
            <span className={`client-status-badge ${client.activo ? 'active' : 'inactive'}`}>
              {client.activo ? 'Activo' : 'Inactivo'}
            </span>
            <div className="admin-client-row-header">
              <div className="admin-client-row-info">
                <span className={client.activo ? 'client-avatar' : 'client-avatar off'}>{client.iniciales}</span>
                <span className="admin-client-main">
                  <strong className="admin-client-name">{client.nombre}</strong>
                  <small>{client.usuario}</small>
                </span>
              </div>
            </div>
            <span className="admin-client-actions">
              <button
                type="button"
                className="client-row-button"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}
                onClick={() => onOptions(client)}
              >
                <MoreVertical size={13} />
                Opciones
              </button>
            </span>
          </article>
        ))}
      </div>
    </>
  );
}

function AdminPricesSection({ lists, products, clients, categories, brands, session, setPriceData, setClients, onSyncList, onSyncAll }) {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [query, setQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('visible');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (!selectedClientId && clients && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [localPrices, setLocalPrices] = useState({});

  useEffect(() => {
    if (!selectedClientId) {
      setLocalPrices({});
      return;
    }
    const client = clients.find((c) => Number(c.id) === Number(selectedClientId));
    const list = lists.find((item) => Number(item.id) === Number(client?.lista_precio_id)) || { precios: [] };
    const initial = {};
    (products || []).forEach((product) => {
      const priceDetail = list.precios?.find((p) => Number(p.producto_id) === Number(product.id)) || {};
      initial[product.id] = {
        precio: priceDetail.precio ?? '',
        precio_promocion: priceDetail.precio_promocion ?? '',
        promo_activa: priceDetail.promo_activa === true,
        visible_cliente: priceDetail.visible_cliente !== false,
        saving: false,
        saved: false
      };
    });
    setLocalPrices(initial);
  }, [selectedClientId, clients, lists, products]);

  const updateLocalValue = (productId, field, value) => {
    setLocalPrices((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId] ? {
          ...prev[productId],
          [field]: value,
          saved: false
        } : {
          precio: '',
          precio_promocion: '',
          promo_activa: false,
          visible_cliente: true,
          [field]: value,
          saved: false
        }
      }
    }));
  };

  const handleSaveProductPrice = async (productId) => {
    const client = clients.find((c) => Number(c.id) === Number(selectedClientId));
    if (!client) return;

    setLocalPrices((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], saving: true }
    }));

    try {
      const values = localPrices[productId] || {};
      const listId = client.lista_precio_id;
      let targetListId = listId;

      if (!targetListId) {
        const listName = `Precios - ${client.nombre} #${client.id}`;
        const savedListPayload = await api.adminSavePriceList(session.token, {
          nombre: listName,
          cliente_ids: [client.id]
        });
        targetListId = savedListPayload.lista.id;
        
        const latestClients = await api.adminClients(session.token);
        setClients((latestClients.clientes || []).map(normalizeAdminClient));
      }

      const currentList = lists.find((item) => Number(item.id) === Number(targetListId)) || { precios: [] };

      const precios = products.map((product) => {
        if (product.id === productId) {
          return {
            producto_id: product.id,
            precio: Number(values.precio || 0),
            precio_promocion: values.precio_promocion === '' ? null : Number(values.precio_promocion || 0) || null,
            promo_activa: values.promo_activa === true,
            visible_cliente: values.visible_cliente !== false
          };
        } else {
          const localVal = localPrices[product.id];
          if (localVal) {
            return {
              producto_id: product.id,
              precio: Number(localVal.precio || 0),
              precio_promocion: localVal.precio_promocion === '' ? null : Number(localVal.precio_promocion || 0) || null,
              promo_activa: localVal.promo_activa === true,
              visible_cliente: localVal.visible_cliente !== false
            };
          }
          const priceDetail = currentList.precios?.find((p) => Number(p.producto_id) === Number(product.id)) || {};
          return {
            producto_id: product.id,
            precio: Number(priceDetail.precio || 0),
            precio_promocion: priceDetail.precio_promocion ?? null,
            promo_activa: priceDetail.promo_activa === true,
            visible_cliente: priceDetail.visible_cliente !== false
          };
        }
      });

      const savedPricesResult = await api.adminSaveListPrices(session.token, targetListId, precios);

      setPriceData((current) => ({
        ...current,
        listas: current.listas.map((list) => 
          Number(list.id) === Number(targetListId) 
            ? { ...list, precios: savedPricesResult.precios } 
            : list
        )
      }));

      setLocalPrices((prev) => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          saving: false,
          saved: true
        }
      }));
      
      setToastMessage('¡Precio guardado exitosamente!');
      setTimeout(() => setToastMessage(''), 1000);

      setTimeout(() => {
        setLocalPrices((prev) => {
          if (!prev[productId]) return prev;
          return {
            ...prev,
            [productId]: {
              ...prev[productId],
              saved: false
            }
          };
        });
      }, 2000);

    } catch (error) {
      console.error(error);
      alert('Error al guardar el precio: ' + (error.message || 'Error desconocido'));
      setLocalPrices((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], saving: false }
      }));
    }
  };

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products || []).filter((product) => {
      const matchesSearch = !q || `${product.sku || ''} ${product.marca || ''} ${product.descripcion || ''}`.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || String(product.categoria_id || '') === String(categoryFilter);
      const matchesBrand = brandFilter === 'all' || String(product.marca || '').toLowerCase() === String(brandFilter).toLowerCase();
      
      const isVisible = product.visible !== false;
      const matchesVisibility = visibilityFilter === 'all'
        || (visibilityFilter === 'visible' && isVisible)
        || (visibilityFilter === 'hidden' && !isVisible);
        
      return matchesSearch && matchesCategory && matchesBrand && matchesVisibility;
    });
  }, [products, query, categoryFilter, brandFilter, visibilityFilter, localPrices]);

  const [lightbox, setLightbox] = useState(null);

  return (
    <>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(16, 185, 129, 0.95)',
          color: 'white',
          padding: '10px 18px',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '13px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMessage}
        </div>
      )}
      <div className="admin-title-row">
        <AdminSectionTitle title="Precios por cliente" subtitle="Configura precios personalizados por cliente" />
        <div />
      </div>

      <div className="admin-filter-bar">
        <label className="admin-category-filter admin-client-selector-filter">
          <Users size={14} />
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            <option value="">-- Seleccionar cliente --</option>
            {(clients || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.usuario})
              </option>
            ))}
          </select>
        </label>
        
        {selectedClientId && (
          <>
            <ClearableSearchInput className="admin-search-inline" iconSize={15} placeholder="Buscar SKU, marca o aplicación" value={query} onChange={setQuery} />
            <div className="admin-chip-row">
              {[
                ['all', 'Todos'],
                ['visible', 'Visibles'],
                ['hidden', 'Ocultos']
              ].map(([value, label]) => (
                <button type="button" key={value} className={visibilityFilter === value ? 'active' : ''} onClick={() => setVisibilityFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="admin-category-filter">
              <Folder size={14} />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Todas las categorías</option>
                {(categories || []).map((category) => (
                  <option value={String(category.id)} key={category.id}>{category.nombre}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {selectedClientId ? (
        <>
          <div className="admin-product-list">
            {filteredProducts.map((product) => {
              const vals = localPrices[product.id] || {
                precio: '',
                precio_promocion: '',
                promo_activa: false,
                visible_cliente: true,
                saving: false,
                saved: false
              };
              return (
                <article className={product.visible !== false ? 'admin-product-row' : 'admin-product-row muted'} key={product.id}>
                  <div className="admin-product-top">
                    <ProductImageThumb images={product.imagenes} onClick={() => { const images = cleanProductImages(product.imagenes); if (images.length) setLightbox({ images, index: 0 }); }} />
                    <div>
                      <span className="sku-code">{product.sku}</span>
                      <small>{[product.marca, product.specs?.aplicacion || product.descripcion].filter(Boolean).join(' · ')}</small>
                      <ProductStockPill product={product} className="admin-stock-badge" />
                    </div>
                    
                    {/* Controles de Precio */}
                    <div className="admin-price-controls" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', minWidth: '160px', maxWidth: '220px' }}>
                      <div className="price-inputs-row" style={{ display: 'flex', gap: '6px', width: '100%' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', minWidth: 0 }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Precio (L.)</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            style={{ width: '100%', height: '30px', border: '1px solid var(--line)', borderRadius: '4px', padding: '0 6px', fontSize: '12px', fontWeight: '700', background: 'var(--paper)', color: 'var(--text)' }}
                            value={vals.precio}
                            onChange={(e) => updateLocalValue(product.id, 'precio', e.target.value)}
                          />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', minWidth: 0 }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Oferta (L.)</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            style={{ width: '100%', height: '30px', border: '1px solid var(--line)', borderRadius: '4px', padding: '0 6px', fontSize: '12px', fontWeight: '700', background: 'var(--paper)', color: 'var(--text)' }}
                            value={vals.precio_promocion}
                            onChange={(e) => updateLocalValue(product.id, 'precio_promocion', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="price-actions-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={vals.promo_activa}
                            disabled={!vals.precio_promocion}
                            onChange={(e) => updateLocalValue(product.id, 'promo_activa', e.target.checked)}
                          />
                          <span>Oferta Activa</span>
                        </label>
                        <button
                          style={{
                            background: vals.saved ? 'var(--green-strong, #10b981)' : 'var(--yellow)',
                            color: vals.saved ? '#fff' : '#111',
                            fontWeight: '700',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '11px',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            flex: 1,
                            whiteSpace: 'nowrap'
                          }}
                          disabled={vals.saving}
                          onClick={() => handleSaveProductPrice(product.id)}
                        >
                          {vals.saving ? 'Guardando...' : vals.saved ? '¡Guardado!' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                </article>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="admin-empty-state">
              <strong>No se encontraron productos</strong>
              <span>Intenta buscar con otros filtros.</span>
            </div>
          )}
        </>
      ) : (
        <div className="admin-empty-state" style={{ marginTop: '20px', padding: '40px 20px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <Users size={32} style={{ color: 'var(--muted)', marginBottom: '12px' }} />
          <strong>Ningún cliente seleccionado</strong>
          <span>Selecciona un cliente arriba para ver y configurar sus precios personalizados.</span>
        </div>
      )}
      
      <ImageLightbox images={lightbox?.images || []} index={lightbox?.index ?? null} onClose={() => setLightbox(null)} onIndexChange={(index) => setLightbox((current) => current ? { ...current, index } : current)} />
    </>
  );
}

function CategoryFilterStrip({ categories = [], value, onChange, className = '' }) {
  if (!categories.length) return null;
  return (
    <section className={`filter-tab-section category-section ${className}`.trim()} aria-label="Categorías">
      <div className="filter-tab-strip">
        <button className={value === 'all' ? 'filter-tab active' : 'filter-tab'} onClick={() => onChange('all')} aria-label="Todas las categorías" title="Todas">
          <span>Todas</span>
        </button>
        {categories.map((item) => (
          <button className={Number(value) === item.id ? 'filter-tab active' : 'filter-tab'} onClick={() => onChange(item.id)} key={item.id} aria-label={item.nombre} title={item.nombre}>
            {item.imagen_url ? <img src={resolveMediaUrl(item.imagen_url)} alt="" /> : null}
            <span>{item.nombre}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function BrandFilterStrip({ brands = [], value, onChange, className = '' }) {
  if (!brands.length) return null;
  return (
    <section className={`filter-tab-section brand-filter-section ${className}`.trim()} aria-label="Marcas">
      <div className="filter-tab-strip">
        <button className={value === 'all' ? 'filter-tab active' : 'filter-tab'} onClick={() => onChange('all')} aria-label="Todas las marcas" title="Todas">
          <span>Todas</span>
        </button>
        {brands.map((item) => (
          <button className={Number(value) === item.id ? 'filter-tab active' : 'filter-tab'} onClick={() => onChange(item.id)} key={item.id} aria-label={item.nombre} title={item.nombre}>
            {item.logo_url ? <img src={resolveMediaUrl(item.logo_url)} alt="" /> : null}
            <span>{item.nombre}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductImageThumb({ images, onClick }) {
  const cleanImages = cleanProductImages(images);
  const image = cleanImages[0];
  const fallback = (
    <span className="product-thumb-fallback" aria-hidden="true">
      <PackageSearch size={20} strokeWidth={1.8} />
    </span>
  );
  if (!image) return fallback;
  return (
    <span className="product-thumb-wrap">
      <SafeImage src={image} fallback={fallback} alt="" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined} />
      {cleanImages.length > 1 && <small>{cleanImages.length}</small>}
    </span>
  );
}

function ImageLightbox({ src, images = [], index = null, onClose, onIndexChange }) {
  const gallery = cleanProductImages(images.length ? images : (src ? [src] : []));
  if (index === null || index === undefined) return null;
  const activeIndex = Math.min(Math.max(Number(index) || 0, 0), Math.max(gallery.length - 1, 0));
  const activeSrc = gallery[activeIndex];
  const canSlide = gallery.length > 1;
  const showPrev = (event) => {
    event.stopPropagation();
    onIndexChange?.((activeIndex - 1 + gallery.length) % gallery.length);
  };
  const showNext = (event) => {
    event.stopPropagation();
    onIndexChange?.((activeIndex + 1) % gallery.length);
  };
  if (!activeSrc) return null;
  return createPortal(
    <div className="image-lightbox-backdrop" onClick={onClose}>
      <button className="image-lightbox-close" onClick={onClose} aria-label="Cerrar">
        <X size={22} />
      </button>
      {canSlide && <button className="image-lightbox-nav prev" type="button" onClick={showPrev} aria-label="Foto anterior">&lt;</button>}
      <img
        className="image-lightbox-img"
        src={activeSrc}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
      {canSlide && <button className="image-lightbox-nav next" type="button" onClick={showNext} aria-label="Foto siguiente">&gt;</button>}
      {canSlide && <span className="image-lightbox-count">{activeIndex + 1} / {gallery.length}</span>}
    </div>,
    document.body
  );
}

function DefaultProductArtwork({ product, categoryMeta }) {
  if (categoryMeta?.imagen_url) {
    return (
      <div className="default-product-artwork category-image-artwork">
        <SafeImage src={resolveMediaUrl(categoryMeta.imagen_url)} alt="" />
      </div>
    );
  }
  return (
    <div className="default-product-artwork" style={categoryPanelStyle(categoryMeta)}>
      <div className="default-product-artwork-mark">
        <PackageSearch size={42} strokeWidth={1.7} />
      </div>
    </div>
  );
}

function SafeImage({ src, fallback = null, alt = '', ...props }) {
  const [failed, setFailed] = useState(false);
  
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return fallback;
  return <img src={src} alt={alt} onError={() => setFailed(true)} {...props} />;
}

function AdminCustomerPreview({ tenant, products, clients = [], priceLists = [], brands = [], categories }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [clientId, setClientId] = useState(() => clients[0]?.id || '');
  const selectedClient = clients.find((client) => Number(client.id) === Number(clientId));
  const selectedList = priceLists.find((list) => Number(list.id) === Number(selectedClient?.lista_precio_id));
  const visibleProducts = useMemo(() => {
    return (products || []).filter((product) => {
      if (product.visible === false) return false;
      const haystack = `${product.sku} ${product.descripcion} ${product.marca} ${product.categoria} ${product.specs?.aplicacion || ''}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesCategory = category === 'all' || Number(product.categoria_id) === Number(category);
      const matchesBrand = brand === 'all' || Number(product.marca_id) === Number(brand);
      return matchesQuery && matchesCategory && matchesBrand;
    });
  }, [products, query, category, brand]);
  const categoryBrands = useMemo(() => {
    if (category === 'all') return [];
    const brandIds = new Set(
      (products || [])
        .filter((product) => product.visible !== false && Number(product.categoria_id) === Number(category))
        .map((product) => Number(product.marca_id))
        .filter(Boolean)
    );
    return (brands || []).filter((item) => brandIds.has(Number(item.id)));
  }, [products, brands, category]);
  const previewProducts = useMemo(() => {
    return visibleProducts.flatMap((product) => {
      const price = selectedList?.precios?.find((item) => Number(item.producto_id) === Number(product.id));
      if (price?.visible_cliente === false) return [];
      if (!price) return [product];
      return [{
        ...product,
        precio: Number(price.precio || 0),
        precio_promocion: price.precio_promocion,
        promo_activa: price.promo_activa === true,
        precio_final: Number(price.promo_activa && price.precio_promocion ? price.precio_promocion : price.precio || 0),
        en_promocion: price.promo_activa === true && price.precio_promocion !== null && price.precio_promocion !== undefined
      }];
    });
  }, [visibleProducts, selectedList]);
  const previewBranches = selectedClient?.sucursales?.length
    ? selectedClient.sucursales
    : [{ id: 'preview', nombre: 'Principal' }];

  useEffect(() => {
    if (!clients.length) return;
    if (!clients.some((client) => Number(client.id) === Number(clientId))) {
      setClientId(clients[0].id);
    }
  }, [clients, clientId]);

  return (
    <section className="admin-customer-preview" style={tenantBrandStyle(tenant)}>
      <div className="admin-preview-compact-header">
        <TenantLogoMark tenant={tenant} size="small" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <strong style={{ fontSize: '12px' }}>{tenant?.nombre || 'Empresa'}</strong>
            <small style={{ color: 'var(--muted)', fontSize: '10px' }}>{tenant?.subnombre || ''}</small>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={clientId || ''}
              onChange={(event) => setClientId(Number(event.target.value) || '')}
              style={{ flex: 1, maxWidth: '200px', height: '28px', fontSize: '11px', fontWeight: '700', border: '1px solid var(--line)', borderRadius: '4px', padding: '0 6px', background: 'var(--paper)', color: 'var(--text)' }}
            >
              {clients.length === 0 && <option value="">Sin clientes</option>}
              {clients.map((client) => <option value={client.id} key={client.id}>{client.nombre}</option>)}
            </select>
            <small style={{ color: 'var(--muted)', fontSize: '10px', fontWeight: '700' }}>
              {selectedList?.nombre || 'Sin lista'} · {selectedClient?.usuario || ''}
            </small>
          </div>
        </div>
      </div>

      <div className="admin-preview-sticky-tools">
        <CategoryFilterStrip categories={categories || []} value={category} onChange={(value) => { setCategory(value); setBrand('all'); }} className="admin-preview-brands" />
        {category !== 'all' && <BrandFilterStrip brands={categoryBrands} value={brand} onChange={setBrand} className="admin-preview-brands" />}

        <ClearableSearchInput
          className="search-box admin-preview-search"
          iconSize={18}
          placeholder="Buscar por codigo, marca o categoria..."
          value={query}
          onChange={setQuery}
        />
      </div>

      <p className="product-count" style={{ margin: '8px 0 4px' }}>{previewProducts.length} productos visibles</p>

      {previewProducts.length === 0 ? (
        <div className="admin-empty-state">
          <strong>No hay productos visibles</strong>
          <span>Los productos aparecerán aquí cuando estén agregados y marcados como visibles.</span>
        </div>
      ) : (
        <div className="product-grid">
          {previewProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryMeta={(categories || []).find((item) => Number(item.id) === Number(product.categoria_id))}
              brandMeta={(brands || []).find((item) => Number(item.id) === Number(product.marca_id))}
              branches={withBranchLetters(previewBranches)}
              quantities={{}}
              onQty={() => {}}
              onAdd={() => {}}
              enableLightbox={true}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AdminSectionTitle({ title, subtitle }) {
  return <div className="admin-section-title"><h1>{title}</h1><p>{subtitle}</p></div>;
}

function AdminStat({ value, label, tone, helper }) {
  return <article className={`admin-stat ${tone || ''}`}><strong>{value}</strong>{helper && <span>{helper}</span>}<small>{label}</small></article>;
}

function AdminBottomNav({ tab, setTab, pending, missingPrices }) {
  const items = [
    ['orders', 'Pedidos', Package, pending],
    ['catalog', 'Catálogo', PackageSearch],
    ['clients', 'Clientes', Users],
    ['prices', 'Precios', BadgeDollarSign, missingPrices],
    ['preview', 'Vista', Search]
  ];
  return (
    <nav className="admin-bottom-nav">
      {items.map(([id, label, Icon, badge]) => (
        <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>
          <span>{badge ? <b>{badge}</b> : null}<Icon size={19} /></span>
          {label}
        </button>
      ))}
    </nav>
  );
}

function AdminSitePreview({ tenant }) {
  return (
    <section className="admin-site-preview-bar" style={tenantBrandStyle(tenant)}>
      <div className="preview-brand-header">
        <TenantLogoMark tenant={tenant} size="small" />
        <div className="preview-brand-titles">
          <strong>{tenant?.nombre || 'Nombre de empresa'}</strong>
          <span style={{ fontSize: `${tenant?.subnombre_size || 18}px` }}>
            {tenant?.subnombre || 'Subnombre del catálogo'}
          </span>
        </div>
      </div>
      <div className="preview-brand-colors">
        <span className="preview-color-dot" style={{ background: tenant?.color_primario || '#F5C200' }} title="Color primario" />
        <span className="preview-color-dot" style={{ background: tenant?.color_secundario || '#111111' }} title="Color secundario" />
      </div>
    </section>
  );
}

function AdminEditor({ editor, brands, categories, priceLists, priceProducts, clients, onClose, onSaveProduct, onSaveClient, onSavePrice, onSaveBrand, onSaveCategory, onSaveSite, onSiteDraftChange, onSaveAccountPassword, onDeleteBrand, onDeleteCategory, theme, onThemeToggle }) {
  const [form, setForm] = useState(() => {
    const f = buildAdminEditorForm(editor, priceProducts);
    if (editor.type === 'product') {
      const d = f.descripcion || '';
      const a = f.specs?.aplicacion || '';
      const m = f.specs?.medida || '';
      f.infoText = (!d && !a && !m) ? '' : [d, a, m].join('\n');
    }
    return f;
  });
  const [previewLogoUrl, setPreviewLogoUrl] = useState('');
  const [formFeedback, setFormFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const [branchDraft, setBranchDraft] = useState({ nombre: '', direccion: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showClientEditorPassword, setShowClientEditorPassword] = useState(false);
  const [editingBranchIndex, setEditingBranchIndex] = useState(null);
  const [customSubnameMode, setCustomSubnameMode] = useState(() => Boolean(editor.value?.subnombre && !SITE_SUBNAME_OPTIONS.includes(editor.value.subnombre)));
  const [selectedProductId, setSelectedProductId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [productImage1, setProductImage1] = useState(null);
  const [productImage2, setProductImage2] = useState(null);
  const filteredSelectorProducts = useMemo(() => {
    return (priceProducts || []).filter((p) => {
      if (filterCategory && Number(p.categoria_id) !== Number(filterCategory)) return false;
      if (filterBrand && String(p.marca || '').toLowerCase() !== String(filterBrand).toLowerCase()) return false;
      if (filterSearch) {
        const q = filterSearch.trim().toLowerCase();
        const haystack = `${p.sku} ${p.marca || ''} ${p.descripcion || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [priceProducts, filterCategory, filterBrand, filterSearch]);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  const update = (key, value) => {
    setFormFeedback(null);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const clientBranches = uniqueBranches(Array.isArray(form.sucursales) ? form.sucursales : []);
  const syncClientBranches = (branches) => {
    const clean = uniqueBranches((branches || [])
      .map((branch) => ({
        id: branch.id,
        nombre: String(branch.nombre || '').trim(),
        direccion: String(branch.direccion || '').trim()
      }))
      .filter((branch) => branch.nombre));
    const sorted = [...clean].sort((a, b) => {
      const idA = a.id ? Number(a.id) : 999999;
      const idB = b.id ? Number(b.id) : 999999;
      return idA - idB;
    });
    setFormFeedback(null);
    setForm((current) => ({
      ...current,
      sucursales: sorted,
      sucursales_text: sorted.map((branch) => `${branch.nombre}${branch.direccion ? ` | ${branch.direccion}` : ''}`).join('\n')
    }));
  };
  const addClientBranch = (branch = branchDraft) => {
    const nombre = String(branch.nombre || '').trim();
    if (!nombre) return;
    syncClientBranches([...clientBranches, { nombre, direccion: String(branch.direccion || '').trim() }]);
    setBranchDraft({ nombre: '', direccion: '' });
  };
  const updateClientBranch = (index, key, value) => {
    syncClientBranches(clientBranches.map((branch, branchIndex) => (
      branchIndex === index ? { ...branch, [key]: value } : branch
    )));
  };
  const removeClientBranch = (index) => {
    syncClientBranches(clientBranches.filter((_, branchIndex) => branchIndex !== index));
  };
  const selectedSubname = customSubnameMode ? '__custom__' : SITE_SUBNAME_OPTIONS.includes(form.subnombre) ? form.subnombre : '';
  const sitePreviewTenant = useMemo(
    () => ({ ...(editor.value || {}), ...form, logo_url: previewLogoUrl || form.logo_url }),
    [editor.value, form, previewLogoUrl]
  );

  useEffect(() => {
    if (editor.type !== 'site') return undefined;
    onSiteDraftChange?.(sitePreviewTenant);
    return () => onSiteDraftChange?.(null);
  }, [editor.type, onSiteDraftChange, sitePreviewTenant]);

  useEffect(() => {
    if (!form.logoFile) {
      setPreviewLogoUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(form.logoFile);
    setPreviewLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.logoFile]);

  useEffect(() => {
    if (editor.type === 'product') {
      const images = cleanProductImages(form.imagenes);
      setProductImage1(images[0] || null);
      setProductImage2(images[1] || null);
    }
  }, [editor.type, form.imagenes]);

  async function save() {
    if (saving) return;
    setFormFeedback(null);
    if (editor.type === 'account-password') {
      if (!form.current_password || !form.new_password || !form.confirm_password) {
        setFormFeedback({ type: 'error', message: 'Completa las contraseñas.' });
        return;
      }
      if (form.new_password.length < 8) {
        setFormFeedback({ type: 'error', message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
        return;
      }
      if (form.new_password !== form.confirm_password) {
        setFormFeedback({ type: 'error', message: 'Las contraseñas no coinciden.' });
        return;
      }
      try {
        await onSaveAccountPassword(form);
        setForm((current) => ({ ...current, current_password: '', new_password: '', confirm_password: '' }));
        setFormFeedback({ type: 'success', message: 'Contraseña actualizada correctamente.' });
      } catch (error) {
        setFormFeedback({ type: 'error', message: error.message || 'No se pudo cambiar la contraseña.' });
      }
      return;
    }
    if (editor.type === 'client' && form.password && form.password.trim().length < 8) {
      setFormFeedback({ type: 'error', message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    setSaving(true);
    try {
      if (editor.type === 'product') await onSaveProduct(form);
      if (editor.type === 'client') await onSaveClient(form);
      if (editor.type === 'price' || editor.type === 'price-list') await onSavePrice(form);
      if (editor.type === 'site') await onSaveSite(form);
    } finally {
      setSaving(false);
    }
  }

  const isPasswordModal = editor.type === 'account-password';
  const isClientModal = editor.type === 'client';
  const isCenteredModal = true;

  return (
    <div className={`admin-modal-backdrop ${isCenteredModal ? 'modal-centered' : ''}`}>
      <section className={`admin-modal ${isPasswordModal ? 'admin-password-modal' : ''} ${isClientModal ? 'admin-client-modal' : ''} ${editor.type === 'site' ? 'admin-site-modal' : ''} ${editor.type === 'product' ? 'admin-product-modal' : ''} ${['brands', 'categories'].includes(editor.type) ? 'admin-crud-modal' : ''}`}>
        <header><h2>{editor.title}</h2><button onClick={onClose}><X size={18} /></button></header>

        {editor.type === 'site' && (
          <>
            <AdminSitePreview tenant={sitePreviewTenant} />
            <div className="admin-site-form">
              <div className="admin-site-form-row">
                <label>Nombre comercial<input value={form.nombre || ''} onChange={(event) => update('nombre', event.target.value)} /></label>
                <label>
                  Fuente
                  <select value={form.fuente || 'Aptos'} onChange={(event) => update('fuente', event.target.value)}>
                    {SITE_FONT_OPTIONS.map((font) => <option value={font.value} key={font.value}>{font.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="admin-site-form-row">
                <label>
                  Subnombre
                  <select
                    value={selectedSubname}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomSubnameMode(value === '__custom__');
                      update('subnombre', value === '__custom__' ? '' : value);
                    }}
                  >
                    <option value="">Seleccionar subnombre</option>
                    {SITE_SUBNAME_OPTIONS.map((option) => <option value={option} key={option}>{option}</option>)}
                    <option value="__custom__">Agregar otro</option>
                  </select>
                </label>

                <label className="admin-subname-size-label">
                  <div className="label-with-value">
                    <span>Tamaño subnombre</span>
                    <code>{form.subnombre_size || 18}px</code>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="40" 
                    step="1" 
                    value={form.subnombre_size || 18} 
                    onChange={(event) => update('subnombre_size', parseInt(event.target.value, 10))} 
                  />
                </label>
              </div>

              {customSubnameMode && (
                <label>Nuevo subnombre<input value={form.subnombre || ''} onChange={(event) => update('subnombre', event.target.value)} /></label>
              )}

              <label className="admin-logo-upload-card">
                <span>Logo de la empresa</span>
                <div className="admin-logo-upload-inner">
                  <TenantLogoMark tenant={sitePreviewTenant} />
                  <div className="admin-logo-upload-text">
                    <strong>{sitePreviewTenant.logo_url ? 'Cambiar logo de la empresa' : 'Subir imagen del logo'}</strong>
                    <small>Formato recomendado PNG o SVG sin fondo</small>
                  </div>
                  <input type="file" accept="image/*" onChange={(event) => update('logoFile', event.target.files?.[0])} />
                </div>
              </label>

              <div className="admin-color-grid">
                <label className="admin-color-item">
                  <span>Color primario</span>
                  <div className="admin-color-input-wrapper">
                    <input type="color" value={form.color_primario || '#F5C200'} onChange={(event) => update('color_primario', event.target.value)} />
                    <code>{form.color_primario || '#F5C200'}</code>
                  </div>
                </label>
                <label className="admin-color-item">
                  <span>Color secundario</span>
                  <div className="admin-color-input-wrapper">
                    <input type="color" value={form.color_secundario || '#111111'} onChange={(event) => update('color_secundario', event.target.value)} />
                    <code>{form.color_secundario || '#111111'}</code>
                  </div>
                </label>
              </div>

              <div className="admin-site-theme-toggle">
                <span>Modo visual del sitio / Tema</span>
                <div className="admin-theme-switch-group">
                  <button 
                    type="button" 
                    className={theme === 'light' ? 'active' : ''} 
                    onClick={() => theme === 'dark' && onThemeToggle && onThemeToggle()}
                  >
                    <Sun size={15} /> Modo Claro
                  </button>
                  <button 
                    type="button" 
                    className={theme === 'dark' ? 'active' : ''} 
                    onClick={() => theme === 'light' && onThemeToggle && onThemeToggle()}
                  >
                    <Moon size={15} /> Modo Oscuro
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {editor.type === 'product' && (
          <div className="admin-form admin-product-form">
            <div className="admin-product-code-stock-row">
              <label className="admin-product-sku-field">Código SKU<input placeholder="Ej: 47201-60290" value={form.sku || ''} onChange={(event) => update('sku', event.target.value)} /></label>
              <div className="admin-product-stock-grid">
                <label>Stock actual<input type="number" min="0" step="1" value={form.stock_actual ?? ''} onChange={(event) => update('stock_actual', event.target.value)} /></label>
                <label>Stock mínimo<input type="number" min="0" step="1" value={form.stock_minimo ?? ''} onChange={(event) => update('stock_minimo', event.target.value)} /></label>
              </div>
            </div>
            <label>Marca<select value={form.marca_id || brands[0]?.id || ''} onChange={(event) => update('marca_id', Number(event.target.value))}>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.nombre}</option>)}</select></label>
            <label>Categoría<select value={form.categoria_id || categories[0]?.id || ''} onChange={(event) => update('categoria_id', Number(event.target.value))}>{categories.map((category) => <option value={category.id} key={category.id}>{category.nombre}</option>)}</select></label>
            <label>
              Aplicación (una por línea)
              <textarea
                rows={4}
                style={{ height: '120px', lineHeight: '1.5', padding: '10px', resize: 'vertical' }}
                placeholder={'Hilux 79 - 88\nHIERRO / METAL\n1" Pulgada (15/16)\nMás texto aquí'}
                value={form.infoText ?? ''}
                onChange={(event) => update('infoText', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation();
                  }
                }}
              />
            </label>
            <div className="admin-product-stock-grid">
              <label>Precio<input type="number" value={form.precio || ''} onChange={(event) => update('precio', Number(event.target.value))} /></label>
            </div>
            <div className="admin-product-photos-section">
              <div className="admin-product-photo-slot">
                <label>Foto 1</label>
                {productImage1 ? (
                  <div className="admin-photo-preview">
                    <img src={productImage1} alt="Foto 1" />
                    <button type="button" className="admin-photo-delete-btn" onClick={() => {
                      setProductImage1(null);
                      const currentImages = cleanProductImages(form.imagenes);
                      update('imagenes', [null, currentImages[1]].filter(Boolean));
                    }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="admin-photo-upload">
                    <input type="file" accept="image/*" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setProductImage1(url);
                        update('imageFile1', file);
                      }
                    }} />
                    <span>Subir foto</span>
                  </label>
                )}
              </div>
              <div className="admin-product-photo-slot">
                <label>Foto 2</label>
                {productImage2 ? (
                  <div className="admin-photo-preview">
                    <img src={productImage2} alt="Foto 2" />
                    <button type="button" className="admin-photo-delete-btn" onClick={() => {
                      setProductImage2(null);
                      const currentImages = cleanProductImages(form.imagenes);
                      update('imagenes', [currentImages[0], null].filter(Boolean));
                    }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="admin-photo-upload">
                    <input type="file" accept="image/*" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setProductImage2(url);
                        update('imageFile2', file);
                      }
                    }} />
                    <span>Subir foto</span>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {editor.type === 'client' && (
          <div className="admin-form">
            <label>Nombre<input value={form.nombre || ''} onChange={(event) => update('nombre', event.target.value)} /></label>
            <label>Usuario<input value={form.username ?? ''} onChange={(event) => update('username', event.target.value)} /></label>
            <label>
              {form.id ? 'Nueva contraseña' : 'Contraseña inicial'}
              <div className="password-input-wrapper">
                <input type={showClientEditorPassword ? "text" : "password"} placeholder={form.id ? 'Dejar igual' : 'Asignar contraseña'} value={form.password || ''} onChange={(event) => update('password', event.target.value)} autoComplete="new-password" />
                <button type="button" className="password-toggle-btn" onClick={() => setShowClientEditorPassword(!showClientEditorPassword)} tabIndex="-1" aria-label={showClientEditorPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showClientEditorPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label>Lista<select value={form.lista_precio_id || ''} onChange={(event) => update('lista_precio_id', Number(event.target.value) || '')}>
              <option value="">Sin lista</option>
              {priceLists.map((list) => <option value={list.id} key={list.id}>{list.nombre}</option>)}
            </select></label>
            <label>Credito<input value={form.condicion_credito ?? ''} onChange={(event) => update('condicion_credito', event.target.value)} /></label>
            <label>Estado<select value={form.activo === false ? 'inactivo' : 'activo'} onChange={(event) => update('activo', event.target.value === 'activo')}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select></label>
            <label className="admin-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '4px 0 8px', userSelect: 'none' }}>
              <input
                type="checkbox"
                style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                checked={form.aplica_isv === true}
                onChange={(event) => update('aplica_isv', event.target.checked)}
              />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>Aplica ISV</span>
            </label>
            <section className="client-branches-editor">
              <div className="client-branches-head">
                <strong>Sucursales</strong>
                <small>{clientBranches.length ? `${clientBranches.length} configuradas` : 'Agrega al menos una sucursal para pedidos'}</small>
              </div>
              <div className="client-branch-quick">
                {['A', 'B', 'C', 'D', 'E'].slice(clientBranches.length).map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => addClientBranch({ nombre: name, direccion: '' })}
                  >
                    {name}
                  </button>
                ))}
                {clientBranches.length >= 5 && <small>Todas las letras rápidas están usadas.</small>}
              </div>
              <div className="client-branch-add">
                <input
                  value={branchDraft.nombre}
                  onChange={(event) => setBranchDraft((current) => ({ ...current, nombre: event.target.value }))}
                  placeholder="Sucursal o código"
                />
                <input
                  value={branchDraft.direccion}
                  onChange={(event) => setBranchDraft((current) => ({ ...current, direccion: event.target.value }))}
                  placeholder="Dirección opcional"
                />
                <button type="button" onClick={() => addClientBranch()} disabled={!branchDraft.nombre.trim()}>
                  Agregar
                </button>
              </div>
              <div className="client-branch-list">
                {clientBranches.length === 0 && <small className="admin-empty-inline">Sin sucursales todavía.</small>}
                {clientBranches.map((branch, index) => {
                  const isEditing = editingBranchIndex === index;
                  return isEditing ? (
                    <div className="client-branch-row editing" key={branch.id || `${branch.nombre}-${index}`} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1.5fr auto', gap: '6px', alignItems: 'center' }}>
                      <span className="client-branch-letter">{String.fromCharCode(65 + index)}</span>
                      <input value={branch.nombre || ''} onChange={(event) => updateClientBranch(index, 'nombre', event.target.value)} aria-label="Sucursal" style={{ height: '30px', fontSize: '12px' }} />
                      <input value={branch.direccion || ''} onChange={(event) => updateClientBranch(index, 'direccion', event.target.value)} aria-label="Dirección" placeholder="Dirección opcional" style={{ height: '30px', fontSize: '12px' }} />
                      <button type="button" onClick={() => setEditingBranchIndex(null)} className="branch-row-save-btn">Hecho</button>
                    </div>
                  ) : (
                    <div className="client-branch-row view" key={branch.id || `${branch.nombre}-${index}`}>
                      <span className="client-branch-letter">{String.fromCharCode(65 + index)}</span>
                      <div className="branch-info-text">
                        <strong>{branch.nombre}</strong>
                        {branch.direccion && <small style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', marginTop: '2px' }}>{branch.direccion}</small>}
                      </div>
                      <div className="branch-row-actions">
                        <button type="button" className="branch-row-btn edit" onClick={() => setEditingBranchIndex(index)}>Editar</button>
                        <button type="button" className="branch-row-btn remove" onClick={() => removeClientBranch(index)}>Quitar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            {formFeedback && <small className={formFeedback.type === 'success' ? 'form-success' : 'form-error'}>{formFeedback.message}</small>}
          </div>
        )}

        {editor.type === 'account-password' && (
          <div className="admin-form">
            <label>
              Contraseña actual
              <div className="password-input-wrapper">
                <input type={showCurrentPassword ? "text" : "password"} value={form.current_password || ''} onChange={(event) => update('current_password', event.target.value)} />
                <button type="button" className="password-toggle-btn" onClick={() => setShowCurrentPassword(!showCurrentPassword)} tabIndex="-1" aria-label={showCurrentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label>
              Nueva contraseña
              <div className="password-input-wrapper">
                <input type={showNewPassword ? "text" : "password"} value={form.new_password || ''} onChange={(event) => update('new_password', event.target.value)} />
                <button type="button" className="password-toggle-btn" onClick={() => setShowNewPassword(!showNewPassword)} tabIndex="-1" aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label>
              Confirmar nueva contraseña
              <div className="password-input-wrapper">
                <input type={showConfirmPassword ? "text" : "password"} value={form.confirm_password || ''} onChange={(event) => update('confirm_password', event.target.value)} />
                <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex="-1" aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {formFeedback && <small className={formFeedback.type === 'success' ? 'form-success' : 'form-error'}>{formFeedback.message}</small>}
          </div>
        )}

        {editor.type === 'price-list' && (
          <div className="admin-form admin-price-list-crud">
            <input type="hidden" value={form.nombre || ''} readOnly />
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '14px', background: 'var(--mist)', padding: '10px', borderRadius: '8px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Categoría</span>
                <select
                  style={{ width: '100%', height: '34px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px', fontSize: '12px', background: 'var(--paper)', color: 'var(--text)' }}
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setSelectedProductId('');
                  }}
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Marca</span>
                <select
                  style={{ width: '100%', height: '34px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px', fontSize: '12px', background: 'var(--paper)', color: 'var(--text)' }}
                  value={filterBrand}
                  onChange={(e) => {
                    setFilterBrand(e.target.value);
                    setSelectedProductId('');
                  }}
                >
                  <option value="">Todas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Buscar SKU</span>
                <input
                  type="text"
                  placeholder="SKU o desc..."
                  style={{ width: '100%', height: '34px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px', fontSize: '12px', background: 'var(--paper)', color: 'var(--text)' }}
                  value={filterSearch}
                  onChange={(e) => {
                    setFilterSearch(e.target.value);
                    setSelectedProductId('');
                  }}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Seleccionar Producto ({filteredSelectorProducts.length})</span>
              <select
                style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', fontWeight: '700', background: 'var(--paper)', color: 'var(--text)' }}
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(Number(event.target.value))}
              >
                <option value="">Selecciona un producto...</option>
                {filteredSelectorProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {[product.marca, product.descripcion].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </label>

            {selectedProductId && (() => {
              const product = priceProducts.find((p) => Number(p.id) === Number(selectedProductId));
              if (!product) return null;
              const imgs = cleanProductImages(product.imagenes);
              const mainImage = imgs[0];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                  <div className="price-single-product-summary" style={{ padding: '10px', background: 'var(--mist)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {mainImage && (
                      <div className="price-single-product-image" style={{ width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--line)', background: '#fff', flexShrink: 0 }}>
                        <img src={mainImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text)' }}>{product.sku}</strong>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px', marginTop: '2px', whiteSpace: 'normal' }}>
                        {[product.marca, product.descripcion].filter(Boolean).join(' · ')}
                      </small>
                      <div style={{ marginTop: '6px' }}>
                        <ProductStockPill product={product} />
                      </div>
                    </div>
                  </div>

                  <label className="admin-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '4px 0', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                      checked={form[`visible_${product.id}`] !== false}
                      onChange={(event) => update(`visible_${product.id}`, event.target.checked)}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>Producto visible para este cliente</span>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Precio normal (L.)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', fontWeight: '700', background: 'var(--paper)', color: 'var(--text)' }}
                      value={form[`precio_${product.id}`] ?? ''}
                      onChange={(event) => update(`precio_${product.id}`, event.target.value)}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Precio de oferta (L.)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', fontWeight: '700', background: 'var(--paper)', color: 'var(--text)' }}
                      value={form[`promo_${product.id}`] ?? ''}
                      onChange={(event) => update(`promo_${product.id}`, event.target.value)}
                    />
                  </label>

                  <label className="admin-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '4px 0', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                      checked={form[`promo_activa_${product.id}`] === true}
                      onChange={(event) => update(`promo_activa_${product.id}`, event.target.checked)}
                      disabled={!form[`promo_${product.id}`]}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>Activar oferta / promoción</span>
                  </label>
                </div>
              );
            })()}
          </div>
        )}

        {editor.type === 'price' && (
          <div className="admin-form admin-price-editor">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '14px', background: 'var(--mist)', padding: '10px', borderRadius: '8px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Categoría</span>
                <select
                  style={{ width: '100%', height: '34px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px', fontSize: '12px', background: 'var(--paper)', color: 'var(--text)' }}
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setSelectedProductId('');
                  }}
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Marca</span>
                <select
                  style={{ width: '100%', height: '34px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px', fontSize: '12px', background: 'var(--paper)', color: 'var(--text)' }}
                  value={filterBrand}
                  onChange={(e) => {
                    setFilterBrand(e.target.value);
                    setSelectedProductId('');
                  }}
                >
                  <option value="">Todas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Buscar SKU</span>
                <input
                  type="text"
                  placeholder="SKU o desc..."
                  style={{ width: '100%', height: '34px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px', fontSize: '12px', background: 'var(--paper)', color: 'var(--text)' }}
                  value={filterSearch}
                  onChange={(e) => {
                    setFilterSearch(e.target.value);
                    setSelectedProductId('');
                  }}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Seleccionar Producto ({filteredSelectorProducts.length})</span>
              <select
                style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', fontWeight: '700', background: 'var(--paper)', color: 'var(--text)' }}
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(Number(event.target.value))}
              >
                <option value="">Selecciona un producto...</option>
                {filteredSelectorProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {[product.marca, product.descripcion].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </label>

            {selectedProductId && (() => {
              const product = priceProducts.find((p) => Number(p.id) === Number(selectedProductId));
              if (!product) return null;
              const imgs = cleanProductImages(product.imagenes);
              const mainImage = imgs[0];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                  <div className="price-single-product-summary" style={{ padding: '10px', background: 'var(--mist)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {mainImage && (
                      <div className="price-single-product-image" style={{ width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--line)', background: '#fff', flexShrink: 0 }}>
                        <img src={mainImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text)' }}>{product.sku}</strong>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px', marginTop: '2px', whiteSpace: 'normal' }}>
                        {[product.marca, product.descripcion].filter(Boolean).join(' · ')}
                      </small>
                      <div style={{ marginTop: '6px' }}>
                        <ProductStockPill product={product} />
                      </div>
                    </div>
                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Precio normal (L.)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', fontWeight: '700', background: 'var(--paper)', color: 'var(--text)' }}
                      value={form[`precio_${product.id}`] ?? ''}
                      onChange={(event) => update(`precio_${product.id}`, event.target.value)}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--muted)' }}>Precio de oferta (L.)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px', fontSize: '13px', fontWeight: '700', background: 'var(--paper)', color: 'var(--text)' }}
                      value={form[`promo_${product.id}`] ?? ''}
                      onChange={(event) => update(`promo_${product.id}`, event.target.value)}
                    />
                  </label>

                  <label className="admin-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '4px 0', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                      checked={form[`promo_activa_${product.id}`] === true}
                      onChange={(event) => update(`promo_activa_${product.id}`, event.target.checked)}
                      disabled={!form[`promo_${product.id}`]}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>Activar oferta / promoción</span>
                  </label>
                </div>
              );
            })()}
          </div>
        )}

        {editor.type === 'brands' && <AdminEntityCrud items={brands} label="Marca" onSave={onSaveBrand} onDelete={onDeleteBrand} />}
        {editor.type === 'categories' && <AdminEntityCrud items={categories} label="Categoría" onSave={onSaveCategory} onDelete={onDeleteCategory} />}

        {editor.type === 'client-detail' && (
          <div className="admin-form">
            <div className="admin-client-detail" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <div className="admin-client-detail-grid" style={{ gap: '12px' }}>
                <span className="full-width"><b>Nombre Completo</b>{editor.value.nombre}</span>
                <span><b>Lista de Precios</b>{editor.value.lista || 'General'}</span>
                <span><b>Términos de Crédito</b>{editor.value.credito || 'Contado'}</span>
                <span><b>Aplica ISV</b>{editor.value.aplica_isv ? 'Sí' : 'No'}</span>
                <span><b>Último Acceso</b>{editor.value.ultimo_acceso ? new Date(editor.value.ultimo_acceso).toLocaleString('es-HN') : 'Nunca'}</span>
              </div>
              {editor.value.sucursales && editor.value.sucursales.length > 0 ? (
                <div className="client-detail-branches" style={{ marginTop: '14px' }}>
                  <b>Sucursales Configuradas:</b>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '16px', display: 'grid', gap: '6px' }}>
                    {editor.value.sucursales.map((sub, idx) => (
                      <li key={idx} style={{ fontSize: '12.5px', color: 'var(--text)' }}>
                        <strong>{String.fromCharCode(65 + idx)}</strong> · {sub.nombre} {sub.direccion ? `(${sub.direccion})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="client-detail-branches" style={{ marginTop: '14px' }}>
                  <b>Sucursales Configuradas:</b>
                  <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>Sin sucursales registradas</small>
                </div>
              )}
            </div>
            <button type="button" className="primary-button" onClick={onClose} style={{ marginTop: '20px' }}>
              Cerrar
            </button>
          </div>
        )}

        {!['brands', 'categories', 'client-detail'].includes(editor.type) && (
          <button
            className={editor.type === 'site' ? 'primary-button admin-site-save-button' : 'primary-button'}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </section>
    </div>
  );
}

function AdminEntityCrud({ items, label, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const supportsImage = label === 'Marca' || label === 'Categoría';
  const imageField = label === 'Marca' ? 'logo_url' : 'imagen_url';
  const supportsOrdering = label === 'Categoría' || label === 'Marca';
  const orderedItems = supportsOrdering
    ? [...items].sort((a, b) => (Number(a.posicion || 0) - Number(b.posicion || 0)) || String(a.nombre).localeCompare(String(b.nombre)))
    : items;
  const moveItem = (index, direction) => {
    if (!supportsOrdering) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedItems.length) return;
    const nextItems = [...orderedItems];
    const [item] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, item);
    nextItems.forEach((nextItem, nextIndex) => {
      if (Number(nextItem.posicion || 0) !== nextIndex + 1) {
        onSave({ ...nextItem, posicion: nextIndex + 1 });
      }
    });
  };
  return (
    <div className="admin-entity-crud">
      <div className="admin-form">
        <label>{label}<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        {supportsImage && (
          <label className="admin-file-input-wrapper">
            <span>{label === 'Marca' ? 'Logo' : 'Imagen'}</span>
            <div className="admin-file-picker-box">
              <input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0])} />
              <small>{logoFile ? logoFile.name : 'Seleccionar archivo...'}</small>
            </div>
          </label>
        )}
        <button className="primary-button" onClick={() => { if (!name) return; onSave({ nombre: name, posicion: supportsOrdering ? orderedItems.length + 1 : 0, [label === 'Marca' ? 'logoFile' : 'imageFile']: logoFile }); setName(''); setLogoFile(null); }}>Agregar</button>
      </div>
      {orderedItems.map((item, index) => (
        <div className="admin-entity-row" key={item.id}>
          <div className="admin-entity-main">
            {supportsImage && (
              <span className="admin-entity-thumb">
                {item[imageField] ? <img src={resolveMediaUrl(item[imageField])} alt="" /> : <Folder size={16} />}
              </span>
            )}
            <strong>{item.nombre}</strong>
            {supportsOrdering && (
              <div className="admin-entity-order">
                <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Subir ${item.nombre}`}><ChevronUp size={14} /></button>
                <button type="button" onClick={() => moveItem(index, 1)} disabled={index === orderedItems.length - 1} aria-label={`Bajar ${item.nombre}`}><ChevronDown size={14} /></button>
              </div>
            )}
          </div>
          <div className="admin-entity-actions">
            <button type="button" onClick={() => onSave({ ...item, nombre: window.prompt(`Editar ${label}`, item.nombre) || item.nombre })}>Editar</button>
            {supportsImage && <button type="button" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = () => {
                const file = input.files?.[0];
                if (file) onSave({ ...item, [label === 'Marca' ? 'logoFile' : 'imageFile']: file });
              };
              input.click();
            }}>Imagen</button>}
            <button type="button" className="danger-icon-button" onClick={() => onDelete(item.id)}>Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function stateLabel(state) {
  return ({ pendiente: 'Pendiente', preparando: 'Preparando', enviado: 'Enviado' })[state] || state;
}

function sortByPositionThenName(a, b) {
  return (Number(a?.posicion || 0) - Number(b?.posicion || 0)) || String(a?.nombre || '').localeCompare(String(b?.nombre || ''));
}

function prepareProductPayload(product, products, brands, categories) {
  const lines = String(product.infoText ?? '').split(/\r?\n/);
  const descripcion = (lines[0] || '').trim() || product.descripcion || product.sku;
  const aplicacion = (lines[1] || '').trim();
  const medida = lines.slice(2).join('\n').trim();

  const productImages = cleanProductImages(product.imagenes);
  
  // For existing products, only set position if explicitly provided, otherwise don't send it
  const posicion = product.id !== undefined 
    ? (product.posicion !== undefined ? product.posicion : undefined)
    : (product.posicion !== undefined ? product.posicion : products.length);

  return normalizeAdminProduct(
    {
      ...product,
      descripcion,
      specs: {
        ...(product.specs || {}),
        aplicacion,
        medida
      },
      marca_id: product.marca_id || brands[0]?.id || null,
      categoria_id: product.categoria_id || categories[0]?.id || null,
      visible: product.visible !== false,
      posicion,
      imagenes: productImages,
      precio: Number(product.precio || product.precio_final || 0),
      stock_actual: normalizeInventoryCount(product.stock_actual),
      stock_minimo: normalizeInventoryCount(product.stock_minimo)
    },
    brands,
    categories
  );
}

function normalizeAdminProduct(product, brands = [], categories = []) {
  const brand = brands.find((item) => Number(item.id) === Number(product.marca_id));
  const category = categories.find((item) => Number(item.id) === Number(product.categoria_id));
  return {
    ...product,
    marca: product.marca || brand?.nombre || '',
    marca_logo_url: product.marca_logo_url || brand?.logo_url || '',
    categoria: product.categoria || category?.nombre || '',
    specs: product.specs || {},
    imagenes: cleanProductImages(product.imagenes),
    precio: Number(product.precio || product.precio_final || 0),
    precio_final: Number(product.precio_final || product.precio || 0),
    stock_actual: normalizeInventoryCount(product.stock_actual),
    stock_minimo: normalizeInventoryCount(product.stock_minimo)
  };
}

function normalizeInventoryCount(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function cleanProductImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((image) => String(image || '').trim())
    .filter((image) => image && !image.endsWith('/kolben-part.svg') && image !== '/kolben-part.svg')
    .map(resolveMediaUrl);
}

function normalizeAdminClient(client) {
  const branches = uniqueBranches(Array.isArray(client.sucursales) ? client.sucursales : []);
  const accessDate = client.ultimo_acceso ? new Date(client.ultimo_acceso) : null;
  const accessLabel = accessDate && !Number.isNaN(accessDate.getTime())
    ? `${client.ultimo_user_agent || 'Acceso'} · ${accessDate.toLocaleString('es-HN')} · ${client.ultimo_geolocalizacion || client.ultimo_ip || 'Sin ubicacion'}`
    : 'Sin accesos registrados';
  return {
    ...client,
    usuario: client.username || client.usuario || client.email || '',
    lista: client.lista_precio || client.lista || 'Sin lista',
    credito: client.condicion_credito || client.credito || 'Contado',
    tipo: branches.length > 1 ? 'Multi-sucursal' : 'Estandar',
    acceso: accessLabel,
    acceso_corto: accessDate && !Number.isNaN(accessDate.getTime()) ? accessDate.toLocaleDateString('es-HN') : 'Sin acceso',
    iniciales: initials(client.nombre || 'Cliente'),
    sucursales: branches,
    sucursales_text: branches.map((branch) => `${branch.nombre}${branch.direccion ? ` | ${branch.direccion}` : ''}`).join('\n')
  };
}

function normalizeAdminPriceData(payload) {
  return {
    listas: (payload.listas || []).map((list) => ({
      ...list,
      clientes_asignados: list.clientes_asignados || [],
      precios: list.precios || [],
      productos_faltantes: Number(list.productos_faltantes || 0)
    })),
    productos: payload.productos || []
  };
}

function buildAdminEditorForm(editor, priceProducts = []) {
  const form = { ...editor.value };
  if (editor.type === 'price' || editor.type === 'price-list') {
    if (Array.isArray(priceProducts)) {
      for (const p of priceProducts) {
        form[`precio_${p.id}`] = p.precio ?? '';
        form[`promo_${p.id}`] = p.precio_oferta ?? p.precio_promocion ?? '';
        form[`promo_activa_${p.id}`] = p.promo_activa === true;
        form[`visible_${p.id}`] = true;
      }
    }
    for (const price of editor.value.precios || []) {
      form[`precio_${price.producto_id}`] = price.precio ?? '';
      form[`promo_${price.producto_id}`] = price.precio_promocion ?? '';
      form[`promo_activa_${price.producto_id}`] = price.promo_activa === true;
      form[`visible_${price.producto_id}`] = price.visible_cliente !== false;
    }
  }
  if (editor.type === 'price-list') {
    form.client_id = editor.value.client_id || editor.value.client?.id || '';
    for (const client of editor.value.clientes_asignados || []) {
      form[`cliente_${client.id}`] = true;
    }
  }
  if (editor.type === 'client') {
    form.username = form.username || form.usuario || '';
    form.condicion_credito = form.condicion_credito || form.credito || 'Contado';
    const clean = Array.isArray(form.sucursales) ? form.sucursales : [];
    const sorted = [...clean].sort((a, b) => {
      const idA = a.id ? Number(a.id) : 999999;
      const idB = b.id ? Number(b.id) : 999999;
      return idA - idB;
    });
    form.sucursales = sorted;
    form.sucursales_text = sorted.map((branch) => `${branch.nombre}${branch.direccion ? ` | ${branch.direccion}` : ''}`).join('\n');
  }
  return form;
}

function groupPriceProductsByCategory(products = []) {
  const groups = new Map();
  for (const product of products) {
    const key = product.categoria || 'Sin categoria';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}

function prepareClientPayload(client) {
  const existingBranches = Array.isArray(client.sucursales) ? client.sucursales : [];
  const branchesByLine = new Map(existingBranches.map((branch) => [
    normalizeBranchKey(branch.nombre, branch.direccion),
    branch
  ]));
  const sourceBranches = Array.isArray(client.sucursales)
    ? client.sucursales
    : String(client.sucursales_text || '')
      .split('\n')
      .map((line) => {
        const [name, ...addressParts] = line.split('|');
        return { nombre: name?.trim(), direccion: addressParts.join('|').trim() };
      });
  const sucursales = uniqueBranches(sourceBranches
    .map((branch) => {
      const nombre = String(branch.nombre || '').trim();
      const direccion = String(branch.direccion || '').trim();
      const existing = branch.id ? branch : branchesByLine.get(normalizeBranchKey(nombre, direccion));
      return { id: existing?.id, nombre, direccion };
    })
    .filter((branch) => branch.nombre));
  return {
    id: client.cliente_id || client.id,
    nombre: String(client.nombre || '').trim(),
    username: String(client.username || client.usuario || client.email || '').trim(),
    email: client.email && !String(client.email).endsWith('@cliente.local') ? String(client.email).trim().toLowerCase() : undefined,
    password: String(client.password || '').trim() || undefined,
    condicion_credito: String(client.condicion_credito || client.credito || 'Contado').trim(),
    activo: client.activo !== false,
    aplica_isv: client.aplica_isv === true,
    lista_precio_id: client.lista_precio_id || null,
    sucursales
  };
}

function normalizeBranchKey(nombre, direccion) {
  return `${String(nombre || '').trim().toLowerCase()}|${String(direccion || '').trim().toLowerCase()}`;
}

function uniqueBranches(branches = []) {
  const seen = new Set();
  return branches.filter((branch) => {
    const key = branch.id ? `id:${branch.id}` : normalizeBranchKey(branch.nombre, branch.direccion);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withBranchLetters(branches = []) {
  const unique = uniqueBranches(Array.isArray(branches) ? branches : []);
  const sorted = [...unique].sort((a, b) => {
    const idA = a.id ? Number(a.id) : 999999;
    const idB = b.id ? Number(b.id) : 999999;
    return idA - idB;
  });
  return sorted.map((branch, index) => ({
    ...branch,
    letra: String.fromCharCode(65 + index)
  }));
}

function AdminOrder({ order, token }) {
  const [state, setState] = useState(order.estado);

  async function advance(nextState) {
    const ok = window.confirm(`Confirmar cambio a "${nextState}"`) && window.confirm('Segunda confirmación requerida');
    if (!ok) return;
    await api.updateOrderStatus(token, order.id, nextState);
    setState(nextState);
  }

  return (
    <article className="admin-order">
      <div><strong>{order.numero}</strong><span>{order.cliente_nombre || 'Cliente mayorista'}</span></div>
      <b>{state}</b>
      <button onClick={() => advance('preparando')}>Preparando</button>
      <button onClick={() => advance('enviado')}>Enviado</button>
    </article>
  );
}

function tenantReadiness(tenant) {
  const checks = [
    { key: 'admin', label: 'Admin', ready: Number(tenant.admin_count || 0) > 0 },
    { key: 'logo', label: 'Logo', ready: Boolean(tenant.logo_url) },
    { key: 'products', label: 'Productos', ready: Number(tenant.product_count || 0) > 0 }
  ];
  const readyCount = checks.filter((item) => item.ready).length;
  return {
    checks,
    readyCount,
    label: readyCount === checks.length ? 'Lista para operar' : `${checks.length - readyCount} pendientes`
  };
}

function formatShortDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-HN', { day: '2-digit', month: 'short' });
}

function SuperAdmin({ token, onLogout, theme, onThemeToggle }) {
  const [tenants, setTenants] = useState(null);
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [nombre, setNombre] = useState('');
  const [subnombre, setSubnombre] = useState('');
  const [subnombreSeleccionado, setSubnombreSeleccionado] = useState('');
  const [nuevoSubnombre, setNuevoSubnombre] = useState('');
  const [subnombreOptions, setSubnombreOptions] = useState([]);
  const [editingSubnombre, setEditingSubnombre] = useState('');
  const [editSubnombreValue, setEditSubnombreValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [adminPanel, setAdminPanel] = useState(null);
  const [adminNombre, setAdminNombre] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editAdminNombre, setEditAdminNombre] = useState('');
  const [editAdminUsername, setEditAdminUsername] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editingTenant, setEditingTenant] = useState(null);
  const [editTenantNombre, setEditTenantNombre] = useState('');
  const [editTenantSubnombre, setEditTenantSubnombre] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [tempPasswordsByAdmin, setTempPasswordsByAdmin] = useState({});
  const [toast, setToast] = useState('');
  const [selectedTenantOptions, setSelectedTenantOptions] = useState(null);
  const [configEmail, setConfigEmail] = useState('');
  const [tenantConfirm, setTenantConfirm] = useState(null);
  const [tenantDeleteInput, setTenantDeleteInput] = useState('');
  const [adminConfirm, setAdminConfirm] = useState(null);
  const [superadminSection, setSuperadminSection] = useState('companies');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [showSuperadminCurrentPassword, setShowSuperadminCurrentPassword] = useState(false);
  const [showSuperadminNewPassword, setShowSuperadminNewPassword] = useState(false);
  const [showSuperadminConfirmPassword, setShowSuperadminConfirmPassword] = useState(false);
  const [showEditAdminPassword, setShowEditAdminPassword] = useState(false);
  const toastTimer = useRef(null);
  const subdominioPreview = useMemo(() => slugifyValue(nombre) || 'empresa', [nombre]);
  const filteredTenants = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();
    return (tenants || []).filter((tenant) => {
      const haystack = `${tenant.nombre || ''} ${tenant.slug || ''} ${tenant.subnombre || ''}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesFilter = tenantFilter === 'all'
        || (tenantFilter === 'active' && tenant.activa)
        || (tenantFilter === 'inactive' && !tenant.activa)
        || (tenantFilter === 'no-admins' && Number(tenant.admin_count || 0) === 0)
        || (tenantFilter === 'no-products' && Number(tenant.product_count || 0) === 0);
      return matchesQuery && matchesFilter;
    });
  }, [tenants, tenantSearch, tenantFilter]);
  const tenantStats = useMemo(() => {
    const list = tenants || [];
    const sortedByProducts = [...list].sort((a, b) => Number(b.product_count || 0) - Number(a.product_count || 0)).slice(0, 5);
    const sortedByOrders = [...list].sort((a, b) => Number(b.order_count || 0) - Number(a.order_count || 0)).slice(0, 5);
    return { sortedByProducts, sortedByOrders };
  }, [tenants]);

  function showToast(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1000);
  }

  useEffect(() => {
    if (!token) return;
    api.superadminTenants(token)
      .then((payload) => {
        const nextTenants = payload.tenants || [];
        setTenants(nextTenants);
        setOverview(payload.overview || null);
        setActivity(payload.activity || []);
        setRegistrationRequests(payload.registration_requests || []);
        const savedTenantId = loadUiState().superadmin?.openTenantId;
        if (savedTenantId) {
          const savedTenant = nextTenants.find((tenant) => tenant.id === savedTenantId);
          if (savedTenant) {
            openAdmins(savedTenant, { skipPersist: true });
          }
        }
        showToast('Bienvenido a CatálogoHN');
      })
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.superadminSubnames(token)
      .then((payload) => {
        const next = (payload.subnames || []).map((item) => item.nombre).filter(Boolean);
        setSubnombreOptions(next);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  async function openAdmins(tenant, options = {}) {
    setError('');
    setTempPassword('');
    setAdminNombre('');
    setAdminUsername('');
    setAdminPassword('');
    setEditingAdmin(null);
    setEditAdminNombre('');
    setEditAdminUsername('');
    setEditAdminPassword('');
    if (!options.skipPersist) {
      updateUiState((current) => ({
        ...current,
        appView: 'superadmin',
        superadmin: {
          ...(current.superadmin || {}),
          openTenantId: tenant.id
        }
      }));
    }
    setAdminPanel({ tenant, admins: null, loading: true });
    try {
      const payload = await api.superadminAdmins(token, tenant.id);
      setAdminPanel({ tenant: payload.tenant || tenant, admins: payload.admins || [], loading: false });
    } catch (err) {
      setError(err.message);
      setAdminPanel({ tenant, admins: [], loading: false });
    }
  }

  function closeAdmins() {
    setAdminPanel(null);
    setTempPassword('');
    setEditingAdmin(null);
    setEditAdminNombre('');
    setEditAdminUsername('');
    setEditAdminPassword('');
    updateUiState((current) => ({
      ...current,
      appView: 'superadmin',
      superadmin: {
        ...(current.superadmin || {}),
        openTenantId: null
      }
    }));
  }

  async function createAdmin(event) {
    event.preventDefault();
    if (!adminPanel?.tenant?.id) return;
    setError('');
    setTempPassword('');
    try {
      const payload = await api.superadminCreateAdmin(token, adminPanel.tenant.id, {
        nombre: adminNombre,
        username: adminUsername
      });
      setTempPassword(payload.temp_password || '');
      if (payload.admin?.id && payload.temp_password) {
        setTempPasswordsByAdmin((current) => ({ ...current, [payload.admin.id]: payload.temp_password }));
      }
      setAdminPanel((current) => ({ ...current, admins: [payload.admin, ...(current?.admins || [])] }));
      setTenants((current) => (current || []).map((tenant) => (
        tenant.id === adminPanel.tenant.id
          ? { ...tenant, admin_count: Number(tenant.admin_count || 0) + 1 }
          : tenant
      )));
      setOverview((current) => current ? { ...current, admins_total: Number(current.admins_total || 0) + 1 } : current);
      setAdminNombre('');
      setAdminUsername('');
      setAdminPassword('');
      showToast(`Admin ${payload.admin?.username || payload.admin?.nombre || ''} creado correctamente`);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditAdmin(admin) {
    setError('');
    setTempPassword('');
    setEditingAdmin(admin);
    setEditAdminNombre(admin.nombre || '');
    setEditAdminUsername(admin.username || '');
    setEditAdminPassword('');
  }

  function cancelEditAdmin() {
    setEditingAdmin(null);
    setEditAdminNombre('');
    setEditAdminUsername('');
    setEditAdminPassword('');
  }

  async function saveAdminChanges(admin) {
    if (!admin?.id) return;
    const nextPassword = editAdminPassword.trim();
    if (nextPassword && nextPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    const payload = {
      nombre: editAdminNombre,
      username: editAdminUsername,
      password: nextPassword || undefined
    };
    setError('');
    setTempPassword('');
    try {
      const result = await api.superadminUpdateAdmin(token, admin.id, payload);
      if (adminPanel?.tenant?.id) {
        const latest = await api.superadminAdmins(token, adminPanel.tenant.id);
        setAdminPanel((current) => ({
          ...current,
          tenant: latest.tenant || current?.tenant,
          admins: latest.admins || []
        }));
      } else {
        setAdminPanel((current) => ({
          ...current,
          admins: (current?.admins || []).map((item) => (Number(item.id) === Number(admin.id) ? result.admin : item))
        }));
      }
      if (result.temp_password) {
        setTempPasswordsByAdmin((current) => ({ ...current, [admin.id]: result.temp_password }));
        setTempPassword(result.temp_password);
        showToast('Contraseña de admin guardada');
      } else {
        showToast('Admin actualizado');
      }
      cancelEditAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeAdmin(admin) {
    if (!admin?.id) return;
    setAdminConfirm(admin);
  }

  async function changeSuperadminPassword(event) {
    event.preventDefault();
    setError('');
    setPasswordMessage('');
    const currentPassword = passwordForm.current_password;
    const nextPassword = passwordForm.new_password;
    const confirmPassword = passwordForm.confirm_password;
    if (!currentPassword || !nextPassword || !confirmPassword) {
      setPasswordMessage('Completa los tres campos.');
      return;
    }
    if (nextPassword.length < 8) {
      setPasswordMessage('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordMessage('La confirmación no coincide.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.changePassword(token, {
        current_password: currentPassword,
        new_password: nextPassword
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordMessage('Contraseña actualizada correctamente.');
      showToast('Contraseña actualizada');
    } catch (err) {
      setPasswordMessage(err.message || 'No se pudo cambiar la contraseña');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function generateAdminPassword(admin) {
    if (!admin?.id) return;
    setError('');
    setTempPassword('');
    try {
      const result = await api.superadminResetAdminPassword(token, admin.id);
      setTempPasswordsByAdmin((current) => ({ ...current, [admin.id]: result.temp_password }));
      setTempPassword(result.temp_password || '');
      showToast(`Nueva contraseña temporal generada para ${admin.username || admin.nombre}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmRemoveAdmin() {
    const admin = adminConfirm;
    if (!admin?.id) return;
    setError('');
    setTempPassword('');
    try {
      await api.superadminDeleteAdmin(token, admin.id);
      setAdminPanel((current) => ({
        ...current,
        admins: (current?.admins || []).filter((item) => item.id !== admin.id)
      }));
      setTempPasswordsByAdmin((current) => {
        const next = { ...current };
        delete next[admin.id];
        return next;
      });
      if (editingAdmin?.id === admin.id) cancelEditAdmin();
      setTenants((current) => (current || []).map((tenant) => (
        tenant.id === admin.empresa_id
          ? { ...tenant, admin_count: Math.max(0, Number(tenant.admin_count || 0) - 1) }
          : tenant
      )));
      setOverview((current) => current ? { ...current, admins_total: Math.max(0, Number(current.admins_total || 0) - 1) } : current);
      setAdminConfirm(null);
      showToast(`Admin ${admin.username || admin.nombre} eliminado correctamente`);
    } catch (err) {
      setError(err.message);
      setAdminConfirm(null);
    }
  }

  async function createTenant(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await api.superadminCreateTenant(token, { nombre, subnombre });
      setTenants((current) => [{ ...created.tenant, admin_count: 0, client_count: 0, product_count: 0, order_count: 0 }, ...(current || [])]);
      setOverview((current) => current ? {
        ...current,
        empresas_total: Number(current.empresas_total || 0) + 1,
        empresas_activas: Number(current.empresas_activas || 0) + 1
      } : current);
      setActivity((current) => [{
        id: `local-${Date.now()}`,
        tipo: 'empresa_creada',
        descripcion: `Empresa ${created.tenant?.nombre || nombre} creada`,
        created_at: new Date().toISOString()
      }, ...current].slice(0, 8));
      setNombre('');
      setSubnombre('');
      setSubnombreSeleccionado('');
      setNuevoSubnombre('');
      setIsCreateModalOpen(false);
      showToast(`Empresa ${created.tenant?.nombre || nombre} creada correctamente`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function requestTenantStatusChange(tenant) {
    const action = tenant.activa ? 'desactivar' : 'activar';
    setTenantConfirm({
      type: 'status',
      tenant,
      title: tenant.activa ? 'Desactivar empresa' : 'Activar empresa',
      message: `Quieres ${action} la empresa "${tenant.nombre}"?`,
      confirmLabel: tenant.activa ? 'Desactivar' : 'Activar'
    });
  }

  function requestTenantDelete(tenant) {
    setTenantDeleteInput('');
    setTenantConfirm({
      type: 'delete',
      tenant,
      title: 'Borrar empresa',
      message: `Esto borrara "${tenant.nombre}" y toda su informacion asociada. Escribe "${tenant.slug}" para confirmar.`,
      confirmLabel: 'Borrar empresa'
    });
  }

  async function confirmTenantAction() {
    if (!tenantConfirm?.tenant) return;
    setError('');
    const { tenant, type } = tenantConfirm;
    try {
      if (type === 'delete') {
        await api.superadminDeleteTenant(token, tenant.id, tenantDeleteInput);
        setTenants((current) => (current || []).filter((item) => item.id !== tenant.id));
        setOverview((current) => current ? {
          ...current,
          empresas_total: Math.max(0, Number(current.empresas_total || 0) - 1),
          empresas_activas: Math.max(0, Number(current.empresas_activas || 0) - (tenant.activa ? 1 : 0))
        } : current);
        if (adminPanel?.tenant?.id === tenant.id) closeAdmins();
        setTenantConfirm(null);
        setTenantDeleteInput('');
        showToast(`Empresa ${tenant.nombre} borrada correctamente`);
        return;
      }

      const updated = await api.superadminSetTenantActive(token, tenant.id, !tenant.activa);
      setTenants((current) => (current || []).map((item) => (item.id === tenant.id ? { ...item, ...updated.tenant } : item)));
      setOverview((current) => current ? {
        ...current,
        empresas_activas: Math.max(0, Number(current.empresas_activas || 0) + (updated.tenant?.activa ? 1 : -1))
      } : current);
      setTenantConfirm(null);
      setTenantDeleteInput('');
      showToast(`Empresa ${updated.tenant?.activa ? 'activada' : 'desactivada'} correctamente`);
    } catch (err) {
      setError(err.message);
      setTenantConfirm(null);
      setTenantDeleteInput('');
    }
  }

  async function toggleTenantNotifications(tenant) {
    setError('');
    try {
      const nextValue = tenant.notificaciones_activas !== false ? false : true;
      const updated = await api.superadminSetTenantNotifications(token, tenant.id, nextValue);
      setTenants((current) => (current || []).map((item) => (item.id === tenant.id ? { ...item, ...updated.tenant } : item)));
      showToast(`Notificaciones de ${tenant.nombre} ${nextValue ? 'activadas' : 'desactivadas'}`);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado de las notificaciones');
    }
  }

  function openConfig(tenant) {
    setError('');
    setSelectedTenantOptions(tenant);
    setConfigEmail(tenant.email_notificaciones || '');
  }

  async function editTenantEmailDirect(tenantId, emailValue) {
    setError('');
    try {
      const email = String(emailValue || '').trim();
      const updated = await api.superadminUpdateTenantEmail(token, tenantId, email);
      setTenants((current) => (current || []).map((item) => (item.id === tenantId ? { ...item, ...updated.tenant } : item)));
      setSelectedTenantOptions((current) => current && current.id === tenantId ? { ...current, ...updated.tenant } : current);
      showToast(`Correo de notificación actualizado`);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el correo');
    }
  }

  async function editTenantEmail(tenant) {
    const input = window.prompt(
      `Configurar correo de notificaciones para ${tenant.nombre}:`,
      tenant.email_notificaciones || ''
    );
    if (input === null) return;
    
    setError('');
    try {
      const email = input.trim();
      const updated = await api.superadminUpdateTenantEmail(token, tenant.id, email);
      setTenants((current) => (current || []).map((item) => (item.id === tenant.id ? { ...item, ...updated.tenant } : item)));
      showToast(`Correo de ${tenant.nombre} actualizado`);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el correo');
    }
  }

  function editTenantName(tenant) {
    setError('');
    setEditingTenant(tenant);
    setEditTenantNombre(tenant.nombre || '');
    setEditTenantSubnombre(tenant.subnombre || '');
  }

  async function saveTenantNameChanges(event) {
    event.preventDefault();
    if (!editingTenant?.id) return;
    const trimmed = editTenantNombre.trim();
    if (!trimmed) {
      setError('El nombre no puede estar vacío');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const updated = await api.superadminUpdateTenant(token, editingTenant.id, {
        nombre: trimmed,
        subnombre: editTenantSubnombre.trim()
      });
      setTenants((current) => (current || []).map((item) => (item.id === editingTenant.id ? { ...item, ...updated.tenant } : item)));
      showToast(`Empresa actualizada: ${updated.tenant?.nombre || trimmed}`);
      setEditingTenant(null);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la empresa');
    } finally {
      setSaving(false);
    }
  }

  function cancelEditTenant() {
    setEditingTenant(null);
    setEditTenantNombre('');
    setEditTenantSubnombre('');
  }

  function handleSubnombreChange(value) {
    setSubnombreSeleccionado(value);
    if (value === '__nuevo__') {
      setSubnombre('');
      return;
    }
    setSubnombre(value);
    setNuevoSubnombre('');
  }

  async function agregarSubnombre() {
    const value = String(nuevoSubnombre || '').trim();
    if (!value) return;
    try {
      const result = await api.superadminCreateSubname(token, { nombre: value });
      const nextValue = result.subname?.nombre || value;
      setSubnombreOptions((current) => (current.includes(nextValue) ? current : [...current, nextValue]));
      setSubnombreSeleccionado(nextValue);
      setSubnombre(nextValue);
      setNuevoSubnombre('');
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditSubnombre(option) {
    setEditingSubnombre(option);
    setEditSubnombreValue(option);
  }

  async function saveSubnombreEdit() {
    const value = String(editSubnombreValue || '').trim();
    if (!editingSubnombre || !value) return;
    try {
      const result = await api.superadminUpdateSubname(token, editingSubnombre, { nombre: value });
      const nextValue = result.subname?.nombre || value;
      setSubnombreOptions((current) => current.map((option) => (option === editingSubnombre ? nextValue : option)));
      if (subnombre === editingSubnombre) setSubnombre(nextValue);
      if (subnombreSeleccionado === editingSubnombre) setSubnombreSeleccionado(nextValue);
      setEditingSubnombre('');
      setEditSubnombreValue('');
    } catch (err) {
      setError(err.message);
    }
  }

  function cancelSubnombreEdit() {
    setEditingSubnombre('');
    setEditSubnombreValue('');
  }

  async function deleteSubnombre(option) {
    const isUsed = (tenants || []).some((tenant) => tenant.subnombre === option);
    const detail = isUsed
      ? `El subnombre "${option}" ya esta usado por una o mas empresas. Esto solo lo quitara de las opciones nuevas; no cambia empresas existentes.`
      : `Eliminar "${option}" de las opciones de subnombre?`;
    if (!window.confirm(detail)) return;
    try {
      await api.superadminDeleteSubname(token, option);
      setSubnombreOptions((current) => current.filter((item) => item !== option));
      if (subnombre === option) setSubnombre('');
      if (subnombreSeleccionado === option) setSubnombreSeleccionado('');
      if (editingSubnombre === option) cancelSubnombreEdit();
      showToast(`Subnombre "${option}" eliminado de las opciones`);
    } catch (err) {
      setError(err.message);
    }
  }

  function tenantAccessUrl(tenant) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.origin}?tenant=${tenant.slug}`;
    }
    return `https://${tenant.slug}.catalogohn.com`;
  }

  async function copyTenantLink(tenant) {
    const url = tenantAccessUrl(tenant);
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Link de ${tenant.nombre} copiado`);
    } catch {
      window.prompt('Copiar link', url);
    }
  }

  async function openTenantAdmin(tenant) {
    setError('');
    try {
      const result = await api.superadminOpenAdminSession(token, tenant.id);
      const originalSession = loadSession();
      const nextSession = {
        token: result.token,
        user: result.user,
        tenant: result.tenant,
        impersonated_from: {
          token,
          user: originalSession?.user || null,
          tenant: originalSession?.tenant || null,
          impersonation: result.impersonation || null
        }
      };
      api.setTenantSlug(result.tenant?.slug || tenant.slug || 'kolben');
      const sessionParam = encodeURIComponent(JSON.stringify(nextSession));
      const adminWindow = window.open(`${window.location.origin}/?session=${sessionParam}`, '_blank', 'noopener,noreferrer');
      if (!adminWindow) {
        throw new Error('El navegador bloqueo la nueva ventana');
      }
      showToast(`Abriendo ${tenant.nombre} como admin`);
    } catch (err) {
      setError(err.message || 'No se pudo abrir la empresa');
    }
  }

  return (
    <section className="superadmin-page">
      {toast && <div className="superadmin-toast">{toast}</div>}
      <header className="login-header superadmin-top-header">
        <div className="superadmin-header-text">
          <strong>CatálogoHN</strong>
          <span>Super Admin · Gestor central de empresas</span>
        </div>
        <div className="superadmin-top-actions">
          <button className="icon-button superadmin-menu-button" type="button" onClick={() => setSidebarOpen((current) => !current)} aria-label="Abrir panel lateral">
            <Menu size={18} />
          </button>
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <button className="icon-button superadmin-logout" onClick={onLogout} aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="superadmin-layout">
        {sidebarOpen && <button className="superadmin-sidebar-backdrop" type="button" aria-label="Cerrar panel lateral" onClick={() => setSidebarOpen(false)} />}
        <aside className={`superadmin-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <div className="superadmin-sidebar-main">
            {[
              ['companies', 'Empresas', Building2],
              ['stats', 'Estadísticas', Activity],
              ['history', 'Historiales', ClipboardList],
              ['password', 'Cambiar contraseña', Settings2]
            ].map(([id, label, Icon]) => (
              <button key={id} type="button" className={superadminSection === id ? 'active' : ''} onClick={() => { setSuperadminSection(id); setSidebarOpen(false); }}>
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="superadmin-box">
        {superadminSection === 'stats' && (
          <div className="superadmin-section-view">
            <div className="superadmin-head">
              <h1>Estadísticas</h1>
              <span className="status-pill">Resumen general</span>
            </div>
            <section className="superadmin-dashboard">
              <Metric label="Empresas" value={overview?.empresas_total ?? (tenants || []).length} />
              <Metric label="Activas" value={overview?.empresas_activas ?? (tenants || []).filter((item) => item.activa).length} />
              <Metric label="Admins" value={overview?.admins_total ?? '-'} />
              <Metric label="Productos" value={overview?.productos_total ?? '-'} />
              <Metric label="Pedidos mes" value={overview?.pedidos_mes ?? '-'} />
            </section>
            <section className="superadmin-insights superadmin-stats-panels">
              <article>
                <div className="superadmin-panel-head"><strong>Empresas con más productos</strong></div>
                {tenantStats.sortedByProducts.length === 0 && <small className="admin-muted-note">Sin datos.</small>}
                {tenantStats.sortedByProducts.map((tenant) => (
                  <p key={`products-${tenant.id}`}><span>{tenant.product_count || 0} prod.</span>{tenant.nombre}</p>
                ))}
              </article>
              <article>
                <div className="superadmin-panel-head"><strong>Empresas con más pedidos</strong></div>
                {tenantStats.sortedByOrders.length === 0 && <small className="admin-muted-note">Sin datos.</small>}
                {tenantStats.sortedByOrders.map((tenant) => (
                  <p key={`orders-${tenant.id}`}><span>{tenant.order_count || 0} pedidos</span>{tenant.nombre}</p>
                ))}
              </article>
            </section>
          </div>
        )}

        {superadminSection === 'history' && (
          <div className="superadmin-section-view">
            <div className="superadmin-head">
              <h1>Historiales</h1>
              <span className="status-pill">Actividad</span>
            </div>
            <section className="superadmin-insights">
              <article>
                <div className="superadmin-panel-head">
                  <strong><Activity size={16} /> Historial reciente</strong>
                </div>
                {activity.length === 0 && <small className="admin-muted-note">Sin acciones registradas todavía.</small>}
                <div className="superadmin-history-list">
                  {activity.map((item) => (
                    <div className="superadmin-history-item" key={item.id}>
                      <span className="history-date">{formatShortDate(item.created_at)}</span>
                      <span className="history-desc">{item.descripcion}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </div>
        )}

        {superadminSection === 'requests' && (
          <div className="superadmin-section-view">
            <div className="superadmin-head">
              <h1>Solicitudes</h1>
              <span className="status-pill">Registro</span>
            </div>
            <section className="superadmin-insights">
              <article>
                <div className="superadmin-panel-head">
                  <strong><ClipboardList size={16} /> Solicitudes nuevas</strong>
                </div>
                {registrationRequests.length === 0 && <small className="admin-muted-note">Sin solicitudes nuevas.</small>}
                {registrationRequests.map((item) => (
                  <p key={item.id}><span>{formatShortDate(item.created_at)}</span>{item.empresa_nombre} · {item.contacto}</p>
                ))}
              </article>
            </section>
          </div>
        )}

        {superadminSection === 'password' && (
          <div className="superadmin-section-view">
            <div className="superadmin-head">
              <h1>Contraseña</h1>
              <span className="status-pill">Seguridad</span>
            </div>
            <form className="superadmin-form superadmin-password-form" onSubmit={changeSuperadminPassword}>
              <label>
                Contraseña actual
                <div className="password-input-wrapper">
                  <input
                    type={showSuperadminCurrentPassword ? "text" : "password"}
                    value={passwordForm.current_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                    autoComplete="current-password"
                  />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowSuperadminCurrentPassword(!showSuperadminCurrentPassword)} tabIndex="-1" aria-label={showSuperadminCurrentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {showSuperadminCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label>
                Nueva contraseña
                <div className="password-input-wrapper">
                  <input
                    type={showSuperadminNewPassword ? "text" : "password"}
                    value={passwordForm.new_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
                    autoComplete="new-password"
                  />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowSuperadminNewPassword(!showSuperadminNewPassword)} tabIndex="-1" aria-label={showSuperadminNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {showSuperadminNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label>
                Confirmar nueva contraseña
                <div className="password-input-wrapper">
                  <input
                    type={showSuperadminConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirm_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
                    autoComplete="new-password"
                  />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowSuperadminConfirmPassword(!showSuperadminConfirmPassword)} tabIndex="-1" aria-label={showSuperadminConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {showSuperadminConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {passwordMessage && <small className="temp-password">{passwordMessage}</small>}
              <button className="primary-button" type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </form>
          </div>
        )}



        {superadminSection === 'companies' && (
          <>
        <div className="superadmin-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Empresas</h1>
            <span className="status-pill">{(tenants || []).filter((item) => item.activa).length} activas</span>
          </div>
          <button className="primary-button" type="button" onClick={() => setIsCreateModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Plus size={16} /> Crear empresa
          </button>
        </div>

        <div className="superadmin-controls">
          <label className="superadmin-search">
            <Search size={16} />
            <input value={tenantSearch} onChange={(event) => setTenantSearch(event.target.value)} placeholder="Buscar empresa, slug o subnombre" />
          </label>
          <div className="superadmin-filter-tabs">
            {[
              ['all', 'Todas'],
              ['active', 'Activas'],
              ['inactive', 'Suspendidas'],
              ['no-admins', 'Sin admins'],
              ['no-products', 'Sin productos']
            ].map(([id, label]) => (
              <button type="button" className={tenantFilter === id ? 'active' : ''} onClick={() => setTenantFilter(id)} key={id}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {!tenants && <Loading label="Cargando empresas" />}

        {tenants && (
          <div className="superadmin-grid">
            {filteredTenants.map((tenant) => {
              const readiness = tenantReadiness(tenant);
              return (
                <article className="tenant-card" key={tenant.id}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(17, 17, 17, 0.08)', 
                      background: 'var(--bg-input, #f3f4f6)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {tenant.logo_url ? (
                        <img 
                          src={resolveMediaUrl(tenant.logo_url)} 
                          alt={tenant.nombre} 
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        />
                      ) : (
                        <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase' }}>
                          {initials(tenant.nombre)}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '15px', color: 'var(--text-color)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.nombre}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.subnombre || 'Sin subnombre'}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px', fontFamily: 'monospace' }}>{tenant.slug}.catalogohn.com</span>
                    </div>
                    <b className={tenant.activa ? 'tenant-state on' : 'tenant-state off'} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                      {tenant.activa ? 'Activa' : 'Suspendida'}
                    </b>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>✉️ Correo:</span>
                    <span style={{ color: tenant.email_notificaciones ? 'var(--text-color)' : 'var(--text-muted)', fontStyle: tenant.email_notificaciones ? 'normal' : 'italic' }}>
                      {tenant.email_notificaciones || 'No configurado'}
                    </span>
                  </div>

                  <div className="tenant-card-stats" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', padding: '6px 0', borderTop: '1px dashed rgba(0,0,0,0.06)', borderBottom: '1px dashed rgba(0,0,0,0.06)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> {tenant.admin_count || 0} admins</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Package size={12} /> {tenant.product_count || 0} prod.</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ClipboardList size={12} /> {tenant.order_count || 0} ped.</span>
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      background: tenant.notificaciones_activas !== false ? 'rgba(32, 147, 95, 0.06)' : 'rgba(239, 61, 71, 0.06)',
                      color: tenant.notificaciones_activas !== false ? '#20935f' : '#ef3d47',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {tenant.notificaciones_activas !== false ? '🔔 Notif.' : '🔕 Inact.'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <strong>⚠️ {readiness.label}:</strong>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {readiness.checks.map((item) => (
                        <span 
                          key={item.key} 
                          style={{ 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '10px',
                            background: item.ready ? 'rgba(32, 147, 95, 0.06)' : 'rgba(239, 61, 71, 0.06)',
                            color: item.ready ? '#20935f' : '#ef3d47',
                            textDecoration: item.ready ? 'none' : 'line-through'
                          }}
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                    <button 
                      className="secondary-button" 
                      type="button" 
                      onClick={() => openConfig(tenant)}
                      style={{ width: '100%', justifyContent: 'center', height: '34px', gap: '6px', fontSize: '12px', fontWeight: '800' }}
                    >
                      <Settings2 size={14} /> Configuración
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredTenants.length === 0 && (
              <div className="admin-empty-state superadmin-empty">
                <strong>Sin resultados</strong>
                <span>Ajusta la búsqueda o cambia el filtro.</span>
              </div>
            )}
          </div>
        )}
          </>
        )}
        </section>
      </section>

      <section className="superadmin-footer">
        <strong>CatálogoHN</strong>
        <span>Control central de empresas</span>
      </section>

      {adminPanel && (
        <div className="superadmin-admins-backdrop" onClick={() => closeAdmins()}>
          <section className="superadmin-admins-modal" onClick={(event) => event.stopPropagation()}>
            <header className="superadmin-admins-head">
              <div>
                <strong>Admins</strong>
                <small>{adminPanel.tenant?.nombre || adminPanel.tenant?.slug}</small>
              </div>
              <button className="icon-button" type="button" onClick={closeAdmins} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>

            <form className="superadmin-admins-form" onSubmit={createAdmin}>
              <label>Nombre<input value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} placeholder="Administrador" /></label>
              <label>Usuario<input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="admin.empresa" /></label>
              <label>Contraseña temporal<input value="Se generará automáticamente" disabled /></label>
              <button className="primary-button" disabled={!adminNombre || !adminUsername}>
                Crear admin
              </button>
              {tempPassword && <small className="temp-password">Contraseña temporal: <b>{tempPassword}</b></small>}
            </form>

            {error && <small className="form-error">{error}</small>}

            <div className="superadmin-admins-list">
              {!adminPanel.admins && <Loading label="Cargando admins" />}
              {adminPanel.admins && adminPanel.admins.length === 0 && <small className="admin-empty">Sin admins aún.</small>}
              {adminPanel.admins && adminPanel.admins.map((admin) => (
                <div className="superadmin-admin-row" key={admin.id}>
                  <span>
                    <strong>{admin.nombre}</strong>
                    <small>@{admin.username || 'sin-usuario'}</small>
                    {tempPasswordsByAdmin[admin.id] && <small>Temporal: {tempPasswordsByAdmin[admin.id]}</small>}
                  </span>
                  <div className="superadmin-admin-actions">
                    <button type="button" onClick={() => startEditAdmin(admin)}>Editar</button>
                    <button type="button" onClick={() => removeAdmin(admin)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {editingAdmin && (
        <div className="superadmin-admins-backdrop superadmin-admin-editor-backdrop" onClick={cancelEditAdmin}>
          <section className="superadmin-admins-modal superadmin-admin-editor-modal" onClick={(event) => event.stopPropagation()}>
            <header className="superadmin-admins-head">
              <div>
                <strong>Editar admin</strong>
                <small>{adminPanel?.tenant?.nombre || adminPanel?.tenant?.slug || 'Empresa'}</small>
              </div>
              <button className="icon-button" type="button" onClick={cancelEditAdmin} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <form className="superadmin-admin-edit" onSubmit={(event) => {
              event.preventDefault();
              saveAdminChanges(editingAdmin);
            }}>
              <label>Nombre<input value={editAdminNombre} onChange={(e) => setEditAdminNombre(e.target.value)} /></label>
              <label>Usuario<input value={editAdminUsername} onChange={(e) => setEditAdminUsername(e.target.value)} /></label>
              <label>
                Nueva contraseña
                <div className="password-input-wrapper">
                  <input type={showEditAdminPassword ? "text" : "password"} value={editAdminPassword} onChange={(e) => setEditAdminPassword(e.target.value)} placeholder="Opcional" />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowEditAdminPassword(!showEditAdminPassword)} tabIndex="-1" aria-label={showEditAdminPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {showEditAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {tempPasswordsByAdmin[editingAdmin.id] && (
                <small className="temp-password">Contraseña temporal: <b>{tempPasswordsByAdmin[editingAdmin.id]}</b></small>
              )}
              {error && <small className="form-error">{error}</small>}
              <div className="superadmin-admin-edit-actions">
                <button type="submit" disabled={!editAdminNombre || !editAdminUsername}>Guardar cambios</button>
                <button type="button" onClick={() => generateAdminPassword(editingAdmin)}>Generar contraseña</button>
                <button type="button" onClick={cancelEditAdmin}>Cancelar</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingTenant && (
        <div className="superadmin-admins-backdrop superadmin-admin-editor-backdrop" onClick={cancelEditTenant}>
          <section className="superadmin-admins-modal superadmin-admin-editor-modal" style={{ maxWidth: '400px' }} onClick={(event) => event.stopPropagation()}>
            <header className="superadmin-admins-head">
              <div>
                <strong>Editar empresa</strong>
                <small>{editingTenant.slug}.catalogohn.com</small>
              </div>
              <button className="icon-button" type="button" onClick={cancelEditTenant} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <form className="superadmin-admin-edit" onSubmit={saveTenantNameChanges}>
              <label>
                Nombre comercial
                <input value={editTenantNombre} onChange={(e) => setEditTenantNombre(e.target.value)} required />
              </label>
              <label>
                Subnombre
                <input value={editTenantSubnombre} onChange={(e) => setEditTenantSubnombre(e.target.value)} placeholder="Subnombre o rubro" />
              </label>
              {error && <small className="form-error">{error}</small>}
              <div className="superadmin-admin-edit-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button type="submit" className="primary-button" disabled={saving || !editTenantNombre.trim()}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" className="secondary-button" onClick={cancelEditTenant}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="superadmin-admins-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <section className="superadmin-admins-modal" style={{ maxWidth: '450px', width: '90%' }} onClick={(event) => event.stopPropagation()}>
            <header className="superadmin-admins-head">
              <div>
                <strong>Crear nueva empresa</strong>
                <small>Registrar inquilino</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsCreateModalOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <form className="superadmin-admin-edit" onSubmit={createTenant}>
              <label>
                Nombre comercial
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </label>
              
              <section className="superadmin-subname-picker" style={{ border: '1px solid rgba(17, 17, 17, 0.08)', borderRadius: '9px', padding: '12px', background: 'rgba(0, 0, 0, 0.01)', margin: '15px 0' }}>
                <div className="superadmin-subname-picker-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span>
                    <strong>Subnombre</strong>
                    <small style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{subnombre || 'Selecciona una opción para la empresa'}</small>
                  </span>
                  {subnombre && (
                    <button type="button" className="secondary-button" style={{ height: '24px', padding: '0 8px', fontSize: '11px' }} onClick={() => handleSubnombreChange('')}>
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="superadmin-subname-options" style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', paddingRight: '4px' }}>
                  {subnombreOptions.map((option) => (
                    <div className={`${editingSubnombre === option ? 'superadmin-subname-option editing' : 'superadmin-subname-option'} ${subnombreSeleccionado === option ? 'active' : ''}`.trim()} key={option}>
                      {editingSubnombre === option ? (
                        <>
                          <input value={editSubnombreValue} onChange={(event) => setEditSubnombreValue(event.target.value)} style={{ padding: '2px', fontSize: '11px' }} />
                          <button type="button" onClick={saveSubnombreEdit}>Guardar</button>
                          <button type="button" onClick={cancelSubnombreEdit}>Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="subname-select-button" onClick={() => handleSubnombreChange(option)}>
                            {option}
                          </button>
                          <button type="button" onClick={() => startEditSubnombre(option)}>Editar</button>
                          <button type="button" className="danger-subname-button" onClick={() => deleteSubnombre(option)}>Eliminar</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="superadmin-subname-add">
                  <input value={nuevoSubnombre} onChange={(e) => setNuevoSubnombre(e.target.value)} placeholder="Agregar nuevo subnombre" />
                  <button type="button" className="secondary-button" onClick={agregarSubnombre} disabled={!nuevoSubnombre.trim()}>
                    Agregar
                  </button>
                </div>
              </section>

              <small className="superadmin-hint">Subdominio: <b>{subdominioPreview}.catalogohn.com</b></small>
              {error && <small className="form-error">{error}</small>}
              <div className="superadmin-admin-edit-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
                <button className="primary-button" type="submit" disabled={saving || !nombre} style={{ whiteSpace: 'nowrap' }}>
                  {saving ? 'Creando...' : 'Crear empresa'}
                </button>
                <button className="secondary-button" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedTenantOptions && (
        <div className="admin-modal-backdrop modal-centered" onClick={() => setSelectedTenantOptions(null)}>
          <section className="admin-modal" style={{ maxWidth: '460px', width: '95%', borderRadius: '12px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <header style={{ padding: '16px 20px', borderBottom: '1px solid rgba(17,17,17,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Configuración de la empresa</h2>
              <button onClick={() => setSelectedTenantOptions(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}><X size={18} /></button>
            </header>

            <div style={{ textAlign: 'center', margin: '14px 0', borderBottom: '1px dashed rgba(17,17,17,0.08)', paddingBottom: '12px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--text-color)' }}>{selectedTenantOptions.nombre}</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>{selectedTenantOptions.slug}.catalogohn.com</div>
            </div>

            <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(17,17,17,0.08)', marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                ✉️ Correo de notificaciones
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input 
                  type="email" 
                  value={configEmail} 
                  onChange={(e) => setConfigEmail(e.target.value)} 
                  placeholder="Ej. correo@empresa.com" 
                  style={{ flex: 1, height: '36px', padding: '0 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid rgba(17,17,17,0.1)', background: 'var(--bg-input)' }} 
                />
                <button 
                  type="button" 
                  className="primary-button" 
                  onClick={() => editTenantEmailDirect(selectedTenantOptions.id, configEmail)}
                  style={{ height: '36px', minHeight: '36px', padding: '0 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Guardar
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0 20px 20px' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ height: '38px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 12px' }}
                onClick={() => {
                  openTenantAdmin(selectedTenantOptions);
                  setSelectedTenantOptions(null);
                }}
              >
                <ExternalLink size={14} /> Abrir Portal
              </button>

              <button
                type="button"
                className="secondary-button"
                style={{ height: '38px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 12px' }}
                onClick={() => {
                  copyTenantLink(selectedTenantOptions);
                  setSelectedTenantOptions(null);
                }}
              >
                <Copy size={14} /> Copiar Link
              </button>

              <button
                type="button"
                className="secondary-button"
                style={{ height: '38px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 12px' }}
                onClick={() => {
                  openAdmins(selectedTenantOptions);
                  setSelectedTenantOptions(null);
                }}
              >
                <Users size={14} /> Admins
              </button>

              <button
                type="button"
                className="secondary-button"
                style={{ height: '38px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 12px' }}
                onClick={() => {
                  editTenantName(selectedTenantOptions);
                  setSelectedTenantOptions(null);
                }}
              >
                <Edit2 size={14} /> Editar Nombre
              </button>

              <button
                type="button"
                className="secondary-button"
                style={{ height: '38px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 12px' }}
                onClick={() => {
                  toggleTenantNotifications(selectedTenantOptions);
                  setSelectedTenantOptions(null);
                }}
              >
                {selectedTenantOptions.notificaciones_activas !== false ? <BellOff size={14} /> : <Bell size={14} />}
                {selectedTenantOptions.notificaciones_activas !== false ? 'Silenciar Notif.' : 'Activar Notif.'}
              </button>

              <button
                type="button"
                className="secondary-button"
                style={{ height: '38px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 12px' }}
                onClick={() => {
                  requestTenantStatusChange(selectedTenantOptions);
                  setSelectedTenantOptions(null);
                }}
              >
                {selectedTenantOptions.activa ? <UserX size={14} /> : <UserCheck size={14} />}
                {selectedTenantOptions.activa ? 'Desactivar' : 'Activar'}
              </button>

              <button
                type="button"
                className="primary-button"
                style={{ gridColumn: 'span 2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '38px', background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)', marginTop: '8px', fontSize: '12px', fontWeight: '800', gap: '6px' }}
                onClick={() => {
                  requestTenantDelete(selectedTenantOptions);
                  setSelectedTenantOptions(null);
                }}
              >
                <Trash2 size={14} /> Borrar Empresa
              </button>
            </div>
          </section>
        </div>
      )}

      {tenantConfirm && (
        <ConfirmModal
          title={tenantConfirm.title}
          onCancel={() => {
            setTenantConfirm(null);
            setTenantDeleteInput('');
          }}
          onConfirm={confirmTenantAction}
          confirmLabel={tenantConfirm.confirmLabel}
          cancelLabel="Cancelar"
          disabled={tenantConfirm.type === 'delete' && tenantDeleteInput.trim().toLowerCase() !== tenantConfirm.tenant.slug}
        >
          <>
            {tenantConfirm.message}
            {tenantConfirm.type === 'delete' && (
              <label className="confirm-inline-field">
                Confirmación
                <input value={tenantDeleteInput} onChange={(event) => setTenantDeleteInput(event.target.value)} placeholder={tenantConfirm.tenant.slug} />
              </label>
            )}
          </>
        </ConfirmModal>
      )}

      {adminConfirm && (
        <ConfirmModal
          title="Eliminar admin"
          onCancel={() => setAdminConfirm(null)}
          onConfirm={confirmRemoveAdmin}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
        >
          {`Quieres eliminar el admin "${adminConfirm.username || adminConfirm.nombre}"?`}
        </ConfirmModal>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Loading({ label }) {
  return <div className="loading"><Menu className="spin" size={24} />{label}</div>;
}

function ConfirmModal({ title, children, onCancel, onConfirm, confirmLabel, cancelLabel = 'Revisar', disabled = false }) {
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <Check size={28} />
        <h2>{title}</h2>
        <div className="modal-message">{children}</div>
        <div>
          <button className="secondary-button" onClick={onCancel}>{cancelLabel}</button>
          <button className="primary-button" onClick={onConfirm} disabled={disabled}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3);
}

function tenantBrandStyle(tenant = {}) {
  const primary = tenant.color_primario || '#f0f0f0';
  const secondary = tenant.color_secundario || '#111111';
  const fuente = tenant.fuente || 'Aptos';
  return {
    '--yellow': primary,
    '--tenant-primary': primary,
    '--tenant-secondary': secondary,
    fontFamily: `"${fuente}", "Aptos", "Segoe UI", sans-serif`
  };
}

function categoryOrbStyle(category = {}) {
  const color = category.color || '#d7dbe3';
  return {
    '--category-accent': color,
    background: `linear-gradient(180deg, ${withAlpha(color, 0.22)}, rgba(255, 255, 255, 0.92))`,
    borderColor: withAlpha(color, 0.34)
  };
}

function categoryPanelStyle(category = {}) {
  const color = category.color || '#d7dbe3';
  return {
    '--category-accent': color
  };
}

function categoryBadgeStyle(category = {}) {
  const color = category.color || '#d7dbe3';
  return {
    '--category-accent': color,
    borderColor: withAlpha(color, 0.34),
    background: withAlpha(color, 0.12)
  };
}

function slugifyValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function withAlpha(hex, alpha) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return `rgba(215, 219, 227, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function flattenCart(cart, data) {
  if (!data) return [];
  return Object.entries(cart).flatMap(([productId, branches]) => {
    const product = data.productos.find((item) => Number(item.id) === Number(productId));
    if (!product) return [];
    const lines = Object.entries(branches).map(([branchId, cantidad]) => {
      const branch = data.sucursales.find((item) => Number(item.id) === Number(branchId));
      return {
        producto_id: product.id,
        sucursal_id: Number(branchId),
        sku: product.sku,
        descripcion: product.descripcion,
        imagen: cleanProductImages(product.imagenes)[0],
        sucursal: branch?.nombre || 'Sucursal',
        cantidad: cantidad === '' ? '' : Number(cantidad),
        precio_unitario: Number(product.precio_final || product.precio || 0)
      };
    });
    return lines.sort((a, b) => Number(a.sucursal_id || 0) - Number(b.sucursal_id || 0));
  });
}

createRoot(document.getElementById('root')).render(<App />);


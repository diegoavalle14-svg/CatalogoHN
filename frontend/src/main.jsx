import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, BadgeDollarSign, Building2, Check, ClipboardList, Copy, ExternalLink, Folder, LogOut, Menu, Moon, MoreVertical, Package, PackageSearch, Plus, Search, Settings2, ShoppingCart, Sun, Tags, Users, X } from 'lucide-react';
import { API_PUBLIC_ORIGIN, api } from './lib/api';
import { bootstrapSessionFromUrl, clearCart, clearSession, clearTemporarySession, clearUiState, loadCart, loadSession, loadUiState, saveCart, saveSession, updateUiState } from './lib/storage';
import './styles.css';

const money = (value) => `L. ${Number(value || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;
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
    return <Admin session={session} onLogout={logout} onRestoreSuperadmin={session?.impersonated_from?.user?.rol === 'superadmin' ? () => {
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
      const userChanged = user && ['nombre', 'username', 'email', 'condicion_credito', 'cliente_activo']
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
  const tenant = session.tenant || {};

  useEffect(() => {
    const updateCartCount = (event) => setCartCount(event.detail?.count || 0);
    window.addEventListener('catalog:cart-count', updateCartCount);
    return () => window.removeEventListener('catalog:cart-count', updateCartCount);
  }, []);

  function openCart() {
    if (view !== 'catalog') {
      setView('catalog');
      window.setTimeout(() => window.dispatchEvent(new Event('catalog:open-cart')), 0);
      return;
    }
    window.dispatchEvent(new Event('catalog:open-cart'));
  }

  return (
    <div className="app-shell" style={tenantBrandStyle(tenant)}>
      <header className="topbar">
        <button className="brand-lockup" onClick={() => setView('catalog')} aria-label="Abrir catálogo">
          <TenantLogoMark tenant={tenant} />
          <span>
            <strong>{tenant.nombre || 'Empresa'}</strong>
            <small>{tenant.subnombre || 'Catálogo privado'}</small>
          </span>
        </button>

        <div className="welcome-line">
          <span>Bienvenido,</span>
          <b>{session.user.nombre}</b>
        </div>

        <div className="topbar-actions">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <button className="orders-button" onClick={() => setView('history')}>
            <ClipboardList size={14} />
            <span>Mis Pedidos</span>
          </button>
          <button className="checkout-button" onClick={openCart}>
            <ShoppingCart size={18} />
            <span>Ver Pedido</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
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
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState('kolben');
  const [selectedTenantName, setSelectedTenantName] = useState('');
  const [superadminMode, setSuperadminMode] = useState(false);
  const [tenantTiles, setTenantTiles] = useState([]);
  const [requestForm, setRequestForm] = useState({ empresa_nombre: '', contacto: '', email: '', telefono: '', rubro: '', mensaje: '' });
  const [requestStatus, setRequestStatus] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestSaving, setRequestSaving] = useState(false);

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

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onLogin(await api.login({ username, password, tenantSlug: superadminMode ? 'kolben' : selectedTenant }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegistrationRequest(event) {
    event.preventDefault();
    setRequestSaving(true);
    setRequestError('');
    setRequestStatus('');
    try {
      await api.createRegistrationRequest(requestForm);
      setRequestStatus('Solicitud enviada. Te contactaremos para revisar el alta de la empresa.');
      setRequestForm({ empresa_nombre: '', contacto: '', email: '', telefono: '', rubro: '', mensaje: '' });
    } catch (err) {
      setRequestError(err.message || 'No se pudo enviar la solicitud');
    } finally {
      setRequestSaving(false);
    }
  }

  function updateRequestField(field, value) {
    setRequestForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="login-screen">
      <div className="welcome-float" aria-live="polite">Bienvenido. Tu acceso sigue siendo privado para cada empresa.</div>
      <header className="login-header">
        <strong>CatálogoHN</strong>
        <div className="login-header-actions">
          <span>Catálogos mayoristas privados</span>
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
      </header>

      <section className="tenant-picker">
        <div className="public-hero">
          <div>
            <span className="hero-kicker">Acceso privado para empresas</span>
            <h1>CatálogoHN</h1>
            <p>Selecciona la empresa con la que trabajas para entrar a su catálogo y realizar pedidos.</p>
          </div>
        </div>

        <div className="public-section-head">
          <div>
            <h2>Empresas activas</h2>
            <p>Selecciona una empresa para ingresar a su catálogo privado.</p>
          </div>
          <span className="status-pill">
            <strong>{tenantTiles.length}</strong>
            <span>activas</span>
          </span>
        </div>
        <div className="tenant-grid">
          {tenantTiles.map((tenant) => (
            <button
              className={`tenant-tile ${tenant.available ? 'active' : 'disabled'}`}
              key={tenant.slug}
              style={tenantBrandStyle(tenant)}
              onClick={() => {
                setSelectedTenant(tenant.slug);
                setSelectedTenantName(tenant.name);
                setSuperadminMode(false);
                setLoginOpen(true);
              }}
              aria-label={`Seleccionar ${tenant.name}`}
            >
              <span className="tenant-tile-status">{tenant.status}</span>
              <TenantLogoMark tenant={{ nombre: tenant.name, logo_url: tenant.logo_url }} size="small" />
              <strong className="tenant-tile-name">{tenant.name}</strong>
              {tenant.sector && <small className="tenant-tile-meta">{tenant.sector}</small>}
              <em className="tenant-tile-domain">{tenant.domain}</em>
            </button>
          ))}
        </div>

        <button
          className="secondary-button superadmin-login-button"
          onClick={() => {
            setSuperadminMode(true);
            setUsername('');
            setPassword('');
            setLoginOpen(true);
          }}
        >
          Superadministrador
        </button>

        <div className="tenant-footer">
          <p>¿Eres una empresa distribuidora?</p>
          <strong>Solicita el alta desde este formulario.</strong>
        </div>

        <form className="registration-request-form" onSubmit={submitRegistrationRequest}>
          <div className="registration-request-head">
            <Building2 size={18} />
            <div>
              <strong>Solicitud de registro</strong>
              <small>Para distribuidoras que quieren publicar su catálogo privado en CatálogoHN.</small>
            </div>
          </div>
          <div className="registration-request-grid">
            <label>Empresa<input value={requestForm.empresa_nombre} onChange={(event) => updateRequestField('empresa_nombre', event.target.value)} /></label>
            <label>Contacto<input value={requestForm.contacto} onChange={(event) => updateRequestField('contacto', event.target.value)} /></label>
            <label>Correo<input type="email" value={requestForm.email} onChange={(event) => updateRequestField('email', event.target.value)} /></label>
            <label>Teléfono<input value={requestForm.telefono} onChange={(event) => updateRequestField('telefono', event.target.value)} /></label>
            <label>Rubro<input value={requestForm.rubro} onChange={(event) => updateRequestField('rubro', event.target.value)} placeholder="Repuestos, ferretería, suministros..." /></label>
              <label>Mensaje<textarea value={requestForm.mensaje} onChange={(event) => updateRequestField('mensaje', event.target.value)} rows={3} /></label>
          </div>
          {requestError && <small className="form-error">{requestError}</small>}
          {requestStatus && <small className="form-success">{requestStatus}</small>}
          <button className="primary-button" disabled={requestSaving || !requestForm.empresa_nombre || !requestForm.contacto || (!requestForm.email && !requestForm.telefono)}>
            {requestSaving ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      </section>

      {loginOpen && (
        <div className="login-modal-backdrop" onClick={() => !loading && setLoginOpen(false)}>
          <section className="login-modal" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-head">
              <h2>{superadminMode ? 'Ingreso superadministrador' : `Ingreso ${selectedTenantName}`}</h2>
              <button className="icon-button" onClick={() => !loading && setLoginOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <p>{superadminMode ? 'Acceso exclusivo de plataforma' : `Acceso privado de ${selectedTenantName}`}</p>
            <form onSubmit={submit} className="login-modal-form">
              <label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
              <label>Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
              {error && <small className="form-error">{error}</small>}
              <button className="forgot-password-button" type="button" onClick={() => window.alert('Recuperación de contraseña: próximamente')}>
                ¿Olvidaste la contraseña?
              </button>
              <button className="primary-button" disabled={loading}>
                {loading ? 'Validando...' : 'Ingresar'}
              </button>
            </form>
          </section>
        </div>
      )}

      <footer className="login-page-footer">
        <span>Honduras</span>
        <a href="mailto:contacto@catalogohn.com">contacto@catalogohn.com</a>
        <span>Soporte y registro de empresas</span>
      </footer>
    </main>
  );
}

function Catalog({ session, onSessionUpdated }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState(() => loadCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSent, setOrderSent] = useState(null);
  const [toast, setToast] = useState('');

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

  useEffect(() => saveCart(cart), [cart]);

  const products = useMemo(() => {
    if (!data) return [];
    return data.productos.filter((product) => {
      const haystack = `${product.sku} ${product.descripcion} ${product.marca} ${product.categoria}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesCategory = category === 'all' || Number(product.categoria_id) === Number(category);
      return matchesQuery && matchesCategory;
    });
  }, [data, query, category]);
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
  const total = lines.reduce((sum, line) => sum + line.cantidad * line.precio_unitario, 0);
  const cartCount = lines.reduce((sum, line) => sum + line.cantidad, 0);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('catalog:cart-count', { detail: { count: cartCount } }));
  }, [cartCount]);

  useEffect(() => {
    const openCart = () => setCartOpen(true);
    window.addEventListener('catalog:open-cart', openCart);
    return () => window.removeEventListener('catalog:open-cart', openCart);
  }, []);

  function updateQty(product, branchId, qty) {
    setCart((current) => {
      const key = String(product.id);
      const nextProduct = { ...(current[key] || {}) };
      const value = Math.max(0, Number(qty) || 0);
      if (value === 0) delete nextProduct[branchId];
      else nextProduct[branchId] = value;

      const next = { ...current };
      if (Object.keys(nextProduct).length === 0) delete next[key];
      else next[key] = nextProduct;
      return next;
    });
  }

  function addProductQty(product, branchId, qty) {
    updateQty(product, branchId, qty);
    setToast('Producto agregado al pedido');
    window.clearTimeout(addProductQty.toastTimer);
    addProductQty.toastTimer = window.setTimeout(() => setToast(''), 2200);
  }

  async function sendOrder() {
    setSending(true);
    setOrderError('');
    try {
      const payload = await api.createOrder(session.token, lines);
      clearCart();
      setCart({});
      setConfirming(false);
      setCartOpen(false);
      setOrderSent(payload.pedido);
    } catch (error) {
      setOrderError(error.message || 'No se pudo enviar el pedido');
    } finally {
      setSending(false);
    }
  }

  if (!data) return <Loading label="Cargando catálogo" />;

  return (
    <section className="catalog-page">
      <div className="catalog-hero-panel">
        <div className="customer-welcome">
          <span>Catálogo privado</span>
          <strong>{session.user.nombre}</strong>
          <small>{session.tenant?.nombre || 'Empresa'} mantiene este inventario actualizado para tus compras.</small>
        </div>
        <div className="catalog-hero-stats" aria-label="Resumen del catálogo">
          <span><b>{catalogStats.total}</b> productos</span>
          <span><b>{catalogStats.available}</b> disponibles</span>
          <span><b>{catalogStats.promos}</b> promos</span>
          <span><b>{catalogStats.categories}</b> categorías</span>
        </div>
      </div>

      <div className="search-box">
        <Search size={18} />
        <input placeholder="Buscar por codigo, marca o categoria..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <CategoryFilterStrip categories={data.categorias || []} value={category} onChange={setCategory} />

      <div className="product-count-row">
        <p className="product-count">{products.length} productos</p>
        {(query || category !== 'all') && (
          <button type="button" onClick={() => {
            setQuery('');
            setCategory('all');
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
              branches={withBranchLetters(data.sucursales)}
              quantities={cart[product.id] || {}}
              onQty={updateQty}
              onAdd={addProductQty}
            />
          ))}
        </div>
      )}

      {toast && <div className="catalog-toast">{toast}</div>}

      {cartOpen && (
        <CartPanel
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
        />
      )}

      {orderSent && (
        <ConfirmModal title="Pedido enviado" onCancel={() => setOrderSent(null)} onConfirm={() => setOrderSent(null)} confirmLabel="Listo" cancelLabel="Cerrar">
          {orderSent.numero ? `Se registro el pedido ${orderSent.numero}.` : 'Se registro el pedido correctamente.'}
        </ConfirmModal>
      )}
    </section>
  );
}

function ProductCard({ product, categoryMeta, branches, quantities, onQty, onAdd }) {
  const availableBranches = Array.isArray(branches) ? branches : [];
  const [drafts, setDrafts] = useState({});
  const currentPrice = Number(product.precio_final || product.precio || 0);
  const oldPrice = Number(product.precio || 0);
  const productImages = cleanProductImages(product.imagenes);
  const stock = stockMeta(product);
  const isOutOfStock = stock.tone === 'out';
  const canOrder = availableBranches.length > 0 && !isOutOfStock;

  function draftFor(branchId) {
    return drafts[branchId] || 1;
  }

  function setDraft(branchId, value) {
    const next = Math.max(1, Number(value) || 1);
    setDrafts((current) => ({
      ...current,
      [branchId]: stock.stock > 0 ? Math.min(next, stock.stock) : 1
    }));
  }

  function stepDraft(branchId, delta) {
    setDraft(branchId, Number(draftFor(branchId) || 1) + delta);
  }

  function addBranch(branchId) {
    if (!canOrder) return;
    const draft = draftFor(branchId);
    const nextQty = Number(quantities[branchId] || 0) + Number(draft || 1);
    onAdd(product, branchId, nextQty);
  }

  return (
    <article className="product-card">
      {product.en_promocion && <span className="promo-ribbon">PROMO</span>}
      <div className="product-image">
        {productImages[0] ? (
          <img src={productImages[0]} alt={product.descripcion} />
        ) : (
          <DefaultProductArtwork product={product} categoryMeta={categoryMeta} />
        )}
        <CategoryImageBadge category={categoryMeta} label={product.categoria || categoryMeta?.nombre || 'Categoría'} />
      </div>
      <div className="product-body">
        <div className="sku-stock-line">
          <span className="sku-code">{product.sku}</span>
          <span className={`stock-pill ${stock.tone}`}>{stock.label}</span>
        </div>
        <span className="product-category-badge" style={categoryBadgeStyle(categoryMeta)}>{product.categoria || categoryMeta?.nombre || 'Sin categoría'}</span>
        <h3>{product.specs?.aplicacion || product.descripcion}</h3>
        <p>{product.descripcion}</p>
        <p>{product.specs?.medida}</p>
        <div className="price-line">
          {product.en_promocion && oldPrice > currentPrice && <span>{money(oldPrice)}</span>}
          <b className={product.en_promocion ? 'promo-price' : ''}>{money(currentPrice)}</b>
        </div>
      </div>
      <div className="branch-qty">
        {availableBranches.length === 0 && (
          <div className="product-cart-control no-branches">
            <button className="add-to-cart-button" type="button" disabled>
              Sin sucursal
            </button>
          </div>
        )}
        {availableBranches.map((branch) => {
          const branchId = branch.id;
          const draft = draftFor(branchId);
          const branchLabel = branch.letra || branch.codigo || branch.nombre || 'Sucursal';
          const branchTitle = [branchLabel, branch.nombre, branch.direccion].filter(Boolean).join(' · ');
          return (
            <div className="product-cart-control" key={branchId}>
              <span className="branch-code" title={branchTitle}>{branchLabel}</span>
              <div className="quantity-stepper" aria-label={`Cantidad para ${product.sku} en ${branchLabel}`}>
                <button type="button" onClick={() => stepDraft(branchId, -1)} disabled={!canOrder || Number(draft || 1) <= 1} aria-label={`Restar cantidad para ${branchLabel}`}>-</button>
                <input
                  type="number"
                  min="1"
                  max={stock.stock > 0 ? stock.stock : undefined}
                  inputMode="numeric"
                  value={draft || 1}
                  disabled={!canOrder}
                  onChange={(event) => setDraft(branchId, event.target.value)}
                  aria-label={`Cantidad para ${branchLabel}`}
                />
                <button type="button" onClick={() => stepDraft(branchId, 1)} disabled={!canOrder || (stock.stock > 0 && Number(draft || 1) >= stock.stock)} aria-label={`Sumar cantidad para ${branchLabel}`}>+</button>
              </div>
              <button className="add-to-cart-button" type="button" onClick={() => addBranch(branchId)} disabled={!canOrder}>
                {isOutOfStock ? 'Agotado' : '+ Agregar'}
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function CategoryImageBadge({ category, label }) {
  const image = category?.imagen_url ? resolveMediaUrl(category.imagen_url) : '';
  return (
    <span className="product-category-logo" style={categoryBadgeStyle(category)} title={label} aria-label={label}>
      {image ? <img src={image} alt="" /> : <Folder size={16} strokeWidth={2.4} />}
    </span>
  );
}

function CartPanel({ lines, total, confirming, sending, orderError, onClose, onRemove, onQty, onConfirm, onReview, onSend }) {
  const isv = total * 0.15;
  const grandTotal = total + isv;

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
          {lines.map((line) => (
            <div className="cart-line" key={`${line.producto_id}-${line.sucursal_id}`}>
              <ProductImageThumb images={line.imagen ? [line.imagen] : []} />
              <div className="cart-line-main">
                <span className="cart-sku">{line.sku}</span>
                <strong className="cart-line-title">{line.descripcion}</strong>
                <small className="cart-branch-label">Sucursal: {line.sucursal}</small>
                <label>
                  Cant.
                  <input
                    type="number"
                    min="1"
                    value={line.cantidad}
                    onChange={(event) => onQty({ id: line.producto_id }, line.sucursal_id, event.target.value)}
                  />
                </label>
                <strong className="cart-line-total">{money(line.precio_unitario * line.cantidad)}</strong>
              </div>
              <button className="cart-remove-button" onClick={() => onRemove({ id: line.producto_id }, line.sucursal_id, 0)} aria-label="Quitar producto">
                <X size={18} />
              </button>
            </div>
          ))}
        </div>

        <footer className="cart-footer">
          <div><span>Subtotal</span><b>{money(total)}</b></div>
          <div><span>ISV 15%</span><b>{money(isv)}</b></div>
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
    </div>
  );
}

function History({ session }) {
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api.setTenantSlug(session?.tenant?.slug || 'kolben');
    api.orders(session.token).then((payload) => setOrders(payload.pedidos)).catch(console.error);
  }, [session.token, session?.tenant?.slug]);

  if (!orders) return <Loading label="Cargando historial" />;

  return (
    <section className="list-page">
      <h1>Historial de pedidos</h1>
      {orders.map((order) => (
        <article className="order-card" key={order.id}>
          <div className="order-head">
            <div><strong>{order.numero}</strong><span>{new Date(order.fecha).toLocaleString('es-HN')}</span></div>
            <b>{order.estado}</b>
          </div>
          {order.items?.map((item) => (
            <p key={`${item.producto_id}-${item.sucursal_id}`}>{item.sku} · {item.sucursal || 'Sucursal'} · {item.cantidad}</p>
          ))}
          <strong>{money(order.total)}</strong>
        </article>
      ))}
    </section>
  );
}

function Admin({ session, onLogout, onRestoreSuperadmin, onTenantUpdated, theme, onThemeToggle }) {
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
  const [editor, setEditor] = useState(null);
  const [liveTenantDraft, setLiveTenantDraft] = useState(null);
  const adminHeaderRef = useRef(null);
  const [adminHeaderSpace, setAdminHeaderSpace] = useState(116);

  useEffect(() => {
    let cancelled = false;
    const applyCatalogPayload = (payload) => {
      if (cancelled) return;
      setCatalog(payload);
      setProducts(payload.productos.map((product, index) => ({ ...product, posicion: product.posicion || index + 1, visible: product.visible !== false })));
      setBrands(payload.marcas || []);
      setCategories(payload.categorias || []);
    };
    const loadOrders = () => {
      api.orders(session.token).then((payload) => {
        if (!cancelled) setOrders(payload.pedidos);
      }).catch(console.error);
    };
    const loadCatalog = () => {
      api.adminCatalog(session.token).then(applyCatalogPayload).catch(console.error);
    };

    api.setTenantSlug(tenantSlug);
    api.adminSummary(session.token).then(setSummary).catch(console.error);
    loadOrders();
    api.adminClients(session.token).then((payload) => setClients((payload.clientes || []).map(normalizeAdminClient))).catch(() => setClients([]));
    api.adminPrices(session.token).then((payload) => setPriceData(normalizeAdminPriceData(payload))).catch(() => setPriceData(normalizeAdminPriceData({ listas: [], productos: [] })));
    loadCatalog();

    const ordersTimer = window.setInterval(loadOrders, 5000);
    const catalogTimer = window.setInterval(loadCatalog, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(ordersTimer);
      window.clearInterval(catalogTimer);
    };
  }, [session.token, tenantSlug]);

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
    const optimistic = { ...currentProduct, ...changes };
    setProducts((current) => current.map((product) => (product.id === id ? optimistic : product)));
    try {
      const saved = await api.adminSaveProduct(session.token, changes.id ? changes : { ...changes, id });
      setProducts((current) => current.map((product) => (product.id === id ? normalizeAdminProduct(saved.producto, brands, categories) : product)));
    } catch (error) {
      setProducts(previousProducts);
      window.alert(error.message || 'No se pudo guardar el producto');
    }
  }

  async function saveProduct(payload) {
    let uploadedImageUrl = null;
    if (payload.imageFile) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.imageFile, 'product');
        uploadedImageUrl = upload.url;
      } catch (error) {
        window.alert(error.message || 'No se pudo subir la imagen');
        return;
      }
    }
    const nextPayload = prepareProductPayload(
      {
        ...payload,
        imageFile: undefined,
        imagenes: uploadedImageUrl ? [uploadedImageUrl] : payload.imagenes
      },
      products,
      brands,
      categories
    );
    try {
      const saved = await api.adminSaveProduct(session.token, nextPayload);
      const product = normalizeAdminProduct(saved.producto, brands, categories);
      setProducts((current) => (nextPayload.id ? current.map((item) => (item.id === nextPayload.id ? product : item)) : [product, ...current]));
      setEditor(null);
    } catch (error) {
      window.alert(error.message || 'No se pudo guardar el producto');
      return;
    } finally {
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
      if (saved.password_changed) window.alert('Contraseña del cliente actualizada correctamente.');
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

  async function updateOrderState(id, estado) {
    const ok = window.confirm(`Confirmar cambio a "${stateLabel(estado)}"`) && window.confirm('Segunda confirmación requerida');
    if (!ok) return;
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
      setProducts(catalogPayload.productos.map((product, index) => ({ ...product, posicion: product.posicion || index + 1, visible: product.visible !== false })));
      setBrands(catalogPayload.marcas || []);
      setCategories(catalogPayload.categorias || []);
    } catch (error) {
      setOrders(previous);
      window.alert(error.message || 'No se pudo cambiar el estado del pedido');
    }
  }

  async function deleteProduct(product) {
    const ok = window.confirm(`Eliminar producto ${product.sku || product.descripcion}?`) && window.confirm('Segunda confirmación requerida');
    if (!ok) return;
    const previousProducts = products;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    try {
      await api.adminDeleteProduct(session.token, product.id);
      const latestPrices = await api.adminPrices(session.token);
      setPriceData(normalizeAdminPriceData(latestPrices));
    } catch (error) {
      setProducts(previousProducts);
      window.alert(error.message || 'No se pudo eliminar el producto');
    }
  }

  async function deleteClient(client) {
    const ok = window.confirm(`Eliminar cliente ${client.nombre}?`) && window.confirm('Segunda confirmación requerida');
    if (!ok) return;
    const previousClients = clients;
    setClients((current) => current.filter((item) => item.id !== client.id));
    try {
      await api.adminDeleteClient(session.token, client.id);
      const latestPrices = await api.adminPrices(session.token);
      setPriceData(normalizeAdminPriceData(latestPrices));
    } catch (error) {
      setClients(previousClients);
      window.alert(error.message || 'No se pudo eliminar el cliente');
    }
  }

  async function deleteOrder(id) {
    const ok = window.confirm('Confirmar eliminación del pedido') && window.confirm('Segunda confirmación requerida');
    if (!ok) return;
    const previous = orders;
    setOrders((current) => current.filter((order) => order.id !== id));
    try {
      await api.deleteOrder(session.token, id);
    } catch {
      setOrders(previous);
    }
  }

  async function saveBrand(payload) {
    let logoUrl = payload.logo_url || '';
    if (payload.logoFile) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.logoFile, 'brand');
        logoUrl = upload.url;
      } catch (error) {
        window.alert(error.message || 'No se pudo subir el logo');
        return;
      }
    }
    const nextPayload = { ...payload, logoFile: undefined, logo_url: logoUrl };
    try {
      const saved = await api.adminSaveBrand(session.token, nextPayload);
      setBrands((current) => (nextPayload.id ? current.map((item) => (item.id === nextPayload.id ? saved.marca : item)) : [saved.marca, ...current]));
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
    let imageUrl = payload.imagen_url || '';
    if (payload.imageFile) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.imageFile, 'category');
        imageUrl = upload.url;
      } catch (error) {
        window.alert(error.message || 'No se pudo subir la imagen de la categoría');
        return;
      }
    }
    const nextPayload = { ...payload, imageFile: undefined, imagen_url: imageUrl };
    try {
      const saved = await api.adminSaveCategory(session.token, nextPayload);
      setCategories((current) => (nextPayload.id ? current.map((item) => (item.id === nextPayload.id ? saved.categoria : item)) : [saved.categoria, ...current]));
    } catch (error) {
      window.alert(error.message || 'No se pudo guardar la categoria');
    }
  }

  async function deleteBrand(id) {
    try {
      await api.adminDeleteBrand(session.token, id);
      setBrands((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      window.alert(error.message || 'No se pudo eliminar la marca');
    }
  }

  async function deleteCategory(id) {
    try {
      await api.adminDeleteCategory(session.token, id);
      setCategories((current) => current.filter((item) => item.id !== id));
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
      <header className="admin-mobile-topbar admin-mobile-topbar-fixed" ref={adminHeaderRef}>
        <button className="admin-brand-button" onClick={() => setEditor({ type: 'site', title: 'Configuración del sitio', value: liveTenant })}>
          <TenantLogoMark tenant={liveTenant} size="small" />
          <span><strong>{liveTenant?.nombre || 'Empresa'}</strong><small>{liveTenant?.subnombre || 'Panel Admin'}</small></span>
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
            onEdit={(client) => setEditor({ type: 'client', title: 'Editar cliente', value: client })}
            onToggle={toggleClient}
            onDelete={deleteClient}
          />
        )}

        {tab === 'prices' && (
          <AdminPricesSection
            lists={priceLists}
            products={priceProducts}
            clients={clients}
            onEditPrices={(client) => {
              const list = priceLists.find((item) => Number(item.id) === Number(client.lista_precio_id));
              setEditor({
                type: 'price-list',
                title: `Precios: ${client.nombre}`,
                value: {
                  ...(list || {}),
                  nombre: list?.nombre || `Precios - ${client.nombre}`,
                  client,
                  client_id: client.id
                }
              });
            }}
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
        />
      )}
    </div>
  );
}


function AdminOrdersSection({ orders, pending, preparing, sentToday, clients = [], onState, onDelete }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      <div className="admin-stat-grid">
        <AdminStat value={pending} label="Pendientes" tone="orange" />
        <AdminStat value={preparing} label="Preparando" tone="blue" />
        <AdminStat value={sentToday} label="Enviados hoy" tone="green" />
        <AdminStat value={orders.length} label="Pedidos" helper="total preview" />
      </div>
      <div className={`admin-priority-strip ${pending > 0 ? 'warning' : preparing > 0 ? 'active' : 'clear'}`}>
        <Activity size={17} />
        <span>
          <strong>{urgentLabel}</strong>
          <small>{urgentCopy}</small>
        </span>
      </div>
      <div className="admin-filter-bar">
        <label className="admin-search-inline">
          <Search size={15} />
          <input placeholder="Buscar pedido o cliente" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
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
        {filteredOrders.map((order) => (
          <article className="admin-order-card" key={order.id}>
            <div className="admin-order-card-head">
              <div className="admin-order-main">
              <span>Pedido</span>
              <strong>{order.cliente_nombre || 'Cliente mayorista'}</strong>
              <small>{order.fecha_label || new Date(order.fecha).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })} · {money(order.total)}</small>
            </div>
              <b className={`admin-state ${order.estado}`}>{stateLabel(order.estado)}</b>
            </div>
            <footer>
              <span className="admin-ticket">{order.numero}</span>
              {order.estado !== 'preparando' && order.estado !== 'enviado' && <button className="pill-blue" onClick={() => onState(order.id, 'preparando')}>Preparando</button>}
              {order.estado !== 'enviado' && <button className="pill-green" onClick={() => onState(order.id, 'enviado')}>Enviado</button>}
              <button className="pill-red" onClick={() => onDelete(order.id)}>Eliminar</button>
            </footer>
          </article>
        ))}
      </div>
      <h2 className="admin-small-heading">Ranking de clientes</h2>
      <div className="admin-ranking-card">
        <div><span>Cliente</span><span>Lista</span><span>Credito</span><span>Estado</span><span>Acceso</span></div>
        {clients.length === 0 && <p className="admin-empty-inline">Sin clientes creados todavia.</p>}
        {clients.slice(0, 5).map((client) => (
          <button key={client.id}>
            <strong>{client.nombre}</strong>
            <b>{client.lista || 'Sin lista'}</b><b>{client.credito}</b><b>{client.activo ? 'Activo' : 'Inactivo'}</b><span>{client.acceso_corto || client.acceso}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function AdminCatalogSection({ products, brands, categories, onNew, onProductEdit, onToggle, onPosition, onDelete, onBrands, onCategories }) {
  const [query, setQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (products || []).filter((product) => {
      const matchesVisibility = visibilityFilter === 'all'
        || (visibilityFilter === 'visible' && product.visible !== false)
        || (visibilityFilter === 'hidden' && product.visible === false);
      const haystack = `${product.sku || ''} ${product.descripcion || ''} ${product.marca || ''} ${product.categoria || ''}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesVisibility && matchesQuery;
    });
  }, [products, query, visibilityFilter]);
  return (
    <>
      <div className="admin-title-row">
        <AdminSectionTitle title="Catálogo" subtitle="Productos activos e inactivos" />
        <div>
          <button onClick={onBrands}><Tags size={13} /> Marcas</button>
          <button onClick={onCategories}><Folder size={13} /> Categorías</button>
          <button className="admin-new-button" onClick={onNew}><Plus size={13} /> Nuevo</button>
        </div>
      </div>
      <div className="admin-filter-bar">
        <label className="admin-search-inline">
          <Search size={15} />
          <input placeholder="Buscar sku, marca o categoria" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
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
        <small className="admin-results-count">{filteredProducts.length} productos</small>
      </div>
      <div className="admin-product-list">
        {filteredProducts.map((product) => (
          <article className={product.visible ? 'admin-product-row' : 'admin-product-row muted'} key={product.id}>
            <div className="admin-product-top">
              <ProductImageThumb images={product.imagenes} />
              <div>
                <span className="sku-code">{product.sku}</span>
                <small>{product.marca} · {product.specs?.aplicacion || product.descripcion}</small>
                <ProductStockPill product={product} className="admin-stock-badge" />
              </div>
              <div className="admin-row-actions">
                <button onClick={() => onProductEdit(product)}>Editar</button>
                <button className="danger-icon-button" onClick={() => onDelete(product)}>Eliminar</button>
              </div>
            </div>
            <footer>
              <label>Pos.<input value={product.posicion || 1} onChange={(event) => onPosition(product, Number(event.target.value) || 1)} /></label>
              <label className="switch-line">{product.visible ? 'Visible' : 'Oculto'}<input type="checkbox" checked={product.visible} onChange={() => onToggle(product)} /><span /></label>
            </footer>
          </article>
        ))}
      </div>
      <small className="admin-muted-note">{brands.length} marcas · {categories.length} categorias</small>
    </>
  );
}

function AdminClientsSection({ clients, onNew, onEdit, onToggle, onDelete }) {
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
        <label className="admin-search-inline">
          <Search size={15} />
          <input placeholder="Buscar cliente o usuario" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
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
          <button className="admin-client-row" key={client.id} onClick={() => onEdit(client)}>
            <span className={client.activo ? 'client-avatar' : 'client-avatar off'}>{client.iniciales}</span>
            <span>
              <strong>{client.nombre}</strong>
              <small>{client.usuario} · {client.lista} · {client.credito} · {client.tipo}</small>
              <small>{client.acceso}</small>
            </span>
            <span className="admin-client-actions">
              <b onClick={(event) => { event.stopPropagation(); onToggle(client); }} className={client.activo ? 'client-state on' : 'client-state'}>{client.activo ? 'Activo' : 'Inactivo'}</b>
              <span role="button" tabIndex={0} className="danger-icon-button" onClick={(event) => { event.stopPropagation(); onDelete(client); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onDelete(client); } }}>Eliminar</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function AdminPricesSection({ lists, products, clients, onEditPrices, onSyncList, onSyncAll }) {
  const [query, setQuery] = useState('');
  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (clients || []).filter((client) => {
      const list = (lists || []).find((item) => Number(item.id) === Number(client.lista_precio_id));
      const haystack = `${client.nombre || ''} ${client.usuario || ''} ${client.lista || ''} ${list?.nombre || ''}`.toLowerCase();
      return !normalizedQuery || haystack.includes(normalizedQuery);
    });
  }, [clients, lists, query]);
  const totalAssignedClients = (lists || []).reduce((sum, list) => sum + Number(list.clientes || 0), 0);
  const totalMissingPrices = (lists || []).reduce((sum, list) => sum + Number(list.productos_faltantes || 0), 0);
  return (
    <>
      <div className="admin-title-row">
        <AdminSectionTitle title="Precios por cliente" subtitle="Visibilidad, precio normal y oferta por usuario" />
        <div>
          {totalMissingPrices > 0 && (
            <button className="admin-sync-prices-button" onClick={onSyncAll}>
              <Check size={13} /> Sincronizar todo
            </button>
          )}
        </div>
      </div>
      <div className="admin-price-health">
        <article><strong>{products.length}</strong><span>productos base</span></article>
        <article><strong>{totalAssignedClients}/{clients.length}</strong><span>clientes asignados</span></article>
        <article className={totalMissingPrices > 0 ? 'needs-sync' : ''}><strong>{totalMissingPrices}</strong><span>precios faltantes</span></article>
      </div>
      <div className="admin-filter-bar">
        <label className="admin-search-inline">
          <Search size={15} />
          <input placeholder="Buscar cliente o usuario" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <small className="admin-results-count">{filteredClients.length} clientes</small>
      </div>
      <div className="admin-price-groups">
        {filteredClients.map((client) => {
          const list = (lists || []).find((item) => Number(item.id) === Number(client.lista_precio_id)) || { precios: [], clientes_asignados: [] };
          const filledPrices = list.precios?.filter((price) => Number(price.precio) > 0) || [];
          const promoCount = filledPrices.filter((price) => price.precio_promocion).length;
          const missing = Number(list.productos_faltantes ?? Math.max(0, products.length - (list.precios || []).length));
          const coverage = products.length ? Math.round((filledPrices.length / products.length) * 100) : 0;
          const hiddenCount = (list.precios || []).filter((price) => price.visible_cliente === false).length;
          return (
            <article className={`admin-price-group ${missing > 0 ? 'needs-sync' : ''}`} key={client.id}>
              <header>
                <span>
                  <strong>{client.nombre}</strong>
                  <small>{client.usuario} · {list.nombre || 'Sin precios configurados'}</small>
                </span>
                <b className={client.activo ? 'price-ok' : 'price-warning'}>{client.activo ? 'Activo' : 'Inactivo'}</b>
              </header>

              <div className="price-progress" aria-label={`${coverage}% configurado`}>
                <span style={{ width: `${coverage}%` }} />
              </div>

              <div className="admin-price-group-metrics">
                <span><strong>{filledPrices.length}/{products.length}</strong> productos</span>
                <span><strong>{promoCount}</strong> ofertas</span>
                <span><strong>{hiddenCount}</strong> ocultos</span>
              </div>

              <footer>
                <button className="primary-price-action" type="button" onClick={() => onEditPrices(client)}>Editar productos</button>
                {list.id && missing > 0 && <button type="button" onClick={() => onSyncList(list)}>Sincronizar</button>}
              </footer>
            </article>
          );
        })}
        {filteredClients.length === 0 && (
          <div className="admin-empty-state">
            <strong>No hay clientes</strong>
            <span>Crea clientes para configurar visibilidad y precios por usuario.</span>
          </div>
        )}
      </div>
    </>
  );
}

function CategoryFilterStrip({ categories = [], value, onChange, className = '' }) {
  if (!categories.length) return null;
  return (
    <section className={`brand-section category-section ${className}`.trim()} aria-label="Categorías">
      <div className="brand-section-head">
        <h2>Categorías</h2>
        <button type="button" onClick={() => onChange('all')}>Ver todas</button>
      </div>

      <div className="brand-strip">
        <button className={value === 'all' ? 'brand-chip active' : 'brand-chip'} onClick={() => onChange('all')} aria-label="Todas las categorías" title="Todas">
          <span className="brand-orb all-brand-icon all-category-orb" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="brand-label">Todas</span>
        </button>
        {categories.map((item) => (
          <button className={Number(value) === item.id ? 'brand-chip active' : 'brand-chip'} onClick={() => onChange(item.id)} key={item.id} aria-label={item.nombre} title={item.nombre}>
            <span className="brand-orb category-orb" style={categoryOrbStyle(item)}>
              {item.imagen_url ? <img src={resolveMediaUrl(item.imagen_url)} alt="" /> : <Folder size={22} strokeWidth={2.4} />}
            </span>
            <span className="brand-label">{item.nombre}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductImageThumb({ images }) {
  const image = cleanProductImages(images)[0];
  if (image) return <img src={image} alt="" />;
  return (
    <span className="product-thumb-fallback" aria-hidden="true">
      <PackageSearch size={20} strokeWidth={1.8} />
    </span>
  );
}

function DefaultProductArtwork({ product, categoryMeta }) {
  if (categoryMeta?.imagen_url) {
    return (
      <div className="default-product-artwork category-image-artwork">
        <img src={resolveMediaUrl(categoryMeta.imagen_url)} alt="" />
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

function AdminCustomerPreview({ tenant, products, clients = [], priceLists = [], categories }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [clientId, setClientId] = useState(() => clients[0]?.id || '');
  const selectedClient = clients.find((client) => Number(client.id) === Number(clientId));
  const selectedList = priceLists.find((list) => Number(list.id) === Number(selectedClient?.lista_precio_id));
  const visibleProducts = useMemo(() => {
    return (products || []).filter((product) => {
      if (product.visible === false) return false;
      const haystack = `${product.sku} ${product.descripcion} ${product.marca} ${product.categoria} ${product.specs?.aplicacion || ''}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesCategory = category === 'all' || Number(product.categoria_id) === Number(category);
      return matchesQuery && matchesCategory;
    });
  }, [products, query, category]);
  const previewProducts = useMemo(() => {
    return visibleProducts.flatMap((product) => {
      const price = selectedList?.precios?.find((item) => Number(item.producto_id) === Number(product.id));
      if (price?.visible_cliente === false) return [];
      if (!price) return [product];
      return [{
        ...product,
        precio: Number(price.precio || 0),
        precio_promocion: price.precio_promocion,
        precio_final: Number(price.precio_promocion || price.precio || 0)
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
      <div className="admin-preview-head">
        <TenantLogoMark tenant={tenant} size="small" />
        <span>
          <strong>{tenant?.nombre || 'Empresa'}</strong>
          <small>{tenant?.subnombre || 'Catálogo privado'}</small>
        </span>
      </div>

      <AdminSectionTitle title="Vista cliente" subtitle="Previsualización de productos visibles" />

      <div className="admin-preview-client-picker">
        <label>
          Cliente
          <select value={clientId || ''} onChange={(event) => setClientId(Number(event.target.value) || '')}>
            {clients.length === 0 && <option value="">Sin clientes</option>}
            {clients.map((client) => <option value={client.id} key={client.id}>{client.nombre}</option>)}
          </select>
        </label>
        <span>
          <strong>{selectedList?.nombre || 'Sin lista asignada'}</strong>
          <small>{selectedClient ? `${selectedClient.usuario} · ${selectedClient.credito}` : 'Crea o asigna un cliente para validar precios'}</small>
        </span>
      </div>

      <div className="search-box admin-preview-search">
        <Search size={18} />
        <input placeholder="Buscar por codigo, marca o categoria..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <CategoryFilterStrip categories={categories || []} value={category} onChange={setCategory} className="admin-preview-brands" />

      <p className="product-count">{previewProducts.length} productos visibles</p>

      {previewProducts.length === 0 ? (
        <div className="admin-empty-state">
          <strong>No hay productos visibles</strong>
          <span>Los productos aparecerán aquí cuando estén agregados y marcados como visibles.</span>
        </div>
      ) : (
        <div className="product-grid admin-preview-grid">
          {previewProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryMeta={(categories || []).find((item) => Number(item.id) === Number(product.categoria_id))}
              branches={previewBranches}
              quantities={{}}
              onQty={() => {}}
              onAdd={() => {}}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AdminPreviewProductCard({ product, categoryMeta }) {
  const productImages = cleanProductImages(product.imagenes);
  const currentPrice = Number(product.precio_final || product.precio || 0);
  const oldPrice = Number(product.precio || 0);
  return (
    <article className="admin-preview-product-card">
      <div className="admin-preview-product-image">
        {productImages[0] ? (
          <img src={productImages[0]} alt={product.descripcion} />
        ) : (
          <DefaultProductArtwork product={product} categoryMeta={categoryMeta} />
        )}
        <CategoryImageBadge category={categoryMeta} label={product.categoria || categoryMeta?.nombre || 'Categoría'} />
      </div>
      <div className="admin-preview-product-body">
        <div className="sku-stock-line">
          <span className="sku-code">{product.sku}</span>
          <ProductStockPill product={product} />
        </div>
        <strong>{product.specs?.aplicacion || product.descripcion}</strong>
        <small>{product.descripcion}</small>
        <small>{product.specs?.medida || product.categoria || 'Producto visible'}</small>
        <div className="price-line">
          {product.en_promocion && oldPrice > currentPrice && <span>{money(oldPrice)}</span>}
          <b className={product.en_promocion ? 'promo-price' : ''}>{money(currentPrice)}</b>
        </div>
      </div>
    </article>
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
    <section className="admin-site-preview" style={tenantBrandStyle(tenant)}>
      <div className="admin-site-preview-light">
        <header>
          <TenantLogoMark tenant={tenant} size="small" />
          <span>
            <strong>{tenant?.nombre || 'Nombre de empresa'}</strong>
            <small>{tenant?.subnombre || 'Subnombre del catálogo'}</small>
          </span>
        </header>
        <div>
          <span>Catálogo privado</span>
          <strong>Productos destacados</strong>
          <button type="button">Ver pedido</button>
        </div>
      </div>
      <div className="admin-site-preview-dark">
        <span>Modo oscuro</span>
        <strong>{tenant?.nombre || 'Empresa'}</strong>
        <small>Vista cliente con fondo oscuro</small>
      </div>
    </section>
  );
}

function AdminEditor({ editor, brands, categories, priceLists, priceProducts, clients, onClose, onSaveProduct, onSaveClient, onSavePrice, onSaveBrand, onSaveCategory, onSaveSite, onSiteDraftChange, onSaveAccountPassword, onDeleteBrand, onDeleteCategory }) {
  const [form, setForm] = useState(() => buildAdminEditorForm(editor));
  const [previewLogoUrl, setPreviewLogoUrl] = useState('');
  const [formFeedback, setFormFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const [branchDraft, setBranchDraft] = useState({ nombre: '', direccion: '' });
  const [customSubnameMode, setCustomSubnameMode] = useState(() => Boolean(editor.value?.subnombre && !SITE_SUBNAME_OPTIONS.includes(editor.value.subnombre)));
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
    setFormFeedback(null);
    setForm((current) => ({
      ...current,
      sucursales: clean,
      sucursales_text: clean.map((branch) => `${branch.nombre}${branch.direccion ? ` | ${branch.direccion}` : ''}`).join('\n')
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

  return (
    <div className="admin-modal-backdrop">
      <section className="admin-modal">
        <header><h2>{editor.title}</h2><button onClick={onClose}><X size={18} /></button></header>

        {editor.type === 'site' && (
          <>
            <AdminSitePreview tenant={sitePreviewTenant} />
            <div className="admin-form admin-site-form">
              <label>Nombre comercial<input value={form.nombre || ''} onChange={(event) => update('nombre', event.target.value)} /></label>
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
              {customSubnameMode && (
                <label>Nuevo subnombre<input value={form.subnombre || ''} onChange={(event) => update('subnombre', event.target.value)} /></label>
              )}
              <label>
                Fuente
                <select value={form.fuente || 'Aptos'} onChange={(event) => update('fuente', event.target.value)}>
                  {SITE_FONT_OPTIONS.map((font) => <option value={font.value} key={font.value}>{font.label}</option>)}
                </select>
              </label>
              <label className="admin-logo-upload">
                Logo de la empresa
                <span>
                  <TenantLogoMark tenant={sitePreviewTenant} />
                  <em>{sitePreviewTenant.logo_url ? 'Cambiar logo' : 'Logo'}</em>
                </span>
                <input type="file" accept="image/*" onChange={(event) => update('logoFile', event.target.files?.[0])} />
              </label>
              <div className="admin-color-grid">
                <label>Color primario<input type="color" value={form.color_primario || '#F5C200'} onChange={(event) => update('color_primario', event.target.value)} /></label>
                <label>Color secundario<input type="color" value={form.color_secundario || '#111111'} onChange={(event) => update('color_secundario', event.target.value)} /></label>
              </div>
            </div>
          </>
        )}

        {editor.type === 'product' && (
          <div className="admin-form">
            <label>Código<input value={form.sku || ''} onChange={(event) => update('sku', event.target.value)} /></label>
            <label>Descripción<input value={form.descripcion || ''} onChange={(event) => update('descripcion', event.target.value)} /></label>
            <label>Aplicación<input value={form.specs?.aplicacion || ''} onChange={(event) => update('specs', { ...(form.specs || {}), aplicacion: event.target.value })} /></label>
            <label>Medida<input value={form.specs?.medida || ''} onChange={(event) => update('specs', { ...(form.specs || {}), medida: event.target.value })} /></label>
            <label>Marca<select value={form.marca_id || brands[0]?.id || ''} onChange={(event) => update('marca_id', Number(event.target.value))}>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.nombre}</option>)}</select></label>
            <label>Categoría<select value={form.categoria_id || categories[0]?.id || ''} onChange={(event) => update('categoria_id', Number(event.target.value))}>{categories.map((category) => <option value={category.id} key={category.id}>{category.nombre}</option>)}</select></label>
            <label>Precio<input type="number" value={form.precio || ''} onChange={(event) => update('precio', Number(event.target.value))} /></label>
            <label>Stock actual<input type="number" min="0" step="1" value={form.stock_actual ?? ''} onChange={(event) => update('stock_actual', event.target.value)} /></label>
            <label>Stock mínimo<input type="number" min="0" step="1" value={form.stock_minimo ?? ''} onChange={(event) => update('stock_minimo', event.target.value)} /></label>
            <label>Imagenes<input type="file" accept="image/*" onChange={(event) => update('imageFile', event.target.files?.[0])} /></label>
          </div>
        )}

        {editor.type === 'client' && (
          <div className="admin-form">
            <label>Nombre<input value={form.nombre || ''} onChange={(event) => update('nombre', event.target.value)} /></label>
            <label>Usuario<input value={form.username || form.usuario || ''} onChange={(event) => update('username', event.target.value)} /></label>
            <label>{form.id ? 'Nueva contraseña' : 'Contraseña inicial'}<input type="password" placeholder={form.id ? 'Dejar igual' : 'Asignar contraseña'} value={form.password || ''} onChange={(event) => update('password', event.target.value)} autoComplete="new-password" /></label>
            <label>Lista<select value={form.lista_precio_id || ''} onChange={(event) => update('lista_precio_id', Number(event.target.value) || '')}>
              <option value="">Sin lista</option>
              {priceLists.map((list) => <option value={list.id} key={list.id}>{list.nombre}</option>)}
            </select></label>
            <label>Credito<input value={form.condicion_credito || form.credito || ''} onChange={(event) => update('condicion_credito', event.target.value)} /></label>
            <label>Estado<select value={form.activo === false ? 'inactivo' : 'activo'} onChange={(event) => update('activo', event.target.value === 'activo')}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select></label>
            <section className="client-branches-editor">
              <div className="client-branches-head">
                <strong>Sucursales</strong>
                <small>{clientBranches.length ? `${clientBranches.length} configuradas` : 'Agrega al menos una sucursal para pedidos'}</small>
              </div>
              <div className="client-branch-quick">
                {['A', 'B', 'C', 'D', 'E'].map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => addClientBranch({ nombre: name, direccion: '' })}
                    disabled={clientBranches.some((branch) => String(branch.nombre).toUpperCase() === name)}
                  >
                    {name}
                  </button>
                ))}
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
                {clientBranches.map((branch, index) => (
                  <div className="client-branch-row" key={branch.id || `${branch.nombre}-${index}`}>
                    <span className="client-branch-letter">{String.fromCharCode(65 + index)}</span>
                    <input value={branch.nombre || ''} onChange={(event) => updateClientBranch(index, 'nombre', event.target.value)} aria-label="Sucursal" />
                    <input value={branch.direccion || ''} onChange={(event) => updateClientBranch(index, 'direccion', event.target.value)} aria-label="Dirección" placeholder="Dirección opcional" />
                    <button type="button" onClick={() => removeClientBranch(index)} aria-label={`Quitar ${branch.nombre}`}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </section>
            {formFeedback && <small className={formFeedback.type === 'success' ? 'form-success' : 'form-error'}>{formFeedback.message}</small>}
          </div>
        )}

        {editor.type === 'account-password' && (
          <div className="admin-form">
            <label>Contraseña actual<input type="password" value={form.current_password || ''} onChange={(event) => update('current_password', event.target.value)} /></label>
            <label>Nueva contraseña<input type="password" value={form.new_password || ''} onChange={(event) => update('new_password', event.target.value)} /></label>
            <label>Confirmar nueva contraseña<input type="password" value={form.confirm_password || ''} onChange={(event) => update('confirm_password', event.target.value)} /></label>
            {formFeedback && <small className={formFeedback.type === 'success' ? 'form-success' : 'form-error'}>{formFeedback.message}</small>}
          </div>
        )}

        {editor.type === 'price-list' && (
          <div className="admin-form admin-price-list-crud">
            <input type="hidden" value={form.nombre || ''} readOnly />
            {editor.value?.client && (
              <section className="admin-price-client-picker fixed-client">
                <h3>Cliente</h3>
                <label>
                  <input type="checkbox" checked readOnly />
                  <span>
                    <strong>{editor.value.client.nombre}</strong>
                    <small>{editor.value.client.usuario} · {editor.value.client.credito}</small>
                  </span>
                </label>
              </section>
            )}
            <section className="admin-price-list-products">
              <h3>Productos disponibles</h3>
              <small className="admin-price-list-note">Activa la visibilidad para este cliente y configura precio normal u oferta por producto.</small>
              {groupPriceProductsByCategory(priceProducts).map((group) => (
                <section className="admin-price-category-group" key={group.category}>
                  <h3>{group.category}</h3>
                  {group.items.map((product) => (
                    <div className="admin-price-editor-row" key={product.id}>
                      <span><strong>{product.sku}</strong><small>{product.marca} · {product.descripcion}</small><ProductStockPill product={product} /></span>
                      <label className="price-visible-toggle"><input type="checkbox" checked={form[`visible_${product.id}`] !== false} onChange={(event) => update(`visible_${product.id}`, event.target.checked)} /> Visible</label>
                      <label>Precio<input type="number" value={form[`precio_${product.id}`] || ''} onChange={(event) => update(`precio_${product.id}`, event.target.value)} /></label>
                      <label>Precio oferta<input type="number" value={form[`promo_${product.id}`] || ''} onChange={(event) => update(`promo_${product.id}`, event.target.value)} /></label>
                    </div>
                  ))}
                </section>
              ))}
            </section>
          </div>
        )}

        {editor.type === 'price' && (
          <div className="admin-form admin-price-editor">
            {groupPriceProductsByCategory(priceProducts).map((group) => (
              <section className="admin-price-category-group" key={group.category}>
                <h3>{group.category}</h3>
                {group.items.map((product) => (
                  <div className="admin-price-editor-row" key={product.id}>
                    <span><strong>{product.sku}</strong><small>{product.marca} · {product.descripcion}</small><ProductStockPill product={product} /></span>
                    <label>Precio<input type="number" value={form[`precio_${product.id}`] || ''} onChange={(event) => update(`precio_${product.id}`, event.target.value)} /></label>
                    <label>Precio oferta<input type="number" value={form[`promo_${product.id}`] || ''} onChange={(event) => update(`promo_${product.id}`, event.target.value)} /></label>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}

        {editor.type === 'brands' && <AdminEntityCrud items={brands} label="Marca" onSave={onSaveBrand} onDelete={onDeleteBrand} />}
        {editor.type === 'categories' && <AdminEntityCrud items={categories} label="Categoría" onSave={onSaveCategory} onDelete={onDeleteCategory} />}

        {!['brands', 'categories'].includes(editor.type) && (
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
  return (
    <div className="admin-entity-crud">
      <div className="admin-form">
        <label>{label}<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        {supportsImage && <label>{label === 'Marca' ? 'Logo' : 'Imagen'}<input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0])} /></label>}
        <button className="primary-button" onClick={() => { if (!name) return; onSave({ nombre: name, [label === 'Marca' ? 'logoFile' : 'imageFile']: logoFile }); setName(''); setLogoFile(null); }}>Agregar</button>
      </div>
      {items.map((item) => (
        <div className="admin-entity-row" key={item.id}>
          {supportsImage && (
            <span className="admin-entity-thumb">
              {item[imageField] ? <img src={resolveMediaUrl(item[imageField])} alt="" /> : <Folder size={16} />}
            </span>
          )}
          <strong>{item.nombre}</strong>
          <button onClick={() => onSave({ ...item, nombre: window.prompt(`Editar ${label}`, item.nombre) || item.nombre })}>Editar</button>
          {supportsImage && <button onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) onSave({ ...item, [label === 'Marca' ? 'logoFile' : 'imageFile']: file });
            };
            input.click();
          }}>Imagen</button>}
          <button onClick={() => onDelete(item.id)}>Eliminar</button>
        </div>
      ))}
    </div>
  );
}

function stateLabel(state) {
  return ({ pendiente: 'Pendiente', preparando: 'Preparando', enviado: 'Enviado' })[state] || state;
}

function prepareProductPayload(product, products, brands, categories) {
  const productImages = cleanProductImages(product.imagenes);
  return normalizeAdminProduct(
    {
      ...product,
      marca_id: product.marca_id || brands[0]?.id || null,
      categoria_id: product.categoria_id || categories[0]?.id || null,
      visible: product.visible !== false,
      posicion: product.posicion || (products.length + 1),
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

function buildAdminEditorForm(editor) {
  const form = { ...editor.value };
  if (editor.type === 'price' || editor.type === 'price-list') {
    for (const price of editor.value.precios || []) {
      form[`precio_${price.producto_id}`] = price.precio ?? '';
      form[`promo_${price.producto_id}`] = price.precio_promocion ?? '';
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
    form.sucursales_text = form.sucursales_text || (form.sucursales || []).map((branch) => `${branch.nombre}${branch.direccion ? ` | ${branch.direccion}` : ''}`).join('\n');
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
    username: String(client.username || client.usuario || client.email || '').trim().toLowerCase(),
    email: client.email && !String(client.email).endsWith('@cliente.local') ? String(client.email).trim().toLowerCase() : undefined,
    password: String(client.password || '').trim() || undefined,
    condicion_credito: String(client.condicion_credito || client.credito || 'Contado').trim(),
    activo: client.activo !== false,
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
  return uniqueBranches(Array.isArray(branches) ? branches : []).map((branch, index) => ({
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
  const [tempPassword, setTempPassword] = useState('');
  const [tempPasswordsByAdmin, setTempPasswordsByAdmin] = useState({});
  const [toast, setToast] = useState('');
  const [openTenantMenu, setOpenTenantMenu] = useState(null);
  const [tenantConfirm, setTenantConfirm] = useState(null);
  const [tenantDeleteInput, setTenantDeleteInput] = useState('');
  const [adminConfirm, setAdminConfirm] = useState(null);
  const [superadminSection, setSuperadminSection] = useState('companies');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
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
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
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
      showToast(`Empresa ${created.tenant?.nombre || nombre} creada correctamente`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function requestTenantStatusChange(tenant) {
    const action = tenant.activa ? 'desactivar' : 'activar';
    setOpenTenantMenu(null);
    setTenantConfirm({
      type: 'status',
      tenant,
      title: tenant.activa ? 'Desactivar empresa' : 'Activar empresa',
      message: `Quieres ${action} la empresa "${tenant.nombre}"?`,
      confirmLabel: tenant.activa ? 'Desactivar' : 'Activar'
    });
  }

  function requestTenantDelete(tenant) {
    setOpenTenantMenu(null);
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
              ['companies', 'Empresas'],
              ['stats', 'Estadísticas'],
              ['history', 'Historiales'],
              ['subnames', 'Subnombres']
            ].map(([id, label]) => (
              <button key={id} type="button" className={superadminSection === id ? 'active' : ''} onClick={() => { setSuperadminSection(id); setSidebarOpen(false); }}>
                {label}
              </button>
            ))}
          </div>
          <div className="superadmin-sidebar-bottom">
            <button type="button" className={superadminSection === 'password' ? 'active' : ''} onClick={() => { setSuperadminSection('password'); setSidebarOpen(false); }}>
              Cambiar contraseña
            </button>
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
                {activity.map((item) => (
                  <p key={item.id}><span>{formatShortDate(item.created_at)}</span>{item.descripcion}</p>
                ))}
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
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                  autoComplete="current-password"
                />
              </label>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirmar nueva contraseña
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
                  autoComplete="new-password"
                />
              </label>
              {passwordMessage && <small className="temp-password">{passwordMessage}</small>}
              <button className="primary-button" type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </form>
          </div>
        )}

        {superadminSection === 'subnames' && (
          <div className="superadmin-section-view">
            <div className="superadmin-head">
              <h1>Subnombres</h1>
              <span className="status-pill">{subnombreOptions.length} opciones</span>
            </div>
            <div className="superadmin-subnames-panel">
              <div className="superadmin-subname-add">
                <input value={nuevoSubnombre} onChange={(e) => setNuevoSubnombre(e.target.value)} placeholder="Nuevo subnombre" />
                <button type="button" className="secondary-button" onClick={agregarSubnombre} disabled={!nuevoSubnombre.trim()}>
                  Agregar
                </button>
              </div>
              <div className="superadmin-subname-list">
                {subnombreOptions.map((option) => (
                  <div className="superadmin-subname-row" key={option}>
                    {editingSubnombre === option ? (
                      <>
                        <input value={editSubnombreValue} onChange={(event) => setEditSubnombreValue(event.target.value)} />
                        <button type="button" onClick={saveSubnombreEdit} disabled={!editSubnombreValue.trim()}>
                          Guardar
                        </button>
                        <button type="button" onClick={cancelSubnombreEdit}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span>{option}</span>
                        <button type="button" onClick={() => startEditSubnombre(option)}>
                          Editar
                        </button>
                        <button type="button" className="danger-subname-button" onClick={() => deleteSubnombre(option)}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {superadminSection === 'companies' && (
          <>
        <div className="superadmin-head">
          <h1>Empresas</h1>
          <span className="status-pill">{(tenants || []).filter((item) => item.activa).length} activas</span>
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

        <form className="superadmin-form superadmin-create-form" onSubmit={createTenant}>
          <label>Nombre comercial<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <section className="superadmin-subname-picker">
            <div className="superadmin-subname-picker-head">
              <span>
                <strong>Subnombre</strong>
                <small>{subnombre || 'Selecciona una opción para la empresa'}</small>
              </span>
              {subnombre && (
                <button type="button" onClick={() => handleSubnombreChange('')}>
                  Limpiar
                </button>
              )}
            </div>

            <div className="superadmin-subname-options">
              {subnombreOptions.map((option) => (
                <div className={`${editingSubnombre === option ? 'superadmin-subname-option editing' : 'superadmin-subname-option'} ${subnombreSeleccionado === option ? 'active' : ''}`.trim()} key={option}>
                  {editingSubnombre === option ? (
                    <>
                      <input value={editSubnombreValue} onChange={(event) => setEditSubnombreValue(event.target.value)} />
                      <button type="button" onClick={saveSubnombreEdit} disabled={!editSubnombreValue.trim()}>Guardar</button>
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
          <button className="primary-button" disabled={saving || !nombre}>{saving ? 'Creando...' : 'Crear empresa'}</button>
        </form>

        {!tenants && <Loading label="Cargando empresas" />}

        {tenants && (
          <div className="superadmin-grid">
            {filteredTenants.map((tenant) => {
              const readiness = tenantReadiness(tenant);
              return (
                <article className="tenant-card" key={tenant.id}>
                  <div className="tenant-card-head">
                    <strong>{tenant.slug}.catalogohn.com</strong>
                    <b className={tenant.activa ? 'tenant-state on' : 'tenant-state off'}>{tenant.activa ? 'Activa' : 'Suspendida'}</b>
                  </div>
                  <p>{tenant.nombre}</p>
                  <small>{tenant.subnombre || 'Sin subnombre configurado'}</small>
                  <div className="tenant-card-stats">
                    <span><Users size={13} />{tenant.admin_count || 0} admins</span>
                    <span><Package size={13} />{tenant.product_count || 0} productos</span>
                    <span><ClipboardList size={13} />{tenant.order_count || 0} pedidos</span>
                  </div>
                  <div className="tenant-readiness">
                    <strong>{readiness.label}</strong>
                    <div>
                      {readiness.checks.map((item) => (
                        <span className={item.ready ? 'ready' : ''} key={item.key}>{item.label}</span>
                      ))}
                    </div>
                  </div>
                  <div className="tenant-card-actions">
                    <button className="secondary-button" type="button" onClick={() => openAdmins(tenant)}>
                      <Users size={14} /> Admins
                    </button>
                    <button className="secondary-button" type="button" onClick={() => copyTenantLink(tenant)}>
                      <Copy size={14} /> Link
                    </button>
                    <button className="secondary-button" type="button" onClick={() => openTenantAdmin(tenant)}>
                      <ExternalLink size={14} /> Abrir
                    </button>
                    <div className="tenant-options">
                      <button
                        className="secondary-button tenant-options-button"
                        type="button"
                        onClick={() => setOpenTenantMenu((current) => (current === tenant.id ? null : tenant.id))}
                        aria-label={`Opciones de ${tenant.nombre}`}
                      >
                        <MoreVertical size={16} />
                        Opciones
                      </button>
                      {openTenantMenu === tenant.id && (
                        <div className="tenant-options-menu">
                          <button type="button" onClick={() => requestTenantStatusChange(tenant)}>
                            {tenant.activa ? 'Desactivar empresa' : 'Activar empresa'}
                          </button>
                          <button type="button" className="danger-option" onClick={() => requestTenantDelete(tenant)}>
                            Borrar empresa
                          </button>
                        </div>
                      )}
                    </div>
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
              <label>Nueva contraseña<input type="password" value={editAdminPassword} onChange={(e) => setEditAdminPassword(e.target.value)} placeholder="Opcional" /></label>
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
    return Object.entries(branches).map(([branchId, cantidad]) => {
      const branch = data.sucursales.find((item) => Number(item.id) === Number(branchId));
      return {
        producto_id: product.id,
        sucursal_id: Number(branchId),
        sku: product.sku,
        descripcion: product.descripcion,
        imagen: cleanProductImages(product.imagenes)[0],
        sucursal: branch?.nombre || 'Sucursal',
        cantidad: Number(cantidad),
        precio_unitario: Number(product.precio_final || product.precio || 0)
      };
    });
  });
}

createRoot(document.getElementById('root')).render(<App />);

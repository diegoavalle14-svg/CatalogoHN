import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BadgeDollarSign, Check, ClipboardList, Folder, LogOut, Menu, Package, PackageSearch, Plus, Search, Settings2, ShoppingCart, Tags, Users, X } from 'lucide-react';
import { api } from './lib/api';
import { clearCart, clearSession, loadCart, loadSession, saveCart, saveSession } from './lib/storage';
import './styles.css';

const money = (value) => `L. ${Number(value || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;
const isToday = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};
const SITE_SUBNAME_OPTIONS = [
  'Repuestos mayoristas',
  'Ferreteria industrial',
  'Distribucion automotriz',
  'Suministros electricos',
  'Importadora y repuestos',
  'Distribuidora mayorista',
  'Catalogo B2B'
];
const SITE_FONT_OPTIONS = [
  { value: 'Aptos', label: 'Aptos' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'Bahnschrift', label: 'Bahnschrift' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Roboto Condensed', label: 'Roboto Condensed' },
  { value: 'Barlow', label: 'Barlow' }
];

function App() {
  const [session, setSession] = useState(() => loadSession());
  const [view, setView] = useState('catalog');

  useEffect(() => {
    api.setTenantSlug(session?.tenant?.slug || 'kolben');
  }, [session?.tenant?.slug]);

  const handleLogin = (nextSession) => {
    saveSession(nextSession);
    setSession(nextSession);
    setView(nextSession.user.rol === 'superadmin' ? 'superadmin' : nextSession.user.rol === 'cliente' ? 'catalog' : 'admin');
  };

  const logout = () => {
    api.setTenantSlug('kolben');
    clearSession();
    setSession(null);
    setView('catalog');
  };

  if (!session) return <Login onLogin={handleLogin} />;

  if (session.user.rol === 'superadmin') {
    return <SuperAdminShell session={session} onLogout={logout} />;
  }

  if (session.user.rol === 'admin') {
    return <Admin session={session} onLogout={logout} onTenantUpdated={(tenant) => {
      const nextSession = { ...session, tenant };
      saveSession(nextSession);
      setSession(nextSession);
    }} />;
  }

  return (
    <Shell session={session} view={view} setView={setView} onLogout={logout}>
      {view === 'catalog' && <Catalog session={session} />}
      {view === 'history' && <History session={session} />}
      {view === 'admin' && <Admin session={session} />}
    </Shell>
  );
}

function Shell({ session, view, setView, onLogout, children }) {
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
        <button className="brand-lockup" onClick={() => setView('catalog')} aria-label="Abrir catalogo">
          <TenantLogoMark tenant={tenant} />
          <span>
            <strong>{tenant.nombre || 'Empresa'}</strong>
            <small>{tenant.subnombre || 'Catalogo privado'}</small>
          </span>
        </button>

        <div className="welcome-line">
          <span>Bienvenido,</span>
          <b>{session.user.nombre}</b>
        </div>

        <div className="topbar-actions">
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

function SuperAdminShell({ session, onLogout }) {
  return (
    <div className="superadmin-shell">
      <main className="login-screen superadmin-screen">
        <SuperAdmin token={session.token} onLogout={onLogout} />
      </main>
    </div>
  );
}

function TenantLogoMark({ tenant, size = 'normal' }) {
  const label = tenant?.nombre || 'Empresa';
  const hasLogo = Boolean(tenant?.logo_url);
  return (
    <span className={`logo-mark tenant-logo-mark ${size === 'small' ? 'small' : ''} ${hasLogo ? 'has-logo' : 'needs-logo'}`}>
      {hasLogo ? (
        <img src={tenant.logo_url} alt={`Logo de ${label}`} />
      ) : (
        <>
          <b>Logo</b>
        </>
      )}
    </span>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('KolbenAdminPassword123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState('kolben');
  const tenantTiles = [
    { slug: 'kolben', name: 'KOLBEN', sector: 'Repuestos mayoristas', domain: 'kolben.catalogohn.com', status: 'ACTIVO', available: true },
    ...Array.from({ length: 3 }, (_, index) => ({
      slug: `reserve-${index + 1}`,
      name: 'Disponible',
      sector: '',
      domain: 'Reserva tu espacio',
      status: 'RESERVA TU ESPACIO'
    }))
  ];

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onLogin(await api.login({ username, password, tenantSlug: selectedTenant }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <header className="login-header">
        <strong>CatalogoHN</strong>
        <span>Catalogos mayoristas privados</span>
      </header>

      <section className="tenant-picker">
        <h1>CatalogoHN</h1>
        <p>Catalogos digitales para distribuidoras en Honduras</p>
        <span className="status-pill">1 empresa activa en la plataforma</span>
        <div className="tenant-grid">
          {tenantTiles.map((tenant) => (
            <button
              className={`tenant-tile ${tenant.available ? 'active' : 'disabled'}`}
              key={tenant.slug}
              onClick={() => {
                if (!tenant.available) {
                  window.alert('Empresa no disponible aun');
                  return;
                }
                setSelectedTenant(tenant.slug);
                setLoginOpen(true);
              }}
              aria-label={`Seleccionar ${tenant.name}`}
            >
              <span className="tenant-tile-status">{tenant.status}</span>
              <strong className="tenant-tile-name">{tenant.name}</strong>
              {tenant.sector && <small className="tenant-tile-meta">{tenant.sector}</small>}
              <em className="tenant-tile-domain">{tenant.domain}</em>
            </button>
          ))}
        </div>

        <button className="primary-button login-start-button" onClick={() => setLoginOpen(true)}>
          <span>Iniciar sesion</span>
          <small>Clientes y administradores</small>
        </button>

        <div className="tenant-footer">
          <p>¿Eres una empresa distribuidora?</p>
          <a href="#" onClick={(e) => { e.preventDefault(); window.alert('Registro de empresas: Proximamente'); }}>
            ¿Quieres registrar tu empresa? <strong>Contactanos →</strong>
          </a>
        </div>
      </section>

      {loginOpen && (
        <div className="login-modal-backdrop" onClick={() => !loading && setLoginOpen(false)}>
          <section className="login-modal" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-head">
              <h2>Ingreso privado</h2>
              <button className="icon-button" onClick={() => !loading && setLoginOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <p>Acceso privado para clientes y administradores</p>
            <form onSubmit={submit} className="login-modal-form">
              <label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
              <label>Contrasena<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
              {error && <small className="form-error">{error}</small>}
              <button className="forgot-password-button" type="button" onClick={() => window.alert('Recuperacion de contrasena: proximamente')}>
                ¿Olvidaste la contrasena?
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

function Catalog({ session }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [cart, setCart] = useState(() => loadCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSent, setOrderSent] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.catalog(session.token).then(setData).catch(console.error);
  }, [session.token]);

  useEffect(() => saveCart(cart), [cart]);

  const products = useMemo(() => {
    if (!data) return [];
    return data.productos.filter((product) => {
      const haystack = `${product.sku} ${product.descripcion} ${product.marca} ${product.categoria}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesBrand = brand === 'all' || Number(product.marca_id) === Number(brand);
      return matchesQuery && matchesBrand;
    });
  }, [data, query, brand]);

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

  if (!data) return <Loading label="Cargando catalogo Kolben" />;

  return (
    <section className="catalog-page">
      <div className="customer-welcome">
        <span>Bienvenido</span>
        <strong>{session.user.nombre}</strong>
      </div>

      <div className="search-box">
        <Search size={18} />
        <input placeholder="Buscar por codigo o marca..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <section className="brand-section" aria-label="Marcas principales">
        <div className="brand-section-head">
          <h2>Top Brands</h2>
          <button type="button" onClick={() => setBrand('all')}>View All</button>
        </div>

        <div className="brand-strip">
          <button className={brand === 'all' ? 'brand-chip active' : 'brand-chip'} onClick={() => setBrand('all')}>
            <span className="brand-orb all-brand-icon" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="brand-label">All</span>
          </button>
          {data.marcas.map((item) => (
            <button className={Number(brand) === item.id ? 'brand-chip active' : 'brand-chip'} onClick={() => setBrand(item.id)} key={item.id}>
              <span className="brand-orb">
                {item.logo_url ? <img src={item.logo_url} alt="" /> : <span>{initials(item.nombre)}</span>}
              </span>
              <span className="brand-label">{item.nombre}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="product-count">{products.length} productos</p>

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} branches={data.sucursales} quantities={cart[product.id] || {}} onQty={updateQty} onAdd={addProductQty} />
        ))}
      </div>

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

function ProductCard({ product, branches, quantities, onQty, onAdd }) {
  const primaryBranches = branches.slice(0, product.id % 6 === 0 ? 3 : 1);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(primaryBranches.map((branch) => [branch.id, product.id === 1 ? 4 : 1])));
  const currentPrice = Number(product.precio_final || product.precio || 0);
  const oldPrice = Number(product.precio || 0);

  function setDraft(branchId, value) {
    setDrafts((current) => ({ ...current, [branchId]: Math.max(1, Number(value) || 1) }));
  }

  function addBranch(branchId) {
    const nextQty = Number(quantities[branchId] || 0) + Number(drafts[branchId] || 1);
    onAdd(product, branchId, nextQty);
  }

  return (
    <article className="product-card">
      {product.en_promocion && <span className="promo-ribbon">PROMO</span>}
      <div className="product-image">
        {product.imagenes?.[0] ? <img src={product.imagenes[0]} alt={product.descripcion} /> : <PackageSearch size={42} />}
        <span className="card-brand">{product.marca}</span>
        <span className="photo-count">2 fotos</span>
      </div>
      <div className="product-body">
        <span className="sku-code">{product.sku}</span>
        <h3>{product.specs?.aplicacion || product.descripcion}</h3>
        <p>{product.descripcion}</p>
        <p>{product.specs?.medida}</p>
        <div className="price-line">
          {product.en_promocion && oldPrice > currentPrice && <span>{money(oldPrice)}</span>}
          <b className={product.en_promocion ? 'promo-price' : ''}>{money(currentPrice)}</b>
        </div>
      </div>
      <div className="branch-qty">
        {primaryBranches.map((branch, index) => (
          <label key={branch.id}>
            {primaryBranches.length > 1 && <span>{String.fromCharCode(65 + index)}</span>}
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={drafts[branch.id] || 1}
              onChange={(event) => setDraft(branch.id, event.target.value)}
            />
            <button type="button" onClick={() => addBranch(branch.id)}>+ Agregar</button>
          </label>
        ))}
      </div>
    </article>
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
              <button type="button" onClick={onClose}>Volver al catalogo</button>
            </div>
          )}
          {lines.map((line) => (
            <div className="cart-line" key={`${line.producto_id}-${line.sucursal_id}`}>
              <img src={line.imagen || '/kolben-part.svg'} alt="" />
              <div className="cart-line-main">
                <span className="cart-sku">{line.sku}</span>
                <label>
                  Cant.
                  <input
                    type="number"
                    min="1"
                    value={line.cantidad}
                    onChange={(event) => onQty({ id: line.producto_id }, line.sucursal_id, event.target.value)}
                  />
                </label>
                <strong>{money(line.precio_unitario * line.cantidad)}</strong>
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
    api.orders(session.token).then((payload) => setOrders(payload.pedidos)).catch(console.error);
  }, [session.token]);

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
            <p key={`${item.producto_id}-${item.sucursal_id}`}>{item.sku} · {item.cantidad} para {item.sucursal}</p>
          ))}
          <strong>{money(order.total)}</strong>
        </article>
      ))}
    </section>
  );
}

function Admin({ session, onLogout, onTenantUpdated }) {
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState('orders');
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [priceData, setPriceData] = useState(null);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    api.adminSummary(session.token).then(setSummary).catch(console.error);
    api.orders(session.token).then((payload) => setOrders(payload.pedidos)).catch(console.error);
    api.adminClients(session.token).then((payload) => setClients((payload.clientes || []).map(normalizeAdminClient))).catch(() => setClients([]));
    api.adminPrices(session.token).then((payload) => setPriceData(normalizeAdminPriceData(payload))).catch(() => setPriceData(normalizeAdminPriceData({ listas: [], productos: [] })));
    api.adminCatalog(session.token).then((payload) => {
      setCatalog(payload);
      setProducts(payload.productos.map((product, index) => ({ ...product, posicion: product.posicion || index + 1, visible: product.visible !== false })));
      setBrands(payload.marcas || []);
      setCategories(payload.categorias || []);
    }).catch(console.error);
  }, [session.token]);

  if (!summary || !catalog || !priceData) return <Loading label="Cargando panel admin" />;

  const displayOrders = orders;
  const pending = displayOrders.filter((order) => order.estado === 'pendiente').length;
  const preparing = displayOrders.filter((order) => order.estado === 'preparando').length;
  const sentToday = displayOrders.filter((order) => order.estado === 'enviado' && isToday(order.fecha)).length;
  const priceLists = priceData.listas || [];
  const priceProducts = priceData.productos || [];

  async function updateProduct(id, changes) {
    const currentProduct = products.find((product) => product.id === id);
    const optimistic = { ...currentProduct, ...changes };
    setProducts((current) => current.map((product) => (product.id === id ? optimistic : product)));
    try {
      const saved = await api.adminSaveProduct(session.token, changes.id ? changes : { ...changes, id });
      setProducts((current) => current.map((product) => (product.id === id ? normalizeAdminProduct(saved.producto, brands, categories) : product)));
    } catch {
      setProducts((current) => current.map((product) => (product.id === id ? optimistic : product)));
    }
  }

  async function saveProduct(payload) {
    let uploadedImageUrl = null;
    if (payload.imageFile) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.imageFile, 'product');
        uploadedImageUrl = upload.url;
      } catch {
        uploadedImageUrl = URL.createObjectURL(payload.imageFile);
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
    } catch {
      const fallback = normalizeAdminProduct({ ...nextPayload, id: nextPayload.id || Date.now() }, brands, categories);
      setProducts((current) => (nextPayload.id ? current.map((product) => (product.id === nextPayload.id ? fallback : product)) : [fallback, ...current]));
    } finally {
      setEditor(null);
    }
  }

  async function saveClient(payload) {
    const nextPayload = prepareClientPayload(payload);
    try {
      const saved = await api.adminSaveClient(session.token, nextPayload);
      const client = normalizeAdminClient(saved.cliente);
      setClients((current) => (nextPayload.id ? current.map((item) => (item.id === nextPayload.id ? client : item)) : [client, ...current]));
    } catch {
      const fallback = normalizeAdminClient({ ...nextPayload, id: nextPayload.id || Date.now(), lista_precio: priceLists.find((item) => Number(item.id) === Number(nextPayload.lista_precio_id))?.nombre });
      setClients((current) => (nextPayload.id ? current.map((client) => (client.id === nextPayload.id ? fallback : client)) : [fallback, ...current]));
    } finally {
      setEditor(null);
    }
  }

  async function savePrice(payload) {
    if (editor?.type === 'price-list') {
      try {
        const saved = await api.adminSavePriceList(session.token, payload);
        setPriceData((current) => ({
          ...current,
          listas: payload.id
            ? current.listas.map((item) => (item.id === payload.id ? { ...item, ...saved.lista } : item))
            : [{ ...saved.lista, precios: [] }, ...current.listas]
        }));
      } finally {
        setEditor(null);
      }
      return;
    }

    const precios = priceProducts.map((product) => ({
      producto_id: product.id,
      precio: Number(payload[`precio_${product.id}`] || 0),
      precio_promocion: payload[`promo_${product.id}`] === '' ? null : Number(payload[`promo_${product.id}`] || 0) || null
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
    const ok = window.confirm(`Confirmar cambio a "${stateLabel(estado)}"`) && window.confirm('Segunda confirmacion requerida');
    if (!ok) return;
    const previous = orders;
    setOrders((current) => current.map((order) => (order.id === id ? { ...order, estado } : order)));
    try {
      const saved = await api.updateOrderStatus(session.token, id, estado);
      setOrders((current) => current.map((order) => (order.id === id ? { ...order, ...saved.pedido } : order)));
    } catch {
      setOrders(previous);
    }
  }

  async function deleteOrder(id) {
    const ok = window.confirm('Confirmar eliminacion del pedido') && window.confirm('Segunda confirmacion requerida');
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
      } catch {
        logoUrl = URL.createObjectURL(payload.logoFile);
      }
    }
    const nextPayload = { ...payload, logoFile: undefined, logo_url: logoUrl };
    try {
      const saved = await api.adminSaveBrand(session.token, nextPayload);
      setBrands((current) => (nextPayload.id ? current.map((item) => (item.id === nextPayload.id ? saved.marca : item)) : [saved.marca, ...current]));
    } catch {
      setBrands((current) => {
        if (nextPayload.id) return current.map((item) => (item.id === nextPayload.id ? { ...item, ...nextPayload } : item));
        return [{ ...nextPayload, id: Date.now(), posicion: current.length + 1 }, ...current];
      });
    }
  }

  async function saveCategory(payload) {
    try {
      const saved = await api.adminSaveCategory(session.token, payload);
      setCategories((current) => (payload.id ? current.map((item) => (item.id === payload.id ? saved.categoria : item)) : [saved.categoria, ...current]));
    } catch {
      setCategories((current) => {
        if (payload.id) return current.map((item) => (item.id === payload.id ? { ...item, ...payload } : item));
        return [{ ...payload, id: Date.now(), color: payload.color || '#F5C200' }, ...current];
      });
    }
  }

  async function deleteBrand(id) {
    try {
      await api.adminDeleteBrand(session.token, id);
    } catch {}
    setBrands((current) => current.filter((item) => item.id !== id));
  }

  async function deleteCategory(id) {
    try {
      await api.adminDeleteCategory(session.token, id);
    } catch {}
    setCategories((current) => current.filter((item) => item.id !== id));
  }

  async function saveSite(payload) {
    let logoUrl = payload.logo_url || summary.tenant.logo_url || '';
    if (payload.logoFile) {
      try {
        const upload = await api.adminUploadImage(session.token, payload.logoFile, 'tenant');
        logoUrl = upload.url;
      } catch {
        logoUrl = URL.createObjectURL(payload.logoFile);
      }
    }
    const nextPayload = { ...payload, logo_url: logoUrl, logoFile: undefined };
    try {
      const saved = await api.adminUpdateSite(session.token, nextPayload);
      const nextTenant = saved.tenant;
      setSummary((current) => ({ ...current, tenant: nextTenant }));
      saveSession({ ...session, tenant: nextTenant });
      onTenantUpdated?.(nextTenant);
    } catch {
      const fallbackTenant = { ...summary.tenant, ...nextPayload };
      setSummary((current) => ({ ...current, tenant: { ...current.tenant, ...nextPayload } }));
      saveSession({ ...session, tenant: fallbackTenant });
      onTenantUpdated?.(fallbackTenant);
    } finally {
      setEditor(null);
    }
  }

  return (
    <div className="admin-mobile-shell" style={tenantBrandStyle(summary.tenant)}>
      <header className="admin-mobile-topbar">
        <button className="admin-brand-button" onClick={() => setEditor({ type: 'site', title: 'Configuracion del sitio', value: summary.tenant })}>
          <TenantLogoMark tenant={summary.tenant} size="small" />
          <span><strong>{summary.tenant?.nombre || 'Empresa'}</strong><small>{summary.tenant?.subnombre || 'Panel Admin'}</small></span>
        </button>
        <button className="admin-logo-button" onClick={() => setEditor({ type: 'site', title: 'Configuracion del sitio', value: summary.tenant })}>
          <Settings2 size={14} /> Configurar
        </button>
        <button className="admin-exit-button" onClick={onLogout}>Salir</button>
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
            onBrands={() => setEditor({ type: 'brands', title: 'Marcas', value: brands })}
            onCategories={() => setEditor({ type: 'categories', title: 'Categorias', value: categories })}
          />
        )}

        {tab === 'clients' && (
          <AdminClientsSection
            clients={clients}
            onNew={() => setEditor({ type: 'client', title: 'Nuevo cliente', value: {} })}
            onEdit={(client) => setEditor({ type: 'client', title: 'Editar cliente', value: client })}
            onToggle={toggleClient}
          />
        )}

        {tab === 'prices' && (
          <AdminPricesSection
            lists={priceLists}
            products={priceProducts}
            onNew={() => setEditor({ type: 'price-list', title: 'Nueva lista de precios', value: {} })}
            onEditList={(list) => setEditor({ type: 'price-list', title: 'Editar lista', value: list })}
            onEditPrices={(list) => setEditor({ type: 'price', title: `Precios: ${list.nombre}`, value: list })}
          />
        )}
      </main>

      <AdminBottomNav tab={tab} setTab={setTab} pending={pending} />

      {editor && (
        <AdminEditor
          editor={editor}
          brands={brands}
          categories={categories}
          priceLists={priceLists}
          priceProducts={priceProducts}
          onClose={() => setEditor(null)}
          onSaveProduct={saveProduct}
          onSaveClient={saveClient}
          onSavePrice={savePrice}
          onSaveBrand={saveBrand}
          onSaveCategory={saveCategory}
          onSaveSite={saveSite}
          onDeleteBrand={deleteBrand}
          onDeleteCategory={deleteCategory}
        />
      )}
    </div>
  );
}


const adminSeedPrices = [
  { id: 1, numero: 1, cliente: 'Auto Rep. Navarro', contacto: '9832-1315', credito: '60d', mFrenos: 720, mFrGrande: 820, mClutch: 420, pMes: 8, pAno: 62, lMes: 24800, lAno: '192k' },
  { id: 2, numero: 2, cliente: 'Auto Rep. OYM', contacto: '9572-5106', credito: '30d', mFrenos: 720, mFrGrande: 820, mClutch: 405, pMes: 5, pAno: 38, lMes: 15400, lAno: '118k' },
  { id: 7, numero: 7, cliente: 'Inv. Y Carwash Tabora', contacto: '9983-8278', credito: '60d', mFrenos: 650, mFrGrande: 750, mClutch: 340, pMes: 3, pAno: 24, lMes: 8200, lAno: '67k' },
  { id: 30, numero: 30, cliente: 'Multi Auto Comayaguela', contacto: '9725-3866', credito: '30d', mFrenos: 710, mFrGrande: 810, mClutch: 360, pMes: 1, pAno: 9, lMes: 890, lAno: '22k' }
];

const mockPriceProducts = [
  { id: 1, sku: 'BF-3129', descripcion: 'Bomba de Freno Principal', marca: 'KOLBEN', categoria: 'Bomba de Freno' },
  { id: 2, sku: 'BC-4211', descripcion: 'Bomba de Clutch Superior', marca: 'KOLBEN', categoria: 'Bomba de Clutch' },
  { id: 3, sku: 'CF-6802', descripcion: 'Cilindro de Rueda Auxiliar', marca: 'FIC', categoria: 'Cilindro de Freno' }
];

const adminSeedPriceLists = [
  {
    id: 1,
    nombre: 'Distribuidor Mayorista',
    clientes: 1,
    productos_con_precio: 3,
    precios: [
      { producto_id: 1, lista_precio_id: 1, precio: 1250, precio_promocion: 1050 },
      { producto_id: 2, lista_precio_id: 1, precio: 850, precio_promocion: null },
      { producto_id: 3, lista_precio_id: 1, precio: 450, precio_promocion: null }
    ]
  }
];

function AdminOrdersSection({ orders, pending, preparing, sentToday, clients = [], onState, onDelete }) {
  return (
    <>
      <AdminSectionTitle title="Pedidos" subtitle="Gestiona los pedidos recibidos" />
      <div className="admin-stat-grid">
        <AdminStat value={pending} label="Pendientes" tone="orange" />
        <AdminStat value={preparing} label="Preparando" tone="blue" />
        <AdminStat value={sentToday} label="Enviados hoy" tone="green" />
        <AdminStat value={orders.length} label="Pedidos" helper="total preview" />
      </div>
      <div className="admin-order-list">
        {orders.length === 0 && (
          <div className="admin-empty-state">
            <strong>Aun no hay pedidos</strong>
            <span>Los pedidos apareceran aqui cuando un cliente creado por Kolben haga una compra.</span>
          </div>
        )}
        {orders.map((order) => (
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

function AdminCatalogSection({ products, brands, categories, onNew, onProductEdit, onToggle, onPosition, onBrands, onCategories }) {
  return (
    <>
      <div className="admin-title-row">
        <AdminSectionTitle title="Catalogo" subtitle="Productos activos e inactivos" />
        <div>
          <button onClick={onBrands}><Tags size={13} /> Marcas</button>
          <button onClick={onCategories}><Folder size={13} /> Categorias</button>
          <button className="admin-new-button" onClick={onNew}><Plus size={13} /> Nuevo</button>
        </div>
      </div>
      <div className="admin-product-list">
        {products.map((product) => (
          <article className={product.visible ? 'admin-product-row' : 'admin-product-row muted'} key={product.id}>
            <div className="admin-product-top">
              <img src={product.imagenes?.[0] || '/kolben-part.svg'} alt="" />
              <div>
                <span className="sku-code">{product.sku}</span>
                <small>{product.marca} · {product.specs?.aplicacion || product.descripcion}</small>
              </div>
              <button onClick={() => onProductEdit(product)}>Editar</button>
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

function AdminClientsSection({ clients, onNew, onEdit, onToggle }) {
  return (
    <>
      <div className="admin-title-row">
        <AdminSectionTitle title="Clientes" subtitle="Cuentas y accesos" />
        <button className="admin-new-button" onClick={onNew}><Plus size={13} /> Nuevo</button>
      </div>
      <div className="admin-client-card">
        {clients.length === 0 && (
          <div className="admin-empty-state">
            <strong>No hay clientes creados</strong>
            <span>Usa Nuevo para crear el primer acceso mayorista de Kolben.</span>
          </div>
        )}
        {clients.map((client) => (
          <button className="admin-client-row" key={client.id} onClick={() => onEdit(client)}>
            <span className={client.activo ? 'client-avatar' : 'client-avatar off'}>{client.iniciales}</span>
            <span>
              <strong>{client.nombre}</strong>
              <small>{client.usuario} · {client.lista} · {client.credito} · {client.tipo}</small>
              <small>{client.acceso}</small>
            </span>
            <b onClick={(event) => { event.stopPropagation(); onToggle(client); }} className={client.activo ? 'client-state on' : 'client-state'}>{client.activo ? 'Activo' : 'Inactivo'}</b>
          </button>
        ))}
      </div>
    </>
  );
}

function AdminPricesSection({ lists, products, onNew, onEditList, onEditPrices }) {
  return (
    <>
      <div className="admin-title-row">
        <AdminSectionTitle title="Listas de precios" subtitle="Precios por producto y segmento" />
        <button className="admin-new-button" onClick={onNew}><Plus size={13} /> Nueva lista</button>
      </div>
      <div className="admin-price-card">
        <table>
          <thead><tr><th>Lista</th><th>Clientes</th><th>Productos</th><th>Precio base</th><th>Promo</th><th>Accion</th></tr></thead>
          <tbody>
            {lists.map((list) => {
              const filledPrices = list.precios?.filter((price) => Number(price.precio) > 0) || [];
              const promoCount = filledPrices.filter((price) => price.precio_promocion).length;
              const firstPrice = filledPrices[0];
              return (
                <tr key={list.id}>
                  <td onClick={() => onEditPrices(list)}><strong>{list.nombre}</strong></td>
                  <td>{list.clientes || 0}</td>
                  <td>{filledPrices.length}/{products.length}</td>
                  <td>{firstPrice ? money(firstPrice.precio) : 'L. 0.00'}</td>
                  <td><span>{promoCount} promo</span></td>
                  <td><button type="button" onClick={() => onEditList(list)}>Nombre</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p>Toca una lista para editar precios por producto.</p>
      </div>
    </>
  );
}

function AdminSectionTitle({ title, subtitle }) {
  return <div className="admin-section-title"><h1>{title}</h1><p>{subtitle}</p></div>;
}

function AdminStat({ value, label, tone, helper }) {
  return <article className={`admin-stat ${tone || ''}`}><strong>{value}</strong>{helper && <span>{helper}</span>}<small>{label}</small></article>;
}

function AdminBottomNav({ tab, setTab, pending }) {
  const items = [
    ['orders', 'Pedidos', Package, pending],
    ['catalog', 'Catalogo', PackageSearch],
    ['clients', 'Clientes', Users],
    ['prices', 'C. Precios', BadgeDollarSign]
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
      <header>
        <TenantLogoMark tenant={tenant} size="small" />
        <span>
          <strong>{tenant?.nombre || 'Nombre de empresa'}</strong>
          <small>{tenant?.subnombre || 'Subnombre del catalogo'}</small>
        </span>
      </header>
      <div>
        <span>Catalogo privado</span>
        <strong>Productos destacados</strong>
        <button type="button">Ver pedido</button>
      </div>
    </section>
  );
}

function AdminEditor({ editor, brands, categories, priceLists, priceProducts, onClose, onSaveProduct, onSaveClient, onSavePrice, onSaveBrand, onSaveCategory, onSaveSite, onDeleteBrand, onDeleteCategory }) {
  const [form, setForm] = useState(() => buildAdminEditorForm(editor));
  const [previewLogoUrl, setPreviewLogoUrl] = useState('');
  const [customSubnameMode, setCustomSubnameMode] = useState(() => Boolean(editor.value?.subnombre && !SITE_SUBNAME_OPTIONS.includes(editor.value.subnombre)));
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedSubname = customSubnameMode ? '__custom__' : SITE_SUBNAME_OPTIONS.includes(form.subnombre) ? form.subnombre : '';
  const sitePreviewTenant = { ...(editor.value || {}), ...form, logo_url: previewLogoUrl || form.logo_url };

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
    if (editor.type === 'product') await onSaveProduct(form);
    if (editor.type === 'client') await onSaveClient(form);
    if (editor.type === 'price' || editor.type === 'price-list') await onSavePrice(form);
    if (editor.type === 'site') await onSaveSite(form);
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
            <label>Codigo<input value={form.sku || ''} onChange={(event) => update('sku', event.target.value)} /></label>
            <label>Descripcion<input value={form.descripcion || ''} onChange={(event) => update('descripcion', event.target.value)} /></label>
            <label>Aplicacion<input value={form.specs?.aplicacion || ''} onChange={(event) => update('specs', { ...(form.specs || {}), aplicacion: event.target.value })} /></label>
            <label>Medida<input value={form.specs?.medida || ''} onChange={(event) => update('specs', { ...(form.specs || {}), medida: event.target.value })} /></label>
            <label>Marca<select value={form.marca_id || brands[0]?.id || ''} onChange={(event) => update('marca_id', Number(event.target.value))}>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.nombre}</option>)}</select></label>
            <label>Categoria<select value={form.categoria_id || categories[0]?.id || ''} onChange={(event) => update('categoria_id', Number(event.target.value))}>{categories.map((category) => <option value={category.id} key={category.id}>{category.nombre}</option>)}</select></label>
            <label>Precio<input type="number" value={form.precio || ''} onChange={(event) => update('precio', Number(event.target.value))} /></label>
            <label>Imagenes<input type="file" accept="image/*" onChange={(event) => update('imageFile', event.target.files?.[0])} /></label>
          </div>
        )}

        {editor.type === 'client' && (
          <div className="admin-form">
            <label>Nombre<input value={form.nombre || ''} onChange={(event) => update('nombre', event.target.value)} /></label>
            <label>Usuario<input value={form.username || form.usuario || ''} onChange={(event) => update('username', event.target.value)} /></label>
            <label>Contrasena inicial<input type="password" placeholder={form.id ? 'Dejar igual' : 'Asignar contrasena'} value={form.password || ''} onChange={(event) => update('password', event.target.value)} /></label>
            <label>Lista<select value={form.lista_precio_id || ''} onChange={(event) => update('lista_precio_id', Number(event.target.value) || '')}>
              <option value="">Sin lista</option>
              {priceLists.map((list) => <option value={list.id} key={list.id}>{list.nombre}</option>)}
            </select></label>
            <label>Credito<input value={form.condicion_credito || form.credito || ''} onChange={(event) => update('condicion_credito', event.target.value)} /></label>
            <label>Estado<select value={form.activo === false ? 'inactivo' : 'activo'} onChange={(event) => update('activo', event.target.value === 'activo')}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select></label>
            <label>Sucursales<textarea value={form.sucursales_text || ''} onChange={(event) => update('sucursales_text', event.target.value)} placeholder="Sucursal Centro | San Pedro Sula" /></label>
          </div>
        )}

        {editor.type === 'price-list' && (
          <div className="admin-form">
            <label>Nombre de lista<input value={form.nombre || ''} onChange={(event) => update('nombre', event.target.value)} /></label>
          </div>
        )}

        {editor.type === 'price' && (
          <div className="admin-form admin-price-editor">
            {priceProducts.map((product) => (
              <div className="admin-price-editor-row" key={product.id}>
                <span><strong>{product.sku}</strong><small>{product.marca} · {product.descripcion}</small></span>
                <label>Precio<input type="number" value={form[`precio_${product.id}`] || ''} onChange={(event) => update(`precio_${product.id}`, event.target.value)} /></label>
                <label>Promo<input type="number" value={form[`promo_${product.id}`] || ''} onChange={(event) => update(`promo_${product.id}`, event.target.value)} /></label>
              </div>
            ))}
          </div>
        )}

        {editor.type === 'brands' && <AdminEntityCrud items={brands} label="Marca" onSave={onSaveBrand} onDelete={onDeleteBrand} />}
        {editor.type === 'categories' && <AdminEntityCrud items={categories} label="Categoria" onSave={onSaveCategory} onDelete={onDeleteCategory} />}

        {!['brands', 'categories'].includes(editor.type) && <button className="primary-button" onClick={save}>Guardar</button>}
      </section>
    </div>
  );
}

function AdminEntityCrud({ items, label, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  return (
    <div className="admin-entity-crud">
      <div className="admin-form">
        <label>{label}<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        {label === 'Marca' && <label>Logo<input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0])} /></label>}
        <button className="primary-button" onClick={() => { if (!name) return; onSave({ nombre: name, logoFile }); setName(''); setLogoFile(null); }}>Agregar</button>
      </div>
      {items.map((item) => (
        <div className="admin-entity-row" key={item.id}>
          <strong>{item.nombre}</strong>
          <button onClick={() => onSave({ ...item, nombre: window.prompt(`Editar ${label}`, item.nombre) || item.nombre })}>Editar</button>
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
  return normalizeAdminProduct(
    {
      ...product,
      marca_id: product.marca_id || brands[0]?.id || null,
      categoria_id: product.categoria_id || categories[0]?.id || null,
      visible: product.visible !== false,
      posicion: product.posicion || (products.length + 1),
      imagenes: product.imagenes?.length ? product.imagenes : ['/kolben-part.svg'],
      precio: Number(product.precio || product.precio_final || 0)
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
    imagenes: product.imagenes?.length ? product.imagenes : ['/kolben-part.svg'],
    precio: Number(product.precio || product.precio_final || 0),
    precio_final: Number(product.precio_final || product.precio || 0)
  };
}

function normalizeAdminClient(client) {
  const branches = Array.isArray(client.sucursales) ? client.sucursales : [];
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
    listas: (payload.listas || []).map((list) => ({ ...list, precios: list.precios || [] })),
    productos: payload.productos || []
  };
}

function buildAdminEditorForm(editor) {
  const form = { ...editor.value };
  if (editor.type === 'price') {
    for (const price of editor.value.precios || []) {
      form[`precio_${price.producto_id}`] = price.precio ?? '';
      form[`promo_${price.producto_id}`] = price.precio_promocion ?? '';
    }
  }
  if (editor.type === 'client') {
    form.sucursales_text = form.sucursales_text || (form.sucursales || []).map((branch) => `${branch.nombre}${branch.direccion ? ` | ${branch.direccion}` : ''}`).join('\n');
  }
  return form;
}

function prepareClientPayload(client) {
  return {
    id: client.id,
    nombre: String(client.nombre || '').trim(),
    username: String(client.username || client.usuario || client.email || '').trim().toLowerCase(),
    email: client.email && !String(client.email).endsWith('@cliente.local') ? String(client.email).trim().toLowerCase() : undefined,
    password: client.password || undefined,
    condicion_credito: String(client.condicion_credito || client.credito || 'Contado').trim(),
    activo: client.activo !== false,
    lista_precio_id: client.lista_precio_id || null,
    sucursales: String(client.sucursales_text || '')
      .split('\n')
      .map((line) => {
        const [name, ...addressParts] = line.split('|');
        return { nombre: name?.trim(), direccion: addressParts.join('|').trim() };
      })
      .filter((branch) => branch.nombre)
  };
}

function AdminOrder({ order, token }) {
  const [state, setState] = useState(order.estado);

  async function advance(nextState) {
    const ok = window.confirm(`Confirmar cambio a "${nextState}"`) && window.confirm('Segunda confirmacion requerida');
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

function SuperAdmin({ token, onLogout }) {
  const [tenants, setTenants] = useState(null);
  const [nombre, setNombre] = useState('');
  const [subnombre, setSubnombre] = useState('');
  const [subnombreSeleccionado, setSubnombreSeleccionado] = useState('');
  const [nuevoSubnombre, setNuevoSubnombre] = useState('');
  const [subnombreOptions, setSubnombreOptions] = useState(SITE_SUBNAME_OPTIONS);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [adminPanel, setAdminPanel] = useState(null);
  const [adminNombre, setAdminNombre] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [editingAdminId, setEditingAdminId] = useState(null);
  const [editAdminNombre, setEditAdminNombre] = useState('');
  const [editAdminUsername, setEditAdminUsername] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const subdominioPreview = useMemo(() => slugifyValue(nombre) || 'empresa', [nombre]);

  useEffect(() => {
    if (!token) return;
    api.superadminTenants(token)
      .then((payload) => setTenants(payload.tenants))
      .catch((err) => setError(err.message));
  }, [token]);

  async function openAdmins(tenant) {
    setError('');
    setTempPassword('');
    setAdminNombre('');
    setAdminUsername('');
    setAdminPassword('');
    setEditingAdminId(null);
    setEditAdminNombre('');
    setEditAdminUsername('');
    setEditAdminPassword('');
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
    setEditingAdminId(null);
    setEditAdminNombre('');
    setEditAdminUsername('');
    setEditAdminPassword('');
  }

  async function createAdmin(event) {
    event.preventDefault();
    if (!adminPanel?.tenant?.id) return;
    setError('');
    setTempPassword('');
    try {
      const payload = await api.superadminCreateAdmin(token, adminPanel.tenant.id, {
        nombre: adminNombre,
        username: adminUsername,
        password: adminPassword || undefined
      });
      setTempPassword(payload.temp_password || '');
      setAdminPanel((current) => ({ ...current, admins: [payload.admin, ...(current?.admins || [])] }));
      setAdminNombre('');
      setAdminUsername('');
      setAdminPassword('');
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditAdmin(admin) {
    setError('');
    setTempPassword('');
    setEditingAdminId(admin.id);
    setEditAdminNombre(admin.nombre || '');
    setEditAdminUsername(admin.username || '');
    setEditAdminPassword('');
  }

  function cancelEditAdmin() {
    setEditingAdminId(null);
    setEditAdminNombre('');
    setEditAdminUsername('');
    setEditAdminPassword('');
  }

  async function saveAdminChanges(admin) {
    if (!admin?.id) return;
    const payload = {
      nombre: editAdminNombre,
      username: editAdminUsername,
      password: editAdminPassword || undefined
    };
    setError('');
    setTempPassword('');
    try {
      const result = await api.superadminUpdateAdmin(token, admin.id, payload);
      setAdminPanel((current) => ({
        ...current,
        admins: (current?.admins || []).map((item) => (item.id === admin.id ? result.admin : item))
      }));
      cancelEditAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeAdmin(admin) {
    if (!admin?.id) return;
    const ok = window.confirm(`Eliminar admin "${admin.username || admin.nombre}"`) && window.confirm('Segunda confirmacion requerida');
    if (!ok) return;
    setError('');
    setTempPassword('');
    try {
      await api.superadminDeleteAdmin(token, admin.id);
      setAdminPanel((current) => ({
        ...current,
        admins: (current?.admins || []).filter((item) => item.id !== admin.id)
      }));
      if (editingAdminId === admin.id) cancelEditAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createTenant(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await api.superadminCreateTenant(token, { nombre, subnombre });
      setTenants((current) => [created.tenant, ...(current || [])]);
      setNombre('');
      setSubnombre('');
      setSubnombreSeleccionado('');
      setNuevoSubnombre('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tenant) {
    const action = tenant.activa ? 'suspender' : 'activar';
    const ok = window.confirm(`Confirmar ${action} "${tenant.nombre}"`) && window.confirm('Segunda confirmacion requerida');
    if (!ok) return;
    setError('');
    try {
      const updated = await api.superadminSetTenantActive(token, tenant.id, !tenant.activa);
      setTenants((current) => (current || []).map((item) => (item.id === tenant.id ? updated.tenant : item)));
    } catch (err) {
      setError(err.message);
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

  function agregarSubnombre() {
    const value = String(nuevoSubnombre || '').trim();
    if (!value) return;
    setSubnombreOptions((current) => (current.includes(value) ? current : [...current, value]));
    setSubnombreSeleccionado(value);
    setSubnombre(value);
    setNuevoSubnombre('');
  }

  return (
    <section className="superadmin-page">
      <header className="login-header superadmin-top-header">
        <div className="superadmin-header-text">
          <strong>CatalogoHN</strong>
          <span>Super Admin · Gestor central de empresas</span>
        </div>
        <button className="icon-button superadmin-logout" onClick={onLogout} aria-label="Cerrar sesion">
          <LogOut size={18} />
        </button>
      </header>

      <section className="superadmin-box">
        <div className="superadmin-head">
          <h1>Empresas</h1>
          <span className="status-pill">{(tenants || []).filter((item) => item.activa).length} activas</span>
        </div>

        <form className="superadmin-form superadmin-create-form" onSubmit={createTenant}>
          <label>Nombre comercial<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label>
            Subnombre
            <select value={subnombreSeleccionado} onChange={(e) => handleSubnombreChange(e.target.value)}>
              <option value="">Seleccionar subnombre</option>
              {subnombreOptions.map((option) => (
                <option value={option} key={option}>{option}</option>
              ))}
              <option value="__nuevo__">+ Agregar subnombre</option>
            </select>
          </label>
          {subnombreSeleccionado === '__nuevo__' && (
            <div className="superadmin-subname-add">
              <input value={nuevoSubnombre} onChange={(e) => setNuevoSubnombre(e.target.value)} placeholder="Nuevo subnombre" />
              <button type="button" className="secondary-button" onClick={agregarSubnombre} disabled={!nuevoSubnombre.trim()}>
                Agregar
              </button>
            </div>
          )}
          <small className="superadmin-hint">Subdominio: <b>{subdominioPreview}.catalogohn.com</b></small>
          {error && <small className="form-error">{error}</small>}
          <button className="primary-button" disabled={saving || !nombre}>{saving ? 'Creando...' : 'Crear empresa'}</button>
        </form>

        {!tenants && <Loading label="Cargando empresas" />}

        {tenants && (
          <div className="superadmin-grid">
            {tenants.map((tenant) => (
              <article className="tenant-card" key={tenant.id}>
                <div className="tenant-card-head">
                  <strong>{tenant.slug}.catalogohn.com</strong>
                  <b className={tenant.activa ? 'tenant-state on' : 'tenant-state off'}>{tenant.activa ? 'Activa' : 'Suspendida'}</b>
                </div>
                <p>{tenant.nombre}</p>
                <small>{tenant.subnombre || 'Sin subnombre configurado'}</small>
                <div className="tenant-card-actions">
                  <button className="secondary-button" type="button" onClick={() => openAdmins(tenant)}>
                    Crear admin
                  </button>
                  <button className="secondary-button" type="button" onClick={() => toggleActive(tenant)}>
                    {tenant.activa ? 'Suspender' : 'Activar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="superadmin-footer">
        <strong>CatalogoHN</strong>
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
              <label>Contrasena<input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Vacio = temporal" /></label>
              <button className="primary-button" disabled={!adminNombre || !adminUsername}>
                Crear admin
              </button>
              {tempPassword && <small className="temp-password">Temp password: <b>{tempPassword}</b></small>}
            </form>

            {error && <small className="form-error">{error}</small>}

            <div className="superadmin-admins-list">
              {!adminPanel.admins && <Loading label="Cargando admins" />}
              {adminPanel.admins && adminPanel.admins.length === 0 && <small className="admin-empty">Sin admins aun.</small>}
              {adminPanel.admins && adminPanel.admins.map((admin) => (
                <div className="superadmin-admin-row" key={admin.id}>
                  {editingAdminId === admin.id ? (
                    <div className="superadmin-admin-edit">
                      <label>Nombre<input value={editAdminNombre} onChange={(e) => setEditAdminNombre(e.target.value)} /></label>
                      <label>Usuario<input value={editAdminUsername} onChange={(e) => setEditAdminUsername(e.target.value)} /></label>
                      <label>Nueva contrasena<input value={editAdminPassword} onChange={(e) => setEditAdminPassword(e.target.value)} placeholder="Opcional" /></label>
                      <div className="superadmin-admin-edit-actions">
                        <button type="button" onClick={() => saveAdminChanges(admin)} disabled={!editAdminNombre || !editAdminUsername}>Guardar</button>
                        <button type="button" onClick={cancelEditAdmin}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span>
                        <strong>{admin.nombre}</strong>
                        <small>@{admin.username || 'sin-usuario'}</small>
                      </span>
                      <div className="superadmin-admin-actions">
                        <button type="button" onClick={() => startEditAdmin(admin)}>Editar</button>
                        <button type="button" onClick={() => removeAdmin(admin)}>Eliminar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
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
        <p>{children}</p>
        <div>
          <button className="secondary-button" onClick={onCancel} disabled={disabled}>{cancelLabel}</button>
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
  const primary = tenant.color_primario || '#fac400';
  const secondary = tenant.color_secundario || '#111111';
  const fuente = tenant.fuente || 'Aptos';
  return {
    '--yellow': primary,
    '--tenant-primary': primary,
    '--tenant-secondary': secondary,
    fontFamily: `"${fuente}", "Aptos", "Segoe UI", sans-serif`
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
        imagen: product.imagenes?.[0],
        sucursal: branch?.nombre || 'Sucursal',
        cantidad: Number(cantidad),
        precio_unitario: Number(product.precio_final || product.precio || 0)
      };
    });
  });
}

createRoot(document.getElementById('root')).render(<App />);

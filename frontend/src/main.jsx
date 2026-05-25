import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BadgeDollarSign, Check, ClipboardList, Folder, Image, LogOut, Menu, Package, PackageSearch, Plus, Search, ShoppingCart, Tags, Users, X } from 'lucide-react';
import { api } from './lib/api';
import { clearCart, clearSession, loadCart, loadSession, saveCart, saveSession } from './lib/storage';
import './styles.css';

const money = (value) => `L. ${Number(value || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;

function App() {
  const [session, setSession] = useState(() => loadSession());
  const [view, setView] = useState('catalog');

  const handleLogin = (nextSession) => {
    saveSession(nextSession);
    setSession(nextSession);
    setView(nextSession.user.rol === 'superadmin' ? 'superadmin' : nextSession.user.rol === 'cliente' ? 'catalog' : 'admin');
  };

  const logout = () => {
    clearSession();
    setSession(null);
    setView('catalog');
  };

  if (!session) return <Login onLogin={handleLogin} />;

  if (session.user.rol === 'superadmin') {
    return <SuperAdminShell session={session} onLogout={logout} />;
  }

  if (session.user.rol === 'admin') {
    return <Admin session={session} onLogout={logout} />;
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
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-lockup" onClick={() => setView('catalog')} aria-label="Abrir catalogo">
          <span className="logo-mark"><b>K</b><small>KOLBEN</small></span>
          <strong>KOLBEN</strong>
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
    <div className="app-shell superadmin-shell">
      <header className="topbar">
        <span />
        <div>
          <strong className="brand-word">CatalogoHN</strong>
          <span>Super Admin</span>
        </div>
        <button className="icon-button" onClick={onLogout} aria-label="Cerrar sesion">
          <LogOut size={20} />
        </button>
      </header>
      <main>
        <SuperAdmin token={session.token} />
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('cliente1');
  const [password, setPassword] = useState('ClientPassword123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState('kolben');

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onLogin(await api.login({ username, password }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="tenant-picker">
        <h1>CatalogoHN</h1>
        <p>Catalogos digitales para distribuidoras en Honduras</p>
        <span className="status-pill">1 empresa activa en la plataforma</span>
        <div className="tenant-grid">
          <button
            className="tenant-tile active"
            onClick={() => {
              setSelectedTenant('kolben');
              setLoginOpen(true);
            }}
            aria-label="Seleccionar KOLBEN"
          >
            <span>ACTIVO</span>
            KOLBEN
          </button>
          {['EMP B', 'EMP C', 'EMP D', 'EMP E', 'EMP F'].map((item) => (
            <button
              className="tenant-tile"
              key={item}
              onClick={() => window.alert('Empresa no disponible aun')}
              aria-label={`Seleccionar ${item}`}
            >
              {item}
            </button>
          ))}
        </div>

        <button className="primary-button" onClick={() => setLoginOpen(true)}>
          Iniciar sesion
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

function Admin({ session, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState('orders');
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState(() => adminSeedClients);
  const [prices, setPrices] = useState(() => adminSeedPrices);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    api.adminSummary(session.token).then(setSummary).catch(console.error);
    api.orders(session.token).then((payload) => setOrders(payload.pedidos)).catch(console.error);
    api.adminCatalog(session.token).then((payload) => {
      setCatalog(payload);
      setProducts(payload.productos.map((product, index) => ({ ...product, posicion: product.posicion || index + 1, visible: product.visible !== false })));
      setBrands(payload.marcas || []);
      setCategories(payload.categorias || []);
    }).catch(console.error);
  }, [session.token]);

  if (!summary || !catalog) return <Loading label="Cargando panel admin" />;

  const displayOrders = orders.length ? orders : adminSeedOrders;
  const pending = displayOrders.filter((order) => order.estado === 'pendiente').length || 3;
  const preparing = displayOrders.filter((order) => order.estado === 'preparando').length || 2;

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

  function saveClient(payload) {
    setClients((current) => {
      if (payload.id) return current.map((client) => (client.id === payload.id ? { ...client, ...payload } : client));
      return [{ ...payload, id: Date.now(), activo: true, iniciales: initials(payload.nombre || 'Cliente') }, ...current];
    });
    setEditor(null);
  }

  function savePrice(payload) {
    setPrices((current) => {
      if (payload.id) return current.map((price) => (price.id === payload.id ? { ...price, ...payload } : price));
      return [{ ...payload, id: Date.now() }, ...current];
    });
    setEditor(null);
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
      setSummary((current) => ({ ...current, tenant: saved.tenant }));
    } catch {
      setSummary((current) => ({ ...current, tenant: { ...current.tenant, ...nextPayload } }));
    } finally {
      setEditor(null);
    }
  }

  return (
    <div className="admin-mobile-shell">
      <header className="admin-mobile-topbar">
        <button className="admin-brand-button" onClick={() => setEditor({ type: 'site', title: 'Configuracion del sitio', value: summary.tenant })}>
          <span className="logo-mark"><b>K</b><small>KOLBEN</small></span>
          <span><strong>KOLBEN</strong><small>Panel Admin</small></span>
        </button>
        <button className="admin-logo-button" onClick={() => setEditor({ type: 'site', title: 'Configuracion del sitio', value: summary.tenant })}>
          <Image size={14} /> Logo
        </button>
        <button className="admin-exit-button" onClick={onLogout}>Salir</button>
      </header>

      <main className="admin-mobile-page">
        {tab === 'orders' && (
          <AdminOrdersSection
            orders={displayOrders}
            pending={pending}
            preparing={preparing}
            onState={(id, estado) => setOrders((current) => current.map((order) => (order.id === id ? { ...order, estado } : order)))}
            onDelete={(id) => setOrders((current) => current.filter((order) => order.id !== id))}
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
            onToggle={(client) => setClients((current) => current.map((item) => (item.id === client.id ? { ...item, activo: !item.activo } : item)))}
          />
        )}

        {tab === 'prices' && (
          <AdminPricesSection
            prices={prices}
            onNew={() => setEditor({ type: 'price', title: 'Nuevo precio', value: {} })}
            onEdit={(price) => setEditor({ type: 'price', title: 'Editar precios', value: price })}
          />
        )}
      </main>

      <AdminBottomNav tab={tab} setTab={setTab} pending={pending} />

      {editor && (
        <AdminEditor
          editor={editor}
          brands={brands}
          categories={categories}
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

const adminSeedOrders = [
  { id: 9041, numero: '#9041', cliente_nombre: 'Repuestos Garcia', estado: 'pendiente', fecha_label: 'Hoy 3:45 pm', total: 3850 },
  { id: 9040, numero: '#9040', cliente_nombre: 'Dist. Ramirez', estado: 'pendiente', fecha_label: 'Hoy 1:12 pm', total: 1200 },
  { id: 9039, numero: '#9039', cliente_nombre: 'Auto Partes Sosa', estado: 'preparando', fecha_label: 'Ayer 4:30 pm', total: 5640 },
  { id: 9037, numero: '#9037', cliente_nombre: 'Taller El Buen Precio', estado: 'enviado', fecha_label: '21/05/2026', total: 890 }
];

const adminSeedClients = [
  { id: 1, nombre: 'Repuestos Garcia', usuario: 'rgarcia', lista: 'Lista A', credito: '60 dias', tipo: 'ISV · Multi-sucursal', acceso: 'iPhone · Hoy 3:45 pm · Tegucigalpa', iniciales: 'RG', activo: true },
  { id: 2, nombre: 'Dist. Ramirez', usuario: 'dramirez', lista: 'Lista B', credito: '30 dias', tipo: 'Estandar', acceso: 'Chrome · Hoy 1:12 pm · SPS', iniciales: 'DR', activo: true },
  { id: 3, nombre: 'Auto Partes Sosa', usuario: 'apsosa', lista: 'Lista A', credito: '30 dias', tipo: 'ISV', acceso: 'Android · Ayer 4:30 pm', iniciales: 'AP', activo: true },
  { id: 4, nombre: 'Taller El Buen Precio', usuario: 'tbprecio', lista: 'Lista C', credito: '30 dias', tipo: 'Estandar', acceso: 'Chrome · Hace 5 dias', iniciales: 'TB', activo: false }
];

const adminSeedPrices = [
  { id: 1, numero: 1, cliente: 'Auto Rep. Navarro', contacto: '9832-1315', credito: '60d', mFrenos: 720, mFrGrande: 820, mClutch: 420, pMes: 8, pAno: 62, lMes: 24800, lAno: '192k' },
  { id: 2, numero: 2, cliente: 'Auto Rep. OYM', contacto: '9572-5106', credito: '30d', mFrenos: 720, mFrGrande: 820, mClutch: 405, pMes: 5, pAno: 38, lMes: 15400, lAno: '118k' },
  { id: 7, numero: 7, cliente: 'Inv. Y Carwash Tabora', contacto: '9983-8278', credito: '60d', mFrenos: 650, mFrGrande: 750, mClutch: 340, pMes: 3, pAno: 24, lMes: 8200, lAno: '67k' },
  { id: 30, numero: 30, cliente: 'Multi Auto Comayaguela', contacto: '9725-3866', credito: '30d', mFrenos: 710, mFrGrande: 810, mClutch: 360, pMes: 1, pAno: 9, lMes: 890, lAno: '22k' }
];

function AdminOrdersSection({ orders, pending, preparing, onState, onDelete }) {
  return (
    <>
      <AdminSectionTitle title="Pedidos" subtitle="Gestiona los pedidos recibidos" />
      <div className="admin-stat-grid">
        <AdminStat value={pending} label="Pendientes" tone="orange" />
        <AdminStat value={preparing} label="Preparando" tone="blue" />
        <AdminStat value="5" label="Enviados hoy" tone="green" />
        <AdminStat value="38" label="Pedidos" helper="mes 50 año" />
      </div>
      <div className="admin-order-list">
        {orders.map((order) => (
          <article className="admin-order-card" key={order.id}>
            <div className="admin-order-main">
              <span>Pedido</span>
              <strong>{order.cliente_nombre || 'Cliente mayorista'}</strong>
              <small>{order.fecha_label || new Date(order.fecha).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })} · {money(order.total)}</small>
            </div>
            <b className={`admin-state ${order.estado}`}>• {stateLabel(order.estado)}</b>
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
        <div><span>Cliente</span><span>P/mes</span><span>P/año</span><span>L./mes</span><span>L./año</span></div>
        {adminSeedPrices.map((row) => (
          <button key={row.id}>
            <strong>{row.cliente.replace('Auto Rep. Navarro', 'Repuestos Garcia').replace('Auto Rep. OYM', 'Auto Partes Sosa').replace('Inv. Y Carwash Tabora', 'Dist. Ramirez').replace('Multi Auto Comayaguela', 'Taller El Buen Precio')}</strong>
            <b>{row.pMes}</b><b>{row.pAno}</b><b>{Number(row.lMes).toLocaleString('es-HN')}</b><span>{row.lAno}</span>
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

function AdminPricesSection({ prices, onNew, onEdit }) {
  return (
    <>
      <div className="admin-title-row">
        <AdminSectionTitle title="Clientes y precios" subtitle="Todos los clientes con sus precios y condiciones" />
        <button className="admin-new-button" onClick={onNew}><Plus size={13} /> Nuevo</button>
      </div>
      <div className="admin-price-card">
        <table>
          <thead><tr><th>#</th><th>Cliente</th><th>Contacto</th><th>Credito</th><th>M.Frenos</th><th>M.Fr.Grande</th><th>M.Clutch</th></tr></thead>
          <tbody>
            {prices.map((price) => (
              <tr key={price.id} onClick={() => onEdit(price)}>
                <td>{price.numero}</td><td>{price.cliente}</td><td>{price.contacto}</td><td><span>{price.credito}</span></td><td>{price.mFrenos}</td><td>{price.mFrGrande}</td><td>{price.mClutch}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Toca una fila para editar · Desliza para ver todos los precios</p>
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

function AdminEditor({ editor, brands, categories, onClose, onSaveProduct, onSaveClient, onSavePrice, onSaveBrand, onSaveCategory, onSaveSite, onDeleteBrand, onDeleteCategory }) {
  const [form, setForm] = useState(() => ({ ...editor.value }));
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    if (editor.type === 'product') await onSaveProduct(form);
    if (editor.type === 'client') onSaveClient(form);
    if (editor.type === 'price') onSavePrice(form);
    if (editor.type === 'site') await onSaveSite(form);
  }

  return (
    <div className="admin-modal-backdrop">
      <section className="admin-modal">
        <header><h2>{editor.title}</h2><button onClick={onClose}><X size={18} /></button></header>

        {editor.type === 'site' && (
          <div className="admin-form">
            <label>Logo de la empresa<input type="file" accept="image/*" onChange={(event) => update('logoFile', event.target.files?.[0])} /></label>
            <label>Color primario<input type="color" value={form.color_primario || '#F5C200'} onChange={(event) => update('color_primario', event.target.value)} /></label>
            <label>Color secundario<input type="color" value={form.color_secundario || '#111111'} onChange={(event) => update('color_secundario', event.target.value)} /></label>
            <label>Fuente<input value={form.fuente || ''} onChange={(event) => update('fuente', event.target.value)} /></label>
          </div>
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
            <label>Usuario<input value={form.usuario || ''} onChange={(event) => update('usuario', event.target.value)} /></label>
            <label>Lista<input value={form.lista || ''} onChange={(event) => update('lista', event.target.value)} /></label>
            <label>Credito<input value={form.credito || ''} onChange={(event) => update('credito', event.target.value)} /></label>
            <label>Tipo<input value={form.tipo || ''} onChange={(event) => update('tipo', event.target.value)} /></label>
          </div>
        )}

        {editor.type === 'price' && (
          <div className="admin-form">
            <label>Cliente<input value={form.cliente || ''} onChange={(event) => update('cliente', event.target.value)} /></label>
            <label>Contacto<input value={form.contacto || ''} onChange={(event) => update('contacto', event.target.value)} /></label>
            <label>Credito<input value={form.credito || ''} onChange={(event) => update('credito', event.target.value)} /></label>
            <label>M.Frenos<input type="number" value={form.mFrenos || ''} onChange={(event) => update('mFrenos', Number(event.target.value))} /></label>
            <label>M.Fr.Grande<input type="number" value={form.mFrGrande || ''} onChange={(event) => update('mFrGrande', Number(event.target.value))} /></label>
            <label>M.Clutch<input type="number" value={form.mClutch || ''} onChange={(event) => update('mClutch', Number(event.target.value))} /></label>
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

function SuperAdmin({ token }) {
  const [session] = useState(() => loadSession());
  const [tenants, setTenants] = useState(null);
  const [nombre, setNombre] = useState('Nueva Empresa');
  const [slug, setSlug] = useState('nueva-empresa');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.superadminTenants(token)
      .then((payload) => setTenants(payload.tenants))
      .catch((err) => setError(err.message));
  }, [token]);

  async function createTenant(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await api.superadminCreateTenant(token, { nombre, slug });
      setTenants((current) => [created.tenant, ...(current || [])]);
      setNombre('');
      setSlug('');
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

  return (
    <section className="superadmin-page">
      <section className="superadmin-box">
        <div className="superadmin-head">
          <h1>Empresas</h1>
          <span className="status-pill">Control central SaaS</span>
        </div>

        <form className="superadmin-form" onSubmit={createTenant}>
          <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="KOLBEN HONDURAS" /></label>
          <label>Slug<input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="kolben" /></label>
          {error && <small className="form-error">{error}</small>}
          <button className="primary-button" disabled={saving || !nombre || !slug}>{saving ? 'Creando...' : 'Crear empresa'}</button>
        </form>

        {!tenants && <Loading label="Cargando empresas" />}

        {tenants && (
          <div className="superadmin-grid">
            {tenants.map((tenant) => (
              <article className="tenant-card" key={tenant.id}>
                <div className="tenant-card-head">
                  <strong>{tenant.slug}</strong>
                  <b className={tenant.activa ? 'tenant-state on' : 'tenant-state off'}>{tenant.activa ? 'Activa' : 'Suspendida'}</b>
                </div>
                <p>{tenant.nombre}</p>
                <small>{tenant.slug}.catalogohn.com</small>
                <button className="secondary-button" type="button" onClick={() => toggleActive(tenant)}>
                  {tenant.activa ? 'Suspender' : 'Activar'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="superadmin-footer">
        <strong>Kolben</strong>
        <span>kolben.catalogohn.com</span>
      </section>
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

import { mockCatalog, mockOrders, mockPasswords, mockTenant, mockUsers } from './mock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const DEFAULT_TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'kolben';
let activeTenantSlug = DEFAULT_TENANT_SLUG;
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const LOGIN_ALIASES = {
  cliente1: 'cliente1@autorepuestos.com',
  admin: 'admin@kolben.com',
  superadmin: 'superadmin@catalogohn.com'
};
let demoTenantSeq = 2;
let demoAdminSeq = 2;
let demoTenants = [{ ...mockTenant, subnombre: 'Repuestos mayoristas' }];
const demoAdminsByTenant = {
  1: [{ id: 1, empresa_id: 1, nombre: 'Administrador Kolben', username: 'admin', email: 'admin@kolben.com', rol: 'admin', created_at: new Date().toISOString() }]
};
const demoAdminPasswordsById = {
  1: 'KolbenAdminPassword123'
};

function slugifyTenant(name) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || `empresa-${Date.now().toString().slice(-4)}`;
}

function uniqueDemoSlug(base) {
  const existing = new Set(demoTenants.map((tenant) => tenant.slug));
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function resolveDemoLogin(loginValue, tenantSlug) {
  if (loginValue === 'superadmin@catalogohn.com' || loginValue === 'superadmin') {
    return { user: mockUsers['superadmin@catalogohn.com'], password: mockPasswords['superadmin@catalogohn.com'], tenant: mockTenant };
  }

  const tenant = demoTenants.find((item) => item.slug === tenantSlug);
  if (!tenant) return null;
  const admins = demoAdminsByTenant[tenant.id] || [];
  const normalizedLogin = String(loginValue || '').trim().toLowerCase();
  const matchedAdmin = admins.find((admin) => {
    const username = String(admin.username || '').trim().toLowerCase();
    const email = String(admin.email || '').trim().toLowerCase();
    return username === normalizedLogin || email === normalizedLogin;
  });
  if (!matchedAdmin) return null;

  return { user: matchedAdmin, password: demoAdminPasswordsById[matchedAdmin.id], tenant };
}

function currentDemoTenant() {
  return demoTenants.find((tenant) => tenant.slug === activeTenantSlug) || mockTenant;
}

function headers(token) {
  return {
    'Content-Type': 'application/json',
    'x-tenant-slug': activeTenantSlug,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function authHeaders(token) {
  return {
    'x-tenant-slug': activeTenantSlug,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(path, options = {}) {
  if (DEMO_MODE) {
    throw new Error('Modo demo activo');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers(options.token), ...(options.headers || {}) }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error de conexion' }));
    const requestError = new Error(error.message || 'Error de conexion');
    requestError.status = response.status;
    throw requestError;
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  setTenantSlug: (slug) => {
    activeTenantSlug = String(slug || '').trim() || DEFAULT_TENANT_SLUG;
  },
  login: async (credentials) => {
    const loginId = String(credentials.username || credentials.email || '').trim().toLowerCase();
    const email = LOGIN_ALIASES[loginId] || loginId;
    const loginTenantSlug = String(credentials.tenantSlug || '').trim() || activeTenantSlug;
    const payload = { email, username: loginId, password: credentials.password };
    try {
      const result = await request('/auth/login', { method: 'POST', body: JSON.stringify(payload), headers: { 'x-tenant-slug': loginTenantSlug } });
      activeTenantSlug = result?.tenant?.slug || loginTenantSlug;
      return result;
    } catch (error) {
      if (error.status) throw error;
      const demoLogin = resolveDemoLogin(email, loginTenantSlug) || resolveDemoLogin(loginId, loginTenantSlug);
      if (!demoLogin || credentials.password !== demoLogin.password) throw error;
      activeTenantSlug = demoLogin.tenant?.slug || loginTenantSlug;
      return { token: 'demo-token', user: demoLogin.user, tenant: demoLogin.tenant, mode: 'local-demo' };
    }
  },
  publicTenants: async () => {
    try {
      return await request('/tenants/public');
    } catch {
      return { tenants: demoTenants.filter((tenant) => tenant.activa !== false), mode: 'local-demo' };
    }
  },
  catalog: async (token) => {
    try {
      return await request('/catalog', { token });
    } catch {
      const tenant = currentDemoTenant();
      if (tenant.slug === mockTenant.slug) {
        return { ...mockCatalog, mode: 'local-demo' };
      }
      return {
        tenant,
        marcas: [],
        categorias: [],
        productos: [],
        sucursales: [],
        mode: 'local-demo'
      };
    }
  },
  orders: async (token) => {
    try {
      return await request('/orders', { token });
    } catch {
      if (activeTenantSlug !== mockTenant.slug) return { pedidos: [], mode: 'local-demo' };
      return { pedidos: mockOrders, mode: 'local-demo' };
    }
  },
  createOrder: async (token, items) => {
    try {
      return await request('/orders', { method: 'POST', token, body: JSON.stringify({ items }) });
    } catch {
      return { pedido: { id: Date.now(), numero: `PED-${Date.now().toString().slice(-6)}`, estado: 'pendiente', items }, mode: 'local-demo' };
    }
  },
  adminSummary: async (token) => {
    try {
      return await request('/admin/summary', { token });
    } catch {
      const tenant = currentDemoTenant();
      if (tenant.slug !== mockTenant.slug) {
        return {
          totals: { productos: 0, clientes: 0, pedidos: 0 },
          accesos: [],
          tenant,
          mode: 'local-demo'
        };
      }
      return {
        totals: { productos: mockCatalog.productos.length, clientes: 1, pedidos: mockOrders.length },
        accesos: [
          {
            nombre: 'Auto Repuestos El Centro',
            email: 'cliente1@autorepuestos.com',
            fecha: new Date().toISOString(),
            ip: '190.0.0.10',
            user_agent: 'iPhone / Safari',
            geolocalizacion: 'Tegucigalpa, Honduras'
          }
        ],
        tenant,
        mode: 'local-demo'
      };
    }
  },
  adminCatalog: async (token) => {
    try {
      return await request('/admin/catalog', { token });
    } catch {
      const tenant = currentDemoTenant();
      if (tenant.slug !== mockTenant.slug) {
        return { tenant, marcas: [], categorias: [], productos: [], sucursales: [], mode: 'local-demo' };
      }
      return { ...mockCatalog, mode: 'local-demo' };
    }
  },
  adminClients: async (token) => {
    return request('/admin/clients', { token });
  },
  adminSaveClient: async (token, client) => {
    const path = client.id ? `/admin/clients/${client.id}` : '/admin/clients';
    const method = client.id ? 'PATCH' : 'POST';
    return request(path, { method, token, body: JSON.stringify(client) });
  },
  adminSetClientActive: async (token, id, activo) => {
    return request(`/admin/clients/${id}/status`, { method: 'PATCH', token, body: JSON.stringify({ activo }) });
  },
  adminPriceLists: async (token) => {
    return request('/admin/price-lists', { token });
  },
  adminPrices: async (token) => {
    return request('/admin/prices', { token });
  },
  adminSavePriceList: async (token, list) => {
    const path = list.id ? `/admin/price-lists/${list.id}` : '/admin/price-lists';
    const method = list.id ? 'PATCH' : 'POST';
    return request(path, { method, token, body: JSON.stringify(list) });
  },
  adminSaveListPrices: async (token, listId, precios) => {
    return request(`/admin/price-lists/${listId}/prices`, { method: 'PUT', token, body: JSON.stringify({ precios }) });
  },
  adminSaveProduct: async (token, product) => {
    const path = product.id ? `/admin/products/${product.id}` : '/admin/products';
    const method = product.id ? 'PATCH' : 'POST';
    return request(path, { method, token, body: JSON.stringify(product) });
  },
  adminDeleteProduct: async (token, id) => {
    return request(`/admin/products/${id}`, { method: 'DELETE', token });
  },
  adminSaveBrand: async (token, brand) => {
    const path = brand.id ? `/admin/brands/${brand.id}` : '/admin/brands';
    const method = brand.id ? 'PATCH' : 'POST';
    return request(path, { method, token, body: JSON.stringify(brand) });
  },
  adminDeleteBrand: async (token, id) => {
    return request(`/admin/brands/${id}`, { method: 'DELETE', token });
  },
  adminSaveCategory: async (token, category) => {
    const path = category.id ? `/admin/categories/${category.id}` : '/admin/categories';
    const method = category.id ? 'PATCH' : 'POST';
    return request(path, { method, token, body: JSON.stringify(category) });
  },
  adminDeleteCategory: async (token, id) => {
    return request(`/admin/categories/${id}`, { method: 'DELETE', token });
  },
  adminUploadImage: async (token, file, purpose = 'product') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('purpose', purpose);
    const response = await fetch(`${API_URL}/admin/uploads`, {
      method: 'POST',
      headers: authHeaders(token),
      body: formData
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'No se pudo subir la imagen' }));
      throw new Error(error.message || 'No se pudo subir la imagen');
    }
    return response.json();
  },
  adminUpdateSite: async (token, payload) => {
    return request('/admin/brand', { method: 'PATCH', token, body: JSON.stringify(payload) });
  },
  updateOrderStatus: async (token, id, estado) => {
    try {
      return await request(`/orders/${id}/status`, { method: 'PATCH', token, body: JSON.stringify({ estado, confirmacion: 'CONFIRMAR' }) });
    } catch {
      return { pedido: { id, estado }, mode: 'local-demo' };
    }
  },
  deleteOrder: async (token, id) => {
    try {
      return await request(`/orders/${id}`, { method: 'DELETE', token, body: JSON.stringify({ confirmacion: 'ELIMINAR' }) });
    } catch {
      return null;
    }
  },
  superadminTenants: async (token) => {
    try {
      return await request('/superadmin/tenants', { token });
    } catch (error) {
      if (error.status) throw error;
      return { tenants: demoTenants, mode: 'local-demo' };
    }
  },
  superadminCreateTenant: async (token, payload) => {
    try {
      return await request('/superadmin/tenants', { method: 'POST', token, body: JSON.stringify(payload) });
    } catch (error) {
      if (error.status) throw error;
      const slug = uniqueDemoSlug(slugifyTenant(payload?.nombre));
      const tenant = {
        id: demoTenantSeq++,
        nombre: String(payload?.nombre || '').trim(),
        subnombre: String(payload?.subnombre || '').trim(),
        slug,
        logo_url: '',
        color_primario: '#fac400',
        color_secundario: '#111111',
        fuente: 'Aptos',
        activa: true,
        created_at: new Date().toISOString()
      };
      demoTenants = [tenant, ...demoTenants];
      demoAdminsByTenant[tenant.id] = [];
      return { tenant, mode: 'local-demo' };
    }
  },
  superadminSetTenantActive: async (token, id, activa) => {
    try {
      return await request(`/superadmin/tenants/${id}`, { method: 'PATCH', token, body: JSON.stringify({ activa }) });
    } catch (error) {
      if (error.status) throw error;
      const tenantId = Number(id);
      demoTenants = demoTenants.map((tenant) => (tenant.id === tenantId ? { ...tenant, activa: Boolean(activa) } : tenant));
      return { tenant: demoTenants.find((tenant) => tenant.id === tenantId), mode: 'local-demo' };
    }
  },
  superadminAdmins: async (token, tenantId) => {
    try {
      return await request(`/superadmin/tenants/${tenantId}/admins`, { token });
    } catch (error) {
      if (error.status) throw error;
      const id = Number(tenantId);
      const tenant = demoTenants.find((item) => item.id === id);
      return { tenant, admins: demoAdminsByTenant[id] || [], mode: 'local-demo' };
    }
  },
  superadminCreateAdmin: async (token, tenantId, payload) => {
    try {
      return await request(`/superadmin/tenants/${tenantId}/admins`, { method: 'POST', token, body: JSON.stringify(payload) });
    } catch (error) {
      if (error.status) throw error;
      const id = Number(tenantId);
      const tenant = demoTenants.find((item) => item.id === id) || { slug: 'empresa' };
      const username = String(payload?.username || '').trim().toLowerCase();
      const admin = {
        id: demoAdminSeq++,
        empresa_id: id,
        nombre: String(payload?.nombre || '').trim(),
        username,
        email: `${username}@${tenant.slug}.local`,
        rol: 'admin',
        created_at: new Date().toISOString()
      };
      demoAdminPasswordsById[admin.id] = String(payload?.password || '').trim() || 'Tmp1234!';
      const current = demoAdminsByTenant[id] || [];
      demoAdminsByTenant[id] = [admin, ...current];
      return { admin, temp_password: demoAdminPasswordsById[admin.id], mode: 'local-demo' };
    }
  },
  superadminResetAdminPassword: async (token, adminId, payload = {}) => {
    try {
      return await request(`/superadmin/admins/${adminId}/reset-password`, { method: 'POST', token, body: JSON.stringify(payload) });
    } catch (error) {
      if (error.status) throw error;
      demoAdminPasswordsById[Number(adminId)] = String(payload.password || '').trim() || 'Tmp1234!';
      return { temp_password: demoAdminPasswordsById[Number(adminId)], mode: 'local-demo' };
    }
  },
  superadminUpdateAdmin: async (token, adminId, payload) => {
    try {
      return await request(`/superadmin/admins/${adminId}`, { method: 'PATCH', token, body: JSON.stringify(payload) });
    } catch (error) {
      if (error.status) throw error;
      for (const tenantId of Object.keys(demoAdminsByTenant)) {
        const index = (demoAdminsByTenant[tenantId] || []).findIndex((admin) => Number(admin.id) === Number(adminId));
        if (index >= 0) {
          const current = demoAdminsByTenant[tenantId][index];
          const updated = {
            ...current,
            nombre: String(payload?.nombre || current.nombre).trim(),
            username: String(payload?.username || current.username).trim().toLowerCase(),
            email: `${String(payload?.username || current.username).trim().toLowerCase()}@${demoTenants.find((item) => Number(item.id) === Number(tenantId))?.slug || 'empresa'}.local`,
            updated_at: new Date().toISOString()
          };
          if (String(payload?.password || '').trim()) {
            demoAdminPasswordsById[Number(adminId)] = String(payload.password).trim();
          }
          demoAdminsByTenant[tenantId][index] = updated;
          return { admin: updated, mode: 'local-demo' };
        }
      }
      throw new Error('Admin no encontrado');
    }
  },
  superadminDeleteAdmin: async (token, adminId) => {
    try {
      return await request(`/superadmin/admins/${adminId}`, { method: 'DELETE', token });
    } catch (error) {
      if (error.status) throw error;
      for (const tenantId of Object.keys(demoAdminsByTenant)) {
        demoAdminsByTenant[tenantId] = (demoAdminsByTenant[tenantId] || []).filter((admin) => Number(admin.id) !== Number(adminId));
      }
      delete demoAdminPasswordsById[Number(adminId)];
      return null;
    }
  }
};

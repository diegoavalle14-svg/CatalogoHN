function defaultApiUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3001/api';
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3001/api`;
}

function resolveApiUrl() {
  const configuredUrl = String(import.meta.env.VITE_API_URL || '').trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (import.meta.env.PROD) {
    throw new Error('VITE_API_URL es obligatorio para builds de preview/produccion.');
  }
  return defaultApiUrl();
}

const API_URL = resolveApiUrl();
export const API_PUBLIC_ORIGIN = API_URL.replace(/\/api\/?$/, '');
const DEFAULT_TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'kolben';
function storedTenantSlug() {
  if (typeof localStorage === 'undefined') return '';
  try {
    const session = JSON.parse(localStorage.getItem('catalogohn.session'));
    return String(session?.tenant?.slug || '').trim();
  } catch {
    return '';
  }
}

let activeTenantSlug = storedTenantSlug() || DEFAULT_TENANT_SLUG;
const LOGIN_ALIASES = {
  cliente1: 'cliente1@autorepuestos.com',
  admin: 'admin@kolben.com',
  superadmin: 'superadmin@catalogohn.com'
};

function currentTenantSlug() {
  const storedSlug = storedTenantSlug();
  if (storedSlug && activeTenantSlug === DEFAULT_TENANT_SLUG) return storedSlug;
  return activeTenantSlug || storedSlug || DEFAULT_TENANT_SLUG;
}

function headers(token) {
  return {
    'Content-Type': 'application/json',
    'x-tenant-slug': currentTenantSlug(),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function authHeaders(token) {
  return {
    'x-tenant-slug': currentTenantSlug(),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers(options.token), ...(options.headers || {}) }
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('catalogohn.session');
        localStorage.removeItem('catalogohn.uiState');
      }
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
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
    activeTenantSlug = String(slug || '').trim() || storedTenantSlug() || DEFAULT_TENANT_SLUG;
  },
  login: async (credentials) => {
    const loginId = String(credentials.username || credentials.email || '').trim().toLowerCase();
    const email = LOGIN_ALIASES[loginId] || loginId;
    const loginTenantSlug = String(credentials.tenantSlug || '').trim() || currentTenantSlug();
    const payload = { email, username: loginId, password: credentials.password };
    const result = await request('/auth/login', { method: 'POST', body: JSON.stringify(payload), headers: { 'x-tenant-slug': loginTenantSlug } });
    activeTenantSlug = result?.tenant?.slug || loginTenantSlug;
    return result;
  },
  forgotPassword: async (payload) => {
    return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) });
  },
  changePassword: async (token, payload) => {
    return request('/auth/change-password', { method: 'POST', token, body: JSON.stringify(payload) });
  },
  publicTenants: async () => {
    return request('/tenants/public');
  },
  createRegistrationRequest: async (payload) => {
    return request('/registration-requests', { method: 'POST', body: JSON.stringify(payload) });
  },
  catalog: async (token) => {
    return request('/catalog', { token });
  },
  orders: async (token) => {
    return request('/orders', { token });
  },
  createOrder: async (token, items) => {
    return request('/orders', { method: 'POST', token, body: JSON.stringify({ items }) });
  },
  adminSummary: async (token) => {
    return request('/admin/summary', { token });
  },
  adminCatalog: async (token) => {
    return request('/admin/catalog', { token });
  },
  adminClients: async (token) => {
    return request('/admin/clients', { token });
  },
  adminSaveClient: async (token, client) => {
    const path = client.id ? `/admin/clients/${client.id}` : '/admin/clients';
    const method = client.id ? 'PATCH' : 'POST';
    return request(path, { method, token, body: JSON.stringify(client) });
  },
  adminDeleteClient: async (token, id) => {
    return request(`/admin/clients/${id}`, { method: 'DELETE', token });
  },
  adminSetClientActive: async (token, id, activo) => {
    return request(`/admin/clients/${id}/status`, { method: 'PATCH', token, body: JSON.stringify({ activo }) });
  },
  adminClientLogout: async (token, id) => {
    return request(`/admin/clients/${id}/logout`, { method: 'POST', token });
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
  adminSyncPriceList: async (token, listId) => {
    return request(`/admin/price-lists/${listId}/sync`, { method: 'POST', token });
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
    return request(`/orders/${id}/status`, { method: 'PATCH', token, body: JSON.stringify({ estado, confirmacion: 'CONFIRMAR' }) });
  },
  updateOrderItems: async (token, id, items) => {
    return request(`/orders/${id}`, { method: 'PUT', token, body: JSON.stringify({ items }) });
  },
  deleteOrder: async (token, id) => {
    return request(`/orders/${id}`, { method: 'DELETE', token, body: JSON.stringify({ confirmacion: 'ELIMINAR' }) });
  },
  superadminTenants: async (token) => {
    return request('/superadmin/tenants', { token });
  },
  superadminSubnames: async (token) => {
    return request('/superadmin/subnames', { token });
  },
  superadminCreateSubname: async (token, payload) => {
    return request('/superadmin/subnames', { method: 'POST', token, body: JSON.stringify(payload) });
  },
  superadminUpdateSubname: async (token, id, payload) => {
    return request(`/superadmin/subnames/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: JSON.stringify(payload) });
  },
  superadminDeleteSubname: async (token, id) => {
    return request(`/superadmin/subnames/${encodeURIComponent(id)}`, { method: 'DELETE', token });
  },
  superadminCreateTenant: async (token, payload) => {
    return request('/superadmin/tenants', { method: 'POST', token, body: JSON.stringify(payload) });
  },
  superadminSetTenantActive: async (token, id, activa) => {
    return request(`/superadmin/tenants/${id}`, { method: 'PATCH', token, body: JSON.stringify({ activa }) });
  },
  superadminSetTenantNotifications: async (token, id, notificaciones_activas) => {
    return request(`/superadmin/tenants/${id}`, { method: 'PATCH', token, body: JSON.stringify({ notificaciones_activas }) });
  },
  superadminUpdateTenantEmail: async (token, id, email_notificaciones) => {
    return request(`/superadmin/tenants/${id}`, { method: 'PATCH', token, body: JSON.stringify({ email_notificaciones }) });
  },
  superadminDeleteTenant: async (token, id, confirmacion = 'BORRAR') => {
    return request(`/superadmin/tenants/${id}`, { method: 'DELETE', token, body: JSON.stringify({ confirmacion }) });
  },
  superadminAdmins: async (token, tenantId) => {
    return request(`/superadmin/tenants/${tenantId}/admins`, { token });
  },
  superadminOpenAdminSession: async (token, tenantId) => {
    return request(`/superadmin/tenants/${tenantId}/open-admin`, { method: 'POST', token });
  },
  superadminCreateAdmin: async (token, tenantId, payload) => {
    return request(`/superadmin/tenants/${tenantId}/admins`, { method: 'POST', token, body: JSON.stringify(payload) });
  },
  superadminResetAdminPassword: async (token, adminId, payload = {}) => {
    return request(`/superadmin/admins/${adminId}/reset-password`, { method: 'POST', token, body: JSON.stringify(payload) });
  },
  superadminUpdateAdmin: async (token, adminId, payload) => {
    return request(`/superadmin/admins/${adminId}`, { method: 'PATCH', token, body: JSON.stringify(payload) });
  },
  superadminDeleteAdmin: async (token, adminId) => {
    return request(`/superadmin/admins/${adminId}`, { method: 'DELETE', token });
  }
};

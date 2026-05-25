import { mockCatalog, mockOrders, mockPasswords, mockTenant, mockUsers } from './mock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'kolben';
const LOGIN_ALIASES = {
  cliente1: 'cliente1@autorepuestos.com',
  admin: 'admin@kolben.com',
  superadmin: 'superadmin@catalogohn.com'
};

function headers(token) {
  return {
    'Content-Type': 'application/json',
    'x-tenant-slug': TENANT_SLUG,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(path, options = {}) {
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
  login: async (credentials) => {
    const loginId = String(credentials.username || credentials.email || '').trim().toLowerCase();
    const email = LOGIN_ALIASES[loginId] || loginId;
    const payload = { email, username: loginId, password: credentials.password };
    try {
      return await request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    } catch (error) {
      if (error.status) throw error;
      const user = mockUsers[email];
      const password = mockPasswords[email];
      if (!user || credentials.password !== password) throw error;
      return { token: 'demo-token', user, tenant: mockTenant, mode: 'local-demo' };
    }
  },
  catalog: async (token) => {
    try {
      return await request('/catalog', { token });
    } catch {
      return { ...mockCatalog, mode: 'local-demo' };
    }
  },
  orders: async (token) => {
    try {
      return await request('/orders', { token });
    } catch {
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
        tenant: mockTenant,
        mode: 'local-demo'
      };
    }
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
      return { tenants: [mockTenant], mode: 'local-demo' };
    }
  },
  superadminCreateTenant: async (token, payload) => {
    return request('/superadmin/tenants', { method: 'POST', token, body: JSON.stringify(payload) });
  },
  superadminSetTenantActive: async (token, id, activa) => {
    return request(`/superadmin/tenants/${id}`, { method: 'PATCH', token, body: JSON.stringify({ activa }) });
  }
};

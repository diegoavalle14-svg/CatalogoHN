const bcrypt = require('bcryptjs');

const empresa = {
  id: 1,
  nombre: 'KOLBEN HONDURAS',
  slug: 'kolben',
  logo_url: '',
  color_primario: '#F5C200',
  color_secundario: '#111111',
  fuente: 'Barlow',
  activa: true
};

const marcas = [
  { id: 1, empresa_id: 1, nombre: 'KOLBEN', logo_url: '', posicion: 1 },
  { id: 2, empresa_id: 1, nombre: 'FIC', logo_url: '', posicion: 2 },
  { id: 3, empresa_id: 1, nombre: 'SMC', logo_url: '', posicion: 3 },
  { id: 4, empresa_id: 1, nombre: 'LPR', logo_url: '', posicion: 4 }
];

const categorias = [
  { id: 1, empresa_id: 1, nombre: 'Bomba de Freno', color: '#E74C3C' },
  { id: 2, empresa_id: 1, nombre: 'Bomba de Clutch', color: '#3498DB' },
  { id: 3, empresa_id: 1, nombre: 'Cilindro de Freno', color: '#2ECC71' },
  { id: 4, empresa_id: 1, nombre: 'Cilindro de Clutch', color: '#F39C12' }
];

const productos = [
  {
    id: 1,
    empresa_id: 1,
    marca_id: 1,
    categoria_id: 1,
    sku: 'BF-3129',
    descripcion: 'Bomba de Freno Principal con Deposito',
    specs: { medida: '15/16"', aplicacion: 'Toyota Corolla AE100 1.6L (1993 - 1997)', origen: 'Japon', material: 'Aluminio' },
    visible: true,
    en_promocion: true,
    posicion: 1,
    imagenes: ['/kolben-part.svg'],
    precios: { mayorista: 1250, promocion: 1050 }
  },
  {
    id: 2,
    empresa_id: 1,
    marca_id: 1,
    categoria_id: 2,
    sku: 'BC-4211',
    descripcion: 'Bomba de Clutch Superior',
    specs: { medida: '5/8"', aplicacion: 'Nissan Frontier D22 TD27 (1998 - 2005)', origen: 'Japon', material: 'Hierro' },
    visible: true,
    en_promocion: false,
    posicion: 2,
    imagenes: ['/kolben-part.svg'],
    precios: { mayorista: 850 }
  },
  {
    id: 3,
    empresa_id: 1,
    marca_id: 2,
    categoria_id: 3,
    sku: 'CF-6802',
    descripcion: 'Cilindro de Rueda Auxiliar Trasero',
    specs: { medida: '11/16"', aplicacion: 'Toyota Hilux 4x4 KUN25 (2005 - 2015)', origen: 'Taiwan', lado: 'Derecho / Izquierdo' },
    visible: true,
    en_promocion: false,
    posicion: 3,
    imagenes: ['/kolben-part.svg'],
    precios: { mayorista: 450 }
  },
  {
    id: 4,
    empresa_id: 1,
    marca_id: 4,
    categoria_id: 1,
    sku: 'BF-7210',
    descripcion: 'Bomba de Freno Principal',
    specs: { medida: '7/8"', aplicacion: 'Hyundai Elantra MD 1.8L (2011 - 2016)', origen: 'Corea' },
    visible: true,
    en_promocion: true,
    posicion: 4,
    imagenes: ['/kolben-part.svg'],
    precios: { mayorista: 1680, promocion: 1490 }
  }
];

const usuarios = [
  {
    id: 1,
    empresa_id: null,
    nombre: 'Super Administrador',
    email: 'superadmin@catalogohn.com',
    password_hash: bcrypt.hashSync('SuperAdminPassword123', 10),
    rol: 'superadmin'
  },
  {
    id: 2,
    empresa_id: 1,
    nombre: 'Administrador Kolben',
    email: 'admin@kolben.com',
    password_hash: bcrypt.hashSync('KolbenAdminPassword123', 10),
    rol: 'admin'
  },
  {
    id: 3,
    empresa_id: 1,
    nombre: 'Auto Repuestos El Centro',
    email: 'cliente1@autorepuestos.com',
    password_hash: bcrypt.hashSync('ClientPassword123', 10),
    rol: 'cliente',
    cliente_id: 1,
    condicion_credito: 'Credito 30 Dias'
  }
];

const sucursales = [
  { id: 1, cliente_id: 1, nombre: 'Sucursal Centro', direccion: 'San Pedro Sula' },
  { id: 2, cliente_id: 1, nombre: 'Sucursal Circunvalacion', direccion: 'San Pedro Sula' },
  { id: 3, cliente_id: 1, nombre: 'Sucursal Taller Norte', direccion: 'Choloma' }
];

let pedidos = [
  {
    id: 1,
    empresa_id: 1,
    cliente_id: 1,
    numero: 'PED-10001',
    estado: 'pendiente',
    total: 2600,
    isv: 339.13,
    fecha: new Date(Date.now() - 86400000).toISOString(),
    items: [
      { producto_id: 2, sku: 'BC-4211', descripcion: 'Bomba de Clutch Superior', sucursal_id: 1, sucursal: 'Sucursal Centro', cantidad: 2, precio_unitario: 850 },
      { producto_id: 3, sku: 'CF-6802', descripcion: 'Cilindro de Rueda Auxiliar Trasero', sucursal_id: 2, sucursal: 'Sucursal Circunvalacion', cantidad: 2, precio_unitario: 450 }
    ]
  }
];

module.exports = {
  empresa,
  marcas,
  categorias,
  productos,
  usuarios,
  sucursales,
  get pedidos() {
    return pedidos;
  },
  addPedido(pedido) {
    pedidos = [pedido, ...pedidos];
    return pedido;
  },
  updatePedido(id, changes) {
    pedidos = pedidos.map((pedido) => (pedido.id === id ? { ...pedido, ...changes } : pedido));
    return pedidos.find((pedido) => pedido.id === id);
  },
  deletePedido(id) {
    pedidos = pedidos.filter((pedido) => pedido.id !== id);
  }
};

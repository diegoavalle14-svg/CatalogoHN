export const mockTenant = {
  id: 1,
  nombre: 'KOLBEN HONDURAS',
  subnombre: 'Repuestos mayoristas',
  slug: 'kolben',
  color_primario: '#F5C200',
  color_secundario: '#111111',
  fuente: 'Barlow',
  activa: true
};

export const mockUsers = {
  'cliente1@autorepuestos.com': {
    id: 3,
    empresa_id: 1,
    nombre: 'Auto Repuestos El Centro',
    email: 'cliente1@autorepuestos.com',
    rol: 'cliente',
    cliente_id: 1,
    condicion_credito: 'Credito 30 Dias'
  },
  'admin@kolben.com': {
    id: 2,
    empresa_id: 1,
    nombre: 'Administrador Kolben',
    email: 'admin@kolben.com',
    rol: 'admin'
  },
  'superadmin@catalogohn.com': {
    id: 1,
    empresa_id: null,
    nombre: 'Super Administrador',
    email: 'superadmin@catalogohn.com',
    rol: 'superadmin'
  }
};

export const mockPasswords = {
  'cliente1@autorepuestos.com': 'ClientPassword123',
  'admin@kolben.com': 'KolbenAdminPassword123',
  'superadmin@catalogohn.com': 'SuperAdminPassword123'
};

export const mockCatalog = {
  tenant: mockTenant,
  marcas: [
    { id: 1, nombre: 'KOLBEN', logo_url: '', posicion: 1 },
    { id: 2, nombre: 'FIC', logo_url: '', posicion: 2 },
    { id: 3, nombre: 'SMC', logo_url: '', posicion: 3 },
    { id: 4, nombre: 'LPR', logo_url: '', posicion: 4 }
  ],
  categorias: [
    { id: 1, nombre: 'Bomba de Freno', color: '#E74C3C' },
    { id: 2, nombre: 'Bomba de Clutch', color: '#3498DB' },
    { id: 3, nombre: 'Cilindro de Freno', color: '#2ECC71' }
  ],
  sucursales: [
    { id: 1, nombre: 'Sucursal Centro', direccion: 'San Pedro Sula' },
    { id: 2, nombre: 'Sucursal Circunvalacion', direccion: 'San Pedro Sula' },
    { id: 3, nombre: 'Sucursal Taller Norte', direccion: 'Choloma' }
  ],
  productos: [
    {
      id: 1,
      marca_id: 1,
      categoria_id: 1,
      sku: 'BF-3129',
      descripcion: 'Bomba de Freno Principal con Deposito',
      specs: { medida: '15/16"', aplicacion: 'Toyota Corolla AE100 1.6L (1993 - 1997)', origen: 'Japon' },
      visible: true,
      en_promocion: true,
      posicion: 1,
      marca: 'KOLBEN',
      categoria: 'Bomba de Freno',
      imagenes: ['/kolben-part.svg'],
      precio: 1250,
      precio_final: 1050
    },
    {
      id: 2,
      marca_id: 1,
      categoria_id: 2,
      sku: 'BC-4211',
      descripcion: 'Bomba de Clutch Superior',
      specs: { medida: '5/8"', aplicacion: 'Nissan Frontier D22 TD27 (1998 - 2005)', origen: 'Japon' },
      visible: true,
      en_promocion: false,
      posicion: 2,
      marca: 'KOLBEN',
      categoria: 'Bomba de Clutch',
      imagenes: ['/kolben-part.svg'],
      precio: 850,
      precio_final: 850
    },
    {
      id: 3,
      marca_id: 2,
      categoria_id: 3,
      sku: 'CF-6802',
      descripcion: 'Cilindro de Rueda Auxiliar Trasero',
      specs: { medida: '11/16"', aplicacion: 'Toyota Hilux 4x4 KUN25 (2005 - 2015)', origen: 'Taiwan' },
      visible: true,
      en_promocion: false,
      posicion: 3,
      marca: 'FIC',
      categoria: 'Cilindro de Freno',
      imagenes: ['/kolben-part.svg'],
      precio: 450,
      precio_final: 450
    }
  ]
};

export const mockOrders = [
  {
    id: 1,
    numero: 'PED-10001',
    estado: 'pendiente',
    total: 2600,
    fecha: new Date(Date.now() - 86400000).toISOString(),
    cliente_nombre: 'Auto Repuestos El Centro',
    items: [
      { producto_id: 2, sucursal_id: 1, sku: 'BC-4211', descripcion: 'Bomba de Clutch Superior', sucursal: 'Sucursal Centro', cantidad: 2, precio_unitario: 850 },
      { producto_id: 3, sucursal_id: 2, sku: 'CF-6802', descripcion: 'Cilindro de Rueda Auxiliar Trasero', sucursal: 'Sucursal Circunvalacion', cantidad: 2, precio_unitario: 450 }
    ]
  }
];

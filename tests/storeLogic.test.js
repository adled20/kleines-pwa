const {
  calcularTotalCarrito,
  detectarProductosBajosStock,
  construirListaGeneralPedidos,
  agruparPedidosPorProveedor,
  generarEnlaceWhatsAppProveedor,
  calcularResumenCaja,
  procesarAbonoCliente,
  generarEnlaceWhatsAppCobro
} = require('../src/core/storeLogic');

describe('Pruebas Unitarias Kleines PWA (TDD)', () => {
  test('HU-04: Calcula correctamente el total del carrito de compras', () => {
    const carrito = [
      { nombre: 'Arroz 500g', precio: 2800, cantidad: 2 },
      { nombre: 'Aceite 1L', precio: 9500, cantidad: 1 }
    ];
    expect(calcularTotalCarrito(carrito)).toBe(15100);
  });

  test('HU-02: Detecta productos con stock menor o igual al umbral mínimo', () => {
    const productos = [
      { id: '1', nombre: 'Arroz', stock: 20, umbralMinimo: 10 },
      { id: '2', nombre: 'Aceite', stock: 4, umbralMinimo: 5 },
      { id: '3', nombre: 'Huevos', stock: 3, umbralMinimo: 3 }
    ];
    const bajos = detectarProductosBajosStock(productos);
    expect(bajos).toHaveLength(2);
    expect(bajos.map(p => p.id)).toEqual(['2', '3']);
  });

  test('HU-03: Construye Lista General de Faltantes, permite elegir productos/proveedores y arma sublistas WhatsApp', () => {
    const proveedores = [
      { id: 'prov-1', nombre: 'Carlos Pérez', empresa: 'Distribuidora El Sol', telefono: '573001112233' },
      { id: 'prov-2', nombre: 'Marta Ruiz', empresa: 'Lácteos del Caribe', telefono: '573104445566' }
    ];
    const productos = [
      { id: 'p1', nombre: 'Aceite 1L', stock: 2, umbralMinimo: 5, proveedorId: 'prov-1' },
      { id: 'p2', nombre: 'Leche 1L', stock: 1, umbralMinimo: 4, proveedorId: 'prov-2' }
    ];

    const listaGeneral = construirListaGeneralPedidos(productos);
    expect(listaGeneral).toHaveLength(2);
    expect(listaGeneral[0].incluido).toBe(true);

    const seleccionPersonalizada = {
      p1: { incluido: true, cantidad: 12, proveedorId: 'prov-2' },
      p2: { incluido: false }
    };
    const grupos = agruparPedidosPorProveedor(productos, proveedores, seleccionPersonalizada);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].proveedor.id).toBe('prov-2');
    expect(grupos[0].items[0].cantidadSugerida).toBe(12);

    const url = generarEnlaceWhatsAppProveedor(proveedores[1], grupos[0].items, 'Tienda Don Carlos');
    expect(url).toContain('https://wa.me/573104445566?text=');
    expect(decodeURIComponent(url)).toContain('Aceite 1L: pedir 12 unids.');
  });

  test('HU-05: Calcula el dinero físico en caja separando contado, abonos y fiados', () => {
    const ventas = [
      { tipo: 'contado', total: 50000 },
      { tipo: 'fiado', total: 30000 }
    ];
    const abonos = [{ monto: 15000 }];
    const resumen = calcularResumenCaja(ventas, abonos);

    expect(resumen.dineroFisicoEnCaja).toBe(65000);
    expect(resumen.ventasFiado).toBe(30000);
  });

  test('HU-07 y HU-08: Descuenta abonos válidamente, bloquea sobrepagos y genera cobro WhatsApp', () => {
    expect(procesarAbonoCliente(50000, 20000)).toBe(30000);
    expect(() => procesarAbonoCliente(50000, 60000)).toThrow();

    const urlCobro = generarEnlaceWhatsAppCobro({
      nombre: 'Ana María',
      telefono: '573109876543',
      saldoActual: 45000
    });
    expect(urlCobro).toContain('https://wa.me/573109876543?text=');
    expect(decodeURIComponent(urlCobro)).toContain('45.000');
  });
});
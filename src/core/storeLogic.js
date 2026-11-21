/**
 * Módulo Core de Kleines PWA
 * Contiene la lógica pura de ventas, alertas de stock bajo, lista general de faltantes,
 * agrupación automática por proveedores, enlaces de WhatsApp, arqueo de caja, cartera y cobro a morosos.
 */

function calcularTotalCarrito(carrito) {
  if (!Array.isArray(carrito) || carrito.length === 0) return 0;
  return carrito.reduce((acum, item) => acum + (Number(item.precio) * Number(item.cantidad)), 0);
}

function calcularVuelto(total, efectivoRecibido) {
  const totalVenta = Number(total);
  const recibido = Number(efectivoRecibido);
  if (isNaN(recibido) || recibido < totalVenta) {
    throw new Error('El efectivo recibido es insuficiente para cubrir el total de la venta.');
  }
  return recibido - totalVenta;
}

function detectarProductosBajosStock(productos) {
  return productos.filter(p => Number(p.stock) <= Number(p.umbralMinimo));
}

function calcularCantidadSugerida(producto) {
  return Math.max((Number(producto.umbralMinimo) * 2) - Number(producto.stock), 1);
}

/**
 * Construye la Lista General de Pedidos Faltantes combinando los productos bajos en stock
 * con las selecciones personalizadas del usuario (incluido, cantidad a pedir y proveedor destino).
 */
function construirListaGeneralPedidos(productos, seleccionPedidos = {}) {
  const bajos = detectarProductosBajosStock(productos);
  return bajos.map(prod => {
    const config = seleccionPedidos[prod.id] || {};
    const cantidadSugerida = calcularCantidadSugerida(prod);
    return {
      id: prod.id,
      nombre: prod.nombre,
      stockActual: Number(prod.stock),
      umbralMinimo: Number(prod.umbralMinimo),
      incluido: config.incluido !== undefined ? Boolean(config.incluido) : true,
      cantidadPedir: config.cantidad !== undefined && Number(config.cantidad) > 0
        ? Number(config.cantidad)
        : cantidadSugerida,
      proveedorId: config.proveedorId !== undefined ? config.proveedorId : (prod.proveedorId || '')
    };
  });
}

/**
 * Agrupa automáticamente en sublistas por proveedor los productos activos de la Lista General.
 * Compatible tanto con llamada directa (productos, proveedores) como con seleccionPedidos.
 */
function agruparPedidosPorProveedor(productos, proveedores, seleccionPedidos = {}) {
  const listaGeneral = construirListaGeneralPedidos(productos, seleccionPedidos);
  const seleccionados = listaGeneral.filter(item => item.incluido);
  const mapaProveedores = new Map();

  proveedores.forEach(prov => {
    mapaProveedores.set(prov.id, {
      proveedor: prov,
      items: []
    });
  });

  // Grupo por defecto si un producto no tiene proveedor asignado
  mapaProveedores.set('sin-proveedor', {
    proveedor: { id: 'sin-proveedor', nombre: 'Proveedor General (Sin asignar)', empresa: 'Varios', telefono: '' },
    items: []
  });

  seleccionados.forEach(item => {
    const itemPedido = {
      id: item.id,
      nombre: item.nombre,
      stockActual: item.stockActual,
      umbralMinimo: item.umbralMinimo,
      cantidadSugerida: item.cantidadPedir
    };

    const key = mapaProveedores.has(item.proveedorId) ? item.proveedorId : 'sin-proveedor';
    mapaProveedores.get(key).items.push(itemPedido);
  });

  return Array.from(mapaProveedores.values()).filter(grupo => grupo.items.length > 0);
}

function generarEnlaceWhatsAppProveedor(proveedor, itemsPedido, nombreTienda = 'Tienda Don Carlos') {
  const telefonoLimpio = String(proveedor.telefono || '').replace(/\D/g, '');
  const lineas = itemsPedido.map(
    item => `- ${item.nombre}: pedir ${item.cantidadSugerida} unids. (quedan ${item.stockActual})`
  );
  const mensaje =
    `Hola ${proveedor.nombre} (${proveedor.empresa}), te escribo de *${nombreTienda}* para realizar el siguiente pedido de reabastecimiento:\n\n` +
    lineas.join('\n') +
    `\n\nQuedo atento a la confirmación. ¡Gracias!`;

  return `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
}

function calcularResumenCaja(ventas, abonos) {
  const ventasContado = ventas
    .filter(v => v.tipo === 'contado')
    .reduce((sum, v) => sum + Number(v.total), 0);

  const ventasFiado = ventas
    .filter(v => v.tipo === 'fiado')
    .reduce((sum, v) => sum + Number(v.total), 0);

  const totalAbonos = abonos.reduce((sum, a) => sum + Number(a.monto), 0);
  const dineroFisicoEnCaja = ventasContado + totalAbonos;

  return {
    ventasContado,
    ventasFiado,
    totalAbonos,
    dineroFisicoEnCaja,
    totalOperado: ventasContado + ventasFiado
  };
}

function procesarAbonoCliente(saldoActual, montoAbono) {
  const saldo = Number(saldoActual);
  const abono = Number(montoAbono);
  if (isNaN(abono) || abono <= 0) throw new Error('El monto del abono debe ser mayor a cero.');
  if (abono > saldo) throw new Error('El abono no puede superar la deuda actual del cliente.');
  return saldo - abono;
}

function generarEnlaceWhatsAppCobro(cliente, nombreTienda = 'Tienda Don Carlos') {
  const telefonoLimpio = String(cliente.telefono || '').replace(/\D/g, '');
  const saldoFormateado = Number(cliente.saldoActual).toLocaleString('es-CO');
  const mensaje =
    `Hola *${cliente.nombre}*, te saludamos cordialmente desde *${nombreTienda}*. ` +
    `Te recordamos de manera amable que tienes un saldo pendiente en tu cuenta de *$${saldoFormateado}*. ` +
    `Cuando puedas pasar a abonar o realizar el pago, con gusto te atendemos. ¡Muchas gracias!`;

  return `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
}

function filtrarClientesMorosos(clientes, diasMinimos = 7) {
  return (clientes || [])
    .filter(
      c =>
        Number(c.saldoActual) > 0 &&
        Number(c.diasMora || 0) >= Number(diasMinimos)
    )
    .sort((a, b) => Number(b.saldoActual) - Number(a.saldoActual));
}

const KleinesCore = {
  calcularTotalCarrito,
  calcularVuelto,
  detectarProductosBajosStock,
  calcularCantidadSugerida,
  construirListaGeneralPedidos,
  agruparPedidosPorProveedor,
  generarEnlaceWhatsAppProveedor,
  calcularResumenCaja,
  procesarAbonoCliente,
  generarEnlaceWhatsAppCobro,
  filtrarClientesMorosos
};

if (typeof window !== 'undefined') {
  window.KleinesCore = KleinesCore;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KleinesCore;
}
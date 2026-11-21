/**
 * Módulo Core de Kleines PWA
 * Contiene la lógica pura de ventas, alertas de stock bajo, agrupación por proveedores,
 * enlaces de WhatsApp, arqueo de caja, cartera y cobro a morosos.
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

function agruparPedidosPorProveedor(productos, proveedores) {
  const bajos = detectarProductosBajosStock(productos);
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

  bajos.forEach(prod => {
    const cantidadSugerida = Math.max((Number(prod.umbralMinimo) * 2) - Number(prod.stock), 1);
    const itemPedido = {
      id: prod.id,
      nombre: prod.nombre,
      stockActual: Number(prod.stock),
      umbralMinimo: Number(prod.umbralMinimo),
      cantidadSugerida
    };

    const key = mapaProveedores.has(prod.proveedorId) ? prod.proveedorId : 'sin-proveedor';
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

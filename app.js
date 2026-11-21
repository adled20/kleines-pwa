import { registrarVentaAtomicaFirestore } from './src/services/firebaseConfig.js';
import {
  registrarClienteFirestore,
  registrarVentaFiadaAtomica,
  registrarAbonoAtomico
} from './src/services/carteraService.js';

// Estado inicial precargado para demostración inmediata y persistencia en localStorage
const STORAGE_KEY = 'kleines_mvp_state_v1';

const defaultState = {
  proveedores: [
    { id: 'prov-1', nombre: 'Carlos Gómez', empresa: 'Distribuidora El Sol', telefono: '573001112233' },
    { id: 'prov-2', nombre: 'Marta Ruiz', empresa: 'Lácteos del Caribe', telefono: '573104445566' }
  ],
  productos: [
    { id: 'p-1', nombre: 'Arroz Doña Pepa 500g', precio: 2800, stock: 25, umbralMinimo: 10, proveedorId: 'prov-1' },
    { id: 'p-2', nombre: 'Aceite Girasol 1L', precio: 9500, stock: 3, umbralMinimo: 6, proveedorId: 'prov-1' },
    { id: 'p-3', nombre: 'Leche Entera 1L', precio: 4200, stock: 4, umbralMinimo: 8, proveedorId: 'prov-2' },
    { id: 'p-4', nombre: 'Panela Redonda', precio: 2500, stock: 2, umbralMinimo: 5, proveedorId: 'prov-1' }
  ],
  clientes: [
    { id: 'c-1', nombre: 'Jorge Eliécer Silva', telefono: '573007890123', saldoActual: 73000, diasMora: 12, consentimiento: true },
    { id: 'c-2', nombre: 'Ana María Pérez', telefono: '573109876543', saldoActual: 45000, diasMora: 3, consentimiento: true },
    { id: 'c-3', nombre: 'Luis Fernando Gómez', telefono: '573201234567', saldoActual: 0, diasMora: 0, consentimiento: true }
  ],
  ventas: [
    { id: 'v-1', tipo: 'contado', total: 42000, fecha: new Date().toISOString() },
    { id: 'v-2', tipo: 'fiado', total: 25000, clienteId: 'c-1', fecha: new Date().toISOString() }
  ],
  abonos: [
    { id: 'a-1', clienteId: 'c-2', monto: 15000, fecha: new Date().toISOString() }
  ],
  carrito: [],
  seleccionPedidos: {}
};

let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState;
if (!state.seleccionPedidos) state.seleccionPedidos = {};
let clienteHistorialActivoId = null;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

const formatoCOP = valor => '$' + Number(valor).toLocaleString('es-CO');

// Navegación por pestañas
document.querySelectorAll('#tabsKleines .nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabsKleines .nav-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-view').forEach(sec => sec.classList.add('d-none'));
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('d-none');
  });
});

// Control de Roles (HU-01)
document.getElementById('rolSelector').addEventListener('change', e => {
  const esAdmin = e.target.value === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('d-none', !esAdmin));
});

// Indicador de conexión Online/Offline (HU-01)
function actualizarEstadoRed() {
  const badge = document.getElementById('badgeConexion');
  if (navigator.onLine) {
    badge.className = 'badge bg-success-subtle text-success border border-success-subtle px-3 py-2';
    badge.textContent = '● Online (Sincronizado)';
  } else {
    badge.className = 'badge bg-warning-subtle text-warning border border-warning-subtle px-3 py-2';
    badge.textContent = '● Modo Offline (Caché Local Activa)';
  }
}
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

// Buscador en tiempo real en Mostrador (HU-04 - Dev 2)
const inputBuscador = document.getElementById('buscarProductoMostrador');
if (inputBuscador) {
  inputBuscador.addEventListener('input', e => {
    const termino = e.target.value.toLowerCase().trim();
    const filtrados = state.productos.filter(p =>
      p.nombre.toLowerCase().includes(termino)
    );
    renderProductosMostrador(filtrados);
  });
}

// Carrito, Controles +/- y Calculadora de Vuelto (HU-04 - Dev 2)
function agregarAlCarrito(prodId) {
  const prod = state.productos.find(p => p.id === prodId);
  if (!prod || prod.stock <= 0) return alert('Producto sin existencias disponibles.');
  const existente = state.carrito.find(item => item.id === prodId);
  if (existente) {
    if (existente.cantidad >= prod.stock) return alert('No hay más stock disponible.');
    existente.cantidad += 1;
  } else {
    state.carrito.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 });
  }
  renderCarrito();
}

function cambiarCantidadCarrito(prodId, delta) {
  const item = state.carrito.find(i => i.id === prodId);
  const prod = state.productos.find(p => p.id === prodId);
  if (!item || !prod) return;

  const nuevaCantidad = item.cantidad + delta;
  if (nuevaCantidad <= 0) {
    state.carrito = state.carrito.filter(i => i.id !== prodId);
  } else if (nuevaCantidad > prod.stock) {
    return alert(`Stock máximo disponible: ${prod.stock} unidades.`);
  } else {
    item.cantidad = nuevaCantidad;
  }
  renderCarrito();
}

function actualizarCalculadoraVuelto() {
  const inputEfectivo = document.getElementById('efectivoRecibido');
  const textoVuelto = document.getElementById('textoVuelto');
  const btnContado = document.getElementById('btnCobrarContado');
  if (!inputEfectivo || !textoVuelto || !btnContado) return;

  const total = window.KleinesCore.calcularTotalCarrito(state.carrito);

  if (total === 0) {
    textoVuelto.textContent = 'Vuelto: $0';
    textoVuelto.className = 'small fw-bold text-muted mb-2';
    btnContado.disabled = true;
    return;
  }

  if (inputEfectivo.value === '') {
    textoVuelto.textContent = 'Digita el efectivo recibido para calcular el vuelto';
    textoVuelto.className = 'small fw-semibold text-muted mb-2';
    btnContado.disabled = true;
    return;
  }

  try {
    const vuelto = window.KleinesCore.calcularVuelto(total, Number(inputEfectivo.value));
    textoVuelto.textContent = `Vuelto: ${formatoCOP(vuelto)}`;
    textoVuelto.className = 'small fw-bold text-success mb-2';
    btnContado.disabled = false;
  } catch (err) {
    textoVuelto.textContent = 'Efectivo insuficiente';
    textoVuelto.className = 'small fw-bold text-danger mb-2';
    btnContado.disabled = true;
  }
}

const inputEfectivoRecibido = document.getElementById('efectivoRecibido');
if (inputEfectivoRecibido) {
  inputEfectivoRecibido.addEventListener('input', actualizarCalculadoraVuelto);
}

document.getElementById('btnVaciarCarrito').addEventListener('click', () => {
  state.carrito = [];
  if (inputEfectivoRecibido) inputEfectivoRecibido.value = '';
  renderCarrito();
});

function procesarVenta(tipo) {
  if (state.carrito.length === 0) return alert('Agrega al menos un producto al carrito.');
  const total = window.KleinesCore.calcularTotalCarrito(state.carrito);
  const clienteId = document.getElementById('selectClienteVenta').value;

  if (tipo === 'contado' && inputEfectivoRecibido) {
    try {
      window.KleinesCore.calcularVuelto(total, Number(inputEfectivoRecibido.value));
    } catch (err) {
      return alert('Efectivo insuficiente para completar el cobro de contado.');
    }
  }

  if (tipo === 'fiado') {
    if (!clienteId) return alert('Selecciona un cliente para registrar la venta fiada.');
    const cliente = state.clientes.find(c => c.id === clienteId);
    cliente.saldoActual += total;
    if (cliente.diasMora === 0) cliente.diasMora = 1;
  }

  const carritoCopia = state.carrito.map(item => ({ ...item }));
  const nuevaVenta = {
    id: 'v-' + Date.now(),
    tipo,
    total,
    clienteId: tipo === 'fiado' ? clienteId : null,
    items: carritoCopia,
    fecha: new Date().toISOString()
  };

  // Descuento local inmediato (dispara alertas HU-03 si stock <= umbralMinimo incluso offline)
  state.carrito.forEach(item => {
    const prod = state.productos.find(p => p.id === item.id);
    if (prod) prod.stock = Math.max(0, prod.stock - item.cantidad);
  });

  // Registro atómico en Cloud Firestore (writeBatch)
  if (tipo === 'fiado') {
    registrarVentaFiadaAtomica(nuevaVenta, carritoCopia).catch(err => {
      console.warn('Venta fiada encolada en caché local / pendiente de Firestore:', err.message);
    });
  } else {
    registrarVentaAtomicaFirestore(nuevaVenta, carritoCopia).catch(err => {
      console.warn('Venta contado encolada en caché local / pendiente de Firestore:', err.message);
    });
  }

  state.ventas.push(nuevaVenta);
  state.carrito = [];
  if (inputEfectivoRecibido) inputEfectivoRecibido.value = '';
  if (inputBuscador) inputBuscador.value = '';

  saveState();
  alert(`Venta (${tipo.toUpperCase()}) registrada correctamente por ${formatoCOP(total)}.`);
}

document.getElementById('btnCobrarContado').addEventListener('click', () => procesarVenta('contado'));
document.getElementById('btnCobrarFiado').addEventListener('click', () => procesarVenta('fiado'));

// Detalle de Arqueo Diario de Caja (HU-05 - Dev 2)
const btnDetalleCierre = document.getElementById('btnDetalleCierre');
if (btnDetalleCierre) {
  btnDetalleCierre.addEventListener('click', () => {
    const panel = document.getElementById('panelDetalleCierre');
    if (!panel) return;
    panel.classList.toggle('d-none');
    renderDetalleCierre();
  });
}

function renderDetalleCierre() {
  const panel = document.getElementById('panelDetalleCierre');
  if (!panel) return;

  const hoyISO = new Date().toISOString().slice(0, 10);
  const ventasHoy = state.ventas.filter(v => !v.fecha || v.fecha.startsWith(hoyISO));
  const abonosHoy = state.abonos.filter(a => !a.fecha || a.fecha.startsWith(hoyISO));
  const resumen = window.KleinesCore.calcularResumenCaja(ventasHoy, abonosHoy);
  const fechaFormateada = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  panel.innerHTML = `
    <div class="alert alert-light border shadow-sm mt-3 mb-0">
      <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
        <strong>📋 Arqueo Diario de Caja</strong>
        <span class="badge bg-secondary">${fechaFormateada}</span>
      </div>
      <div class="row g-2 small">
        <div class="col-sm-6">Ventas de Contado: <strong class="text-success">${formatoCOP(resumen.ventasContado)}</strong></div>
        <div class="col-sm-6">Abonos Recibidos: <strong class="text-primary">${formatoCOP(resumen.totalAbonos)}</strong></div>
        <div class="col-sm-6">Dinero Físico en Caja: <strong class="text-success fs-6">${formatoCOP(resumen.dineroFisicoEnCaja)}</strong></div>
        <div class="col-sm-6">Créditos Otorgados (Fiado): <strong class="text-warning-emphasis">${formatoCOP(resumen.ventasFiado)}</strong></div>
      </div>
    </div>
  `;
}

// =========================================================================
// GESTIÓN COMPLETA DE PROVEEDORES (CREAR, VER, EDITAR Y ELIMINAR) - DEV 1
// =========================================================================
function limpiarFormularioProveedor() {
  document.getElementById('formProveedor').reset();
  document.getElementById('provEditId').value = '';
  document.getElementById('tituloFormProveedor').textContent = '1. Registrar Proveedor';
  document.getElementById('btnSubmitProveedor').textContent = 'Guardar Proveedor';
  document.getElementById('btnCancelarEdicionProv').classList.add('d-none');
  document.getElementById('cardFormProveedor').classList.remove('editing-highlight');
}

function editarProveedor(provId) {
  const prov = state.proveedores.find(p => p.id === provId);
  if (!prov) return;

  document.getElementById('provEditId').value = prov.id;
  document.getElementById('provNombre').value = prov.nombre;
  document.getElementById('provEmpresa').value = prov.empresa;
  document.getElementById('provTelefono').value = prov.telefono;

  document.getElementById('tituloFormProveedor').textContent = '✏️ Editando Proveedor';
  document.getElementById('btnSubmitProveedor').textContent = 'Actualizar Proveedor';
  document.getElementById('btnCancelarEdicionProv').classList.remove('d-none');
  document.getElementById('cardFormProveedor').classList.add('editing-highlight');
  document.getElementById('provNombre').focus();
}

function eliminarProveedor(provId) {
  const prov = state.proveedores.find(p => p.id === provId);
  if (!prov) return;
  if (!confirm(`¿Seguro que deseas eliminar al proveedor "${prov.empresa}" (${prov.nombre})?`)) return;

  state.proveedores = state.proveedores.filter(p => p.id !== provId);
  state.productos.forEach(prod => {
    if (prod.proveedorId === provId) prod.proveedorId = '';
  });
  if (document.getElementById('provEditId').value === provId) {
    limpiarFormularioProveedor();
  }
  saveState();
}

document.getElementById('btnCancelarEdicionProv').addEventListener('click', limpiarFormularioProveedor);

document.getElementById('formProveedor').addEventListener('submit', e => {
  e.preventDefault();
  const editId = document.getElementById('provEditId').value;
  const nombre = document.getElementById('provNombre').value.trim();
  const empresa = document.getElementById('provEmpresa').value.trim();
  const telefono = document.getElementById('provTelefono').value.trim();

  if (editId) {
    const prov = state.proveedores.find(p => p.id === editId);
    if (prov) {
      prov.nombre = nombre;
      prov.empresa = empresa;
      prov.telefono = telefono;
    }
  } else {
    state.proveedores.push({
      id: 'prov-' + Date.now(),
      nombre,
      empresa,
      telefono
    });
  }

  limpiarFormularioProveedor();
  saveState();
});

// =========================================================================
// PRODUCTOS Y LISTA GENERAL DE FALTANTES -> SUBLISTAS WHATSAPP - DEV 1
// =========================================================================
document.getElementById('formProducto').addEventListener('submit', e => {
  e.preventDefault();
  state.productos.push({
    id: 'p-' + Date.now(),
    nombre: document.getElementById('prodNombre').value.trim(),
    proveedorId: document.getElementById('prodProveedor').value,
    precio: Number(document.getElementById('prodPrecio').value),
    stock: Number(document.getElementById('prodStock').value),
    umbralMinimo: Number(document.getElementById('prodUmbral').value)
  });
  e.target.reset();
  saveState();
});

function ajustarStock(prodId, delta) {
  const prod = state.productos.find(p => p.id === prodId);
  if (!prod) return;
  prod.stock = Math.max(0, Number(prod.stock) + delta);
  saveState();
}

function toggleItemPedido(prodId, incluido) {
  if (!state.seleccionPedidos[prodId]) state.seleccionPedidos[prodId] = {};
  state.seleccionPedidos[prodId].incluido = incluido;
  saveState();
}

function cambiarCantidadPedido(prodId, cantidad) {
  const valor = Math.max(1, Number(cantidad) || 1);
  if (!state.seleccionPedidos[prodId]) state.seleccionPedidos[prodId] = {};
  state.seleccionPedidos[prodId].cantidad = valor;
  saveState();
}

function cambiarProveedorPedido(prodId, proveedorId) {
  if (!state.seleccionPedidos[prodId]) state.seleccionPedidos[prodId] = {};
  state.seleccionPedidos[prodId].proveedorId = proveedorId;
  saveState();
}

document.getElementById('btnResetListaGeneral').addEventListener('click', () => {
  state.seleccionPedidos = {};
  saveState();
});

// =========================================================================
// CARTERA, MOROSOS Y HISTORIAL INMUTABLE (HU-06 / HU-07 / HU-08 - DEV 3)
// =========================================================================
document.getElementById('formCliente').addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = document.getElementById('cliNombre').value.trim();
  const telefono = document.getElementById('cliTelefono').value.trim();
  const consentimiento = document.getElementById('cliConsentimiento').checked;
  const errorBox = document.getElementById('errorConsentimiento');

  if (!nombre || !telefono) {
    alert('Por favor completa el nombre y el teléfono de WhatsApp del cliente.');
    return;
  }

  // Validación estricta de Habeas Data (Ley 1581 de 2012 - HU-06 Escenario 1)
  if (!consentimiento) {
    const msg = 'Debe aceptar el consentimiento de datos (Ley 1581 de 2012).';
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.classList.remove('d-none');
    }
    alert(msg);
    return;
  }

  if (errorBox) {
    errorBox.textContent = '';
    errorBox.classList.add('d-none');
  }

  const nuevoCliente = {
    id: 'c-' + Date.now(),
    nombre,
    telefono,
    saldoActual: 0,
    diasMora: 0,
    consentimiento: true
  };

  registrarClienteFirestore(nuevoCliente).catch(err => {
    console.warn('Cliente encolado en caché local / pendiente de Firestore:', err.message);
  });

  state.clientes.push(nuevoCliente);
  e.target.reset();
  saveState();
});

const chkSoloMorosos = document.getElementById('filtroSoloMorosos');
if (chkSoloMorosos) {
  chkSoloMorosos.addEventListener('change', () => {
    renderAll();
  });
}

function registrarAbono(clienteId) {
  const cliente = state.clientes.find(c => c.id === clienteId);
  if (!cliente || cliente.saldoActual <= 0) return;
  const entrada = prompt(`Saldo actual de ${cliente.nombre}: ${formatoCOP(cliente.saldoActual)}\nIngresa el valor del abono:`);
  if (entrada === null) return;

  try {
    const montoAbono = Number(entrada);
    const saldoAnterior = cliente.saldoActual;
    const nuevoSaldo = window.KleinesCore.procesarAbonoCliente(saldoAnterior, montoAbono);

    const nuevoAbono = {
      id: 'a-' + Date.now(),
      clienteId,
      monto: montoAbono,
      fecha: new Date().toISOString()
    };

    registrarAbonoAtomico({
      ...nuevoAbono,
      saldoActual: saldoAnterior
    }).catch(err => {
      console.warn('Abono inmutable encolado en caché local / pendiente de Firestore:', err.message);
    });

    cliente.saldoActual = nuevoSaldo;
    if (nuevoSaldo === 0) cliente.diasMora = 0;
    state.abonos.push(nuevoAbono);
    saveState();
  } catch (err) {
    alert(err.message);
  }
}

function formatearFechaMovimiento(isoString) {
  if (!isoString) return 'Sin fecha';
  const fecha = new Date(isoString);
  if (isNaN(fecha.getTime())) return String(isoString);
  return fecha.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function verHistorialCliente(clienteId) {
  clienteHistorialActivoId = clienteId;
  const contenedor = document.getElementById('panelHistorialCliente');
  if (!contenedor) return;

  const cliente = state.clientes.find(c => c.id === clienteId);
  if (!cliente) return;

  const fiados = (state.ventas || [])
    .filter(v => v.tipo === 'fiado' && v.clienteId === clienteId)
    .map(v => {
      const detalleItems = Array.isArray(v.items) && v.items.length > 0
        ? ` (${v.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ')})`
        : '';
      return {
        fechaRaw: v.fecha || '',
        fecha: formatearFechaMovimiento(v.fecha),
        concepto: `Compra fiada${detalleItems}`,
        monto: `+${formatoCOP(v.total)}`,
        claseMonto: 'text-danger fw-semibold'
      };
    });

  const abonos = (state.abonos || [])
    .filter(a => a.clienteId === clienteId)
    .map(a => ({
      fechaRaw: a.fecha || '',
      fecha: formatearFechaMovimiento(a.fecha),
      concepto: 'Abono registrado',
      monto: `-${formatoCOP(a.monto)}`,
      claseMonto: 'text-success fw-semibold'
    }));

  const movimientos = [...fiados, ...abonos].sort(
    (a, b) => new Date(a.fechaRaw) - new Date(b.fechaRaw)
  );

  contenedor.innerHTML = `
    <div class="card border-secondary-subtle bg-light">
      <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <strong>🔒 Historial Inmutable — ${cliente.nombre}</strong>
          <span class="badge bg-dark ms-2">Solo lectura / Auditoría</span>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="cerrarHistorialCliente()">Cerrar</button>
      </div>
      <div class="card-body p-3">
        ${
          movimientos.length === 0
            ? '<p class="text-muted small mb-0">Este cliente aún no tiene compras fiadas ni abonos registrados.</p>'
            : `<div class="table-responsive">
                <table class="table table-sm table-bordered bg-white align-middle small mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${movimientos
                      .map(
                        m => `
                          <tr>
                            <td>${m.fecha}</td>
                            <td>${m.concepto}</td>
                            <td class="${m.claseMonto}">${m.monto}</td>
                          </tr>
                        `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
        <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top small">
          <span class="text-muted">Los registros históricos no pueden editarse ni eliminarse.</span>
          <strong>Saldo actual: <span class="${cliente.saldoActual > 0 ? 'text-danger' : 'text-success'}">${formatoCOP(cliente.saldoActual)}</span></strong>
        </div>
      </div>
    </div>
  `;
}

function cerrarHistorialCliente() {
  clienteHistorialActivoId = null;
  const contenedor = document.getElementById('panelHistorialCliente');
  if (contenedor) contenedor.innerHTML = '';
}

// Exponer funciones al ámbito global para eventos onclick/onchange del HTML al usar type="module"
window.agregarAlCarrito = agregarAlCarrito;
window.cambiarCantidadCarrito = cambiarCantidadCarrito;
window.registrarAbono = registrarAbono;
window.verHistorialCliente = verHistorialCliente;
window.cerrarHistorialCliente = cerrarHistorialCliente;
window.editarProveedor = editarProveedor;
window.eliminarProveedor = eliminarProveedor;
window.ajustarStock = ajustarStock;
window.toggleItemPedido = toggleItemPedido;
window.cambiarCantidadPedido = cambiarCantidadPedido;
window.cambiarProveedorPedido = cambiarProveedorPedido;

// Renderizado de Mostrador
function renderProductosMostrador(lista = state.productos) {
  const grid = document.getElementById('gridProductosMostrador');
  if (lista.length === 0) {
    grid.innerHTML = '<div class="col-12 text-muted text-center py-3">No se encontraron productos con ese nombre.</div>';
    return;
  }

  grid.innerHTML = lista.map(p => {
    const esBajo = p.stock <= p.umbralMinimo;
    return `
      <div class="col-sm-6">
        <div class="border rounded-3 p-3 h-100 d-flex flex-column justify-content-between ${esBajo ? 'border-danger-subtle bg-danger-subtle bg-opacity-10' : ''}">
          <div>
            <div class="d-flex justify-content-between">
              <span class="fw-semibold">${p.nombre}</span>
              ${esBajo ? '<span class="badge bg-danger">Stock Bajo</span>' : ''}
            </div>
            <small class="text-muted">Disponibles: ${p.stock} unids.</small>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <span class="fw-bold text-success">${formatoCOP(p.precio)}</span>
            <button class="btn btn-sm btn-outline-success" onclick="agregarAlCarrito('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>+ Agregar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizado de Carrito con botones - y +
function renderCarrito() {
  const ul = document.getElementById('listaCarrito');
  ul.innerHTML = state.carrito.length === 0
    ? '<li class="list-group-item text-muted text-center py-3">El carrito está vacío</li>'
    : state.carrito.map(item => `
        <li class="list-group-item d-flex justify-content-between align-items-center px-0">
          <div>
            <strong>${item.nombre}</strong><br>
            <small class="text-muted">${formatoCOP(item.precio)} c/u</small>
          </div>
          <div class="d-flex align-items-center gap-2">
            <div class="btn-group btn-group-sm" role="group">
              <button type="button" class="btn btn-outline-secondary" onclick="cambiarCantidadCarrito('${item.id}', -1)">-</button>
              <span class="btn btn-light disabled fw-bold text-dark">${item.cantidad}</span>
              <button type="button" class="btn btn-outline-secondary" onclick="cambiarCantidadCarrito('${item.id}', 1)">+</button>
            </div>
            <span class="fw-semibold ms-1">${formatoCOP(item.precio * item.cantidad)}</span>
          </div>
        </li>
      `).join('');

  document.getElementById('totalCarrito').textContent = formatoCOP(window.KleinesCore.calcularTotalCarrito(state.carrito));
  actualizarCalculadoraVuelto();
}

function renderAll() {
  const esAdmin = document.getElementById('rolSelector').value === 'admin';

  // 1. Resumen Caja (HU-05)
  const resumen = window.KleinesCore.calcularResumenCaja(state.ventas, state.abonos);
  document.getElementById('cajaEfectivo').textContent = formatoCOP(resumen.dineroFisicoEnCaja);
  document.getElementById('cajaFiado').textContent = formatoCOP(resumen.ventasFiado);
  document.getElementById('cajaTotal').textContent = formatoCOP(resumen.totalOperado);
  renderDetalleCierre();

  // 2. Mostrador
  renderProductosMostrador(state.productos);

  // 3. Selectores de clientes y proveedores
  document.getElementById('selectClienteVenta').innerHTML =
    '<option value="">-- Seleccionar cliente (si es fiado) --</option>' +
    state.clientes.map(c => `<option value="${c.id}">${c.nombre} (Deuda: ${formatoCOP(c.saldoActual)})</option>`).join('');

  document.getElementById('prodProveedor').innerHTML =
    '<option value="">-- Sin proveedor asignado --</option>' +
    state.proveedores.map(p => `<option value="${p.id}">${p.empresa} (${p.nombre})</option>`).join('');

  // 4. Tabla Directorio de Proveedores (Ver, Editar y Eliminar - Dev 1)
  document.getElementById('contadorProveedores').textContent = `${state.proveedores.length} proveedores`;
  const tbodyProv = document.getElementById('tablaProveedoresBody');
  tbodyProv.innerHTML = state.proveedores.length === 0
    ? '<tr><td colspan="5" class="text-center text-muted py-3">No hay proveedores registrados aún.</td></tr>'
    : state.proveedores.map(pr => {
        const cantProductos = state.productos.filter(prod => prod.proveedorId === pr.id).length;
        const telLimpio = String(pr.telefono || '').replace(/\D/g, '');
        return `
          <tr>
            <td class="fw-semibold">${pr.empresa}</td>
            <td>${pr.nombre}</td>
            <td>
              <a href="https://wa.me/${telLimpio}" target="_blank" class="text-decoration-none text-success fw-medium">
                📱 ${pr.telefono}
              </a>
            </td>
            <td><span class="badge bg-light text-dark border">${cantProductos} prod(s)</span></td>
            <td class="admin-only ${esAdmin ? '' : 'd-none'}">
              <div class="d-flex gap-1">
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="editarProveedor('${pr.id}')">✏️ Editar</button>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarProveedor('${pr.id}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

  // 5. Paso 1: Lista General de Pedidos Faltantes (Stock Bajo - Dev 1)
  const listaGeneral = window.KleinesCore.construirListaGeneralPedidos(state.productos, state.seleccionPedidos);
  document.getElementById('badgeStockBajo').textContent = listaGeneral.length;

  const tbodyGeneral = document.getElementById('tablaListaGeneralBody');
  tbodyGeneral.innerHTML = listaGeneral.length === 0
    ? '<tr><td colspan="5" class="text-center text-muted py-3">✅ No hay productos bajos en stock. Todos los niveles están óptimos.</td></tr>'
    : listaGeneral.map(item => {
        const opcionesProv = [
          `<option value="" ${!item.proveedorId ? 'selected' : ''}>-- Proveedor General (Sin asignar) --</option>`,
          ...state.proveedores.map(pr =>
            `<option value="${pr.id}" ${item.proveedorId === pr.id ? 'selected' : ''}>${pr.empresa} (${pr.nombre})</option>`
          )
        ].join('');

        return `
          <tr class="${item.incluido ? '' : 'table-secondary text-muted'}">
            <td class="text-center">
              <input
                type="checkbox"
                class="form-check-input"
                ${item.incluido ? 'checked' : ''}
                onchange="toggleItemPedido('${item.id}', this.checked)"
              />
            </td>
            <td>
              <span class="fw-semibold">${item.nombre}</span>
              <span class="badge bg-danger ms-1">Stock Bajo</span>
            </td>
            <td><strong>${item.stockActual}</strong> / mín. ${item.umbralMinimo}</td>
            <td>
              <input
                type="number"
                min="1"
                class="form-control form-control-sm"
                value="${item.cantidadPedir}"
                ${item.incluido ? '' : 'disabled'}
                onchange="cambiarCantidadPedido('${item.id}', this.value)"
              />
            </td>
            <td>
              <select
                class="form-select form-select-sm"
                ${item.incluido ? '' : 'disabled'}
                onchange="cambiarProveedorPedido('${item.id}', this.value)"
              >
                ${opcionesProv}
              </select>
            </td>
          </tr>
        `;
      }).join('');

  // 6. Paso 2: Sublistas Automáticas por Proveedor (WhatsApp - Dev 1)
  const grupos = window.KleinesCore.agruparPedidosPorProveedor(
    state.productos,
    state.proveedores,
    state.seleccionPedidos
  );
  const contSublistas = document.getElementById('contenedorSublistasProveedores');
  contSublistas.innerHTML = grupos.length === 0
    ? '<div class="col-12 text-muted small">No hay productos seleccionados en la lista general para generar sublistas de pedido.</div>'
    : grupos.map(g => {
        const tieneTelefono = Boolean(String(g.proveedor.telefono || '').replace(/\D/g, ''));
        const waLink = window.KleinesCore.generarEnlaceWhatsAppProveedor(g.proveedor, g.items);
        return `
          <div class="col-md-6">
            <div class="border rounded-3 p-3 bg-light h-100 d-flex flex-column justify-content-between">
              <div>
                <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <div>
                    <strong class="d-block">${g.proveedor.empresa}</strong>
                    <small class="text-muted">Preventista: ${g.proveedor.nombre} ${g.proveedor.telefono ? `(${g.proveedor.telefono})` : ''}</small>
                  </div>
                  ${tieneTelefono
                    ? `<a href="${waLink}" target="_blank" class="btn btn-sm btn-success fw-semibold">📲 Enviar WhatsApp</a>`
                    : `<span class="badge bg-warning text-dark">Asigna un proveedor</span>`
                  }
                </div>
                <ul class="small mb-0 ps-3">
                  ${g.items.map(i => `<li><strong>${i.nombre}</strong>: pedir <strong>${i.cantidadSugerida} unids.</strong> (quedan ${i.stockActual})</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        `;
      }).join('');

  // 7. Inventario Completo
  document.getElementById('tablaInventarioBody').innerHTML = state.productos.map(p => {
    const prov = state.proveedores.find(pr => pr.id === p.proveedorId);
    const esBajo = p.stock <= p.umbralMinimo;
    return `
      <tr>
        <td class="fw-semibold">${p.nombre}</td>
        <td>${prov ? `${prov.empresa} (${prov.nombre})` : '<span class="text-muted">Sin asignar</span>'}</td>
        <td>${formatoCOP(p.precio)}</td>
        <td><strong>${p.stock}</strong> / mín. ${p.umbralMinimo}</td>
        <td>${esBajo ? '<span class="badge bg-danger">Bajo Stock</span>' : '<span class="badge bg-success-subtle text-success">Óptimo</span>'}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-secondary" onclick="ajustarStock('${p.id}', -1)">-1</button>
            <button type="button" class="btn btn-outline-secondary" onclick="ajustarStock('${p.id}', 1)">+1</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 8. Cartera y Cobro a Morosos (HU-07 / HU-08 - Dev 3)
  const soloMorosos = document.getElementById('filtroSoloMorosos')?.checked;
  const clientesVisibles = soloMorosos
    ? window.KleinesCore.filtrarClientesMorosos(state.clientes, 7)
    : [...state.clientes].sort((a, b) => b.saldoActual - a.saldoActual);

  const tbodyCartera = document.getElementById('tablaCarteraBody');
  tbodyCartera.innerHTML = clientesVisibles.length === 0
    ? '<tr><td colspan="5" class="text-center text-muted py-3">No hay clientes morosos con 7 o más días de mora.</td></tr>'
    : clientesVisibles.map(c => {
        const esMoroso = c.saldoActual > 0 && c.diasMora >= 7;
        const waCobro = window.KleinesCore.generarEnlaceWhatsAppCobro(c);
        return `
          <tr>
            <td class="fw-semibold">${c.nombre}</td>
            <td>${c.telefono}</td>
            <td class="fw-bold ${c.saldoActual > 0 ? 'text-danger' : 'text-success'}">${formatoCOP(c.saldoActual)}</td>
            <td>
              ${c.saldoActual === 0
                ? '<span class="badge bg-success-subtle text-success">Al día</span>'
                : esMoroso
                  ? `<span class="badge bg-danger">Moroso (${c.diasMora} días)</span>`
                  : `<span class="badge bg-warning text-dark">Pendiente (${c.diasMora}d)</span>`}
            </td>
            <td class="d-flex flex-wrap gap-1">
              ${c.saldoActual > 0 ? `
                <button class="btn btn-sm btn-outline-primary" onclick="registrarAbono('${c.id}')">Abonar</button>
                <a href="${waCobro}" target="_blank" class="btn btn-sm btn-success">📲 Cobrar WhatsApp</a>
              ` : ''}
              <button class="btn btn-sm btn-outline-secondary" onclick="verHistorialCliente('${c.id}')">Historial</button>
            </td>
          </tr>
        `;
      }).join('');

  if (clienteHistorialActivoId) {
    verHistorialCliente(clienteHistorialActivoId);
  }

  renderCarrito();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
actualizarEstadoRed();
renderAll();
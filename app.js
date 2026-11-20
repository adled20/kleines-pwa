import { registrarVentaAtomicaFirestore } from './src/services/firebaseConfig.js';

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
    { id: 'c-1', nombre: 'Jorge Eliécer Silva', telefono: '573007890123', saldoActual: 73000, diasMora: 12 },
    { id: 'c-2', nombre: 'Ana María Pérez', telefono: '573109876543', saldoActual: 45000, diasMora: 3 },
    { id: 'c-3', nombre: 'Luis Fernando Gómez', telefono: '573201234567', saldoActual: 0, diasMora: 0 }
  ],
  ventas: [
    { id: 'v-1', tipo: 'contado', total: 42000, fecha: new Date().toISOString() },
    { id: 'v-2', tipo: 'fiado', total: 25000, clienteId: 'c-1', fecha: new Date().toISOString() }
  ],
  abonos: [
    { id: 'a-1', clienteId: 'c-2', monto: 15000, fecha: new Date().toISOString() }
  ],
  carrito: []
};

let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState;

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

// Buscador en tiempo real en Mostrador (HU-04)
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

// Carrito, Controles +/- y Calculadora de Vuelto (HU-04)
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

  const nuevaVenta = {
    id: 'v-' + Date.now(),
    tipo,
    total,
    clienteId: tipo === 'fiado' ? clienteId : null,
    fecha: new Date().toISOString()
  };

  const carritoCopia = state.carrito.map(item => ({ ...item }));

  // Descuento local inmediato (dispara alertas HU-03 si stock <= umbralMinimo incluso offline)
  state.carrito.forEach(item => {
    const prod = state.productos.find(p => p.id === item.id);
    if (prod) prod.stock = Math.max(0, prod.stock - item.cantidad);
  });

  // Registro atómico en Cloud Firestore con cola offline (writeBatch)
  registrarVentaAtomicaFirestore(nuevaVenta, carritoCopia).catch(err => {
    console.warn('Operación encolada en caché local / pendiente de Firestore:', err.message);
  });

  state.ventas.push(nuevaVenta);
  state.carrito = [];
  if (inputEfectivoRecibido) inputEfectivoRecibido.value = '';
  if (inputBuscador) inputBuscador.value = '';

  saveState();
  alert(`Venta (${tipo.toUpperCase()}) registrada correctamente por ${formatoCOP(total)}.`);
}

document.getElementById('btnCobrarContado').addEventListener('click', () => procesarVenta('contado'));
document.getElementById('btnCobrarFiado').addEventListener('click', () => procesarVenta('fiado'));

// Detalle de Arqueo Diario de Caja (HU-05)
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

// Formularios de Proveedores, Productos y Clientes (HU-02 / HU-06)
document.getElementById('formProveedor').addEventListener('submit', e => {
  e.preventDefault();
  state.proveedores.push({
    id: 'prov-' + Date.now(),
    nombre: document.getElementById('provNombre').value.trim(),
    empresa: document.getElementById('provEmpresa').value.trim(),
    telefono: document.getElementById('provTelefono').value.trim()
  });
  e.target.reset();
  saveState();
});

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

document.getElementById('formCliente').addEventListener('submit', e => {
  e.preventDefault();
  state.clientes.push({
    id: 'c-' + Date.now(),
    nombre: document.getElementById('cliNombre').value.trim(),
    telefono: document.getElementById('cliTelefono').value.trim(),
    saldoActual: 0,
    diasMora: 0
  });
  e.target.reset();
  saveState();
});

// Abonos a Morosos (HU-07)
function registrarAbono(clienteId) {
  const cliente = state.clientes.find(c => c.id === clienteId);
  if (!cliente || cliente.saldoActual <= 0) return;
  const entrada = prompt(`Saldo actual de ${cliente.nombre}: ${formatoCOP(cliente.saldoActual)}\nIngresa el valor del abono:`);
  if (!entrada) return;

  try {
    const nuevoSaldo = window.KleinesCore.procesarAbonoCliente(cliente.saldoActual, Number(entrada));
    cliente.saldoActual = nuevoSaldo;
    if (nuevoSaldo === 0) cliente.diasMora = 0;
    state.abonos.push({ id: 'a-' + Date.now(), clienteId, monto: Number(entrada), fecha: new Date().toISOString() });
    saveState();
  } catch (err) {
    alert(err.message);
  }
}

// Exponer funciones al ámbito global para eventos onclick del HTML al usar type="module"
window.agregarAlCarrito = agregarAlCarrito;
window.cambiarCantidadCarrito = cambiarCantidadCarrito;
window.registrarAbono = registrarAbono;

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
    state.proveedores.map(p => `<option value="${p.id}">${p.empresa} (${p.nombre})</option>`).join('');

  // 4. Inventario y Sublistas WhatsApp (HU-02 / HU-03)
  const bajos = window.KleinesCore.detectarProductosBajosStock(state.productos);
  document.getElementById('badgeStockBajo').textContent = bajos.length;

  const grupos = window.KleinesCore.agruparPedidosPorProveedor(state.productos, state.proveedores);
  const contSublistas = document.getElementById('contenedorSublistasProveedores');
  contSublistas.innerHTML = grupos.length === 0
    ? '<div class="col-12 text-muted small">Todos los productos tienen stock óptimo.</div>'
    : grupos.map(g => {
        const waLink = window.KleinesCore.generarEnlaceWhatsAppProveedor(g.proveedor, g.items);
        return `
          <div class="col-md-6">
            <div class="border rounded-3 p-3 bg-light">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <strong>${g.proveedor.empresa}</strong>
                  <div class="small text-muted">Contacto: ${g.proveedor.nombre} (${g.proveedor.telefono || 'Sin tel'})</div>
                </div>
                <a href="${waLink}" target="_blank" class="btn btn-sm btn-success">📲 Enviar WhatsApp</a>
              </div>
              <ul class="small mb-0 ps-3">
                ${g.items.map(i => `<li><strong>${i.nombre}</strong>: quedan ${i.stockActual} (sugerido pedir: ${i.cantidadSugerida})</li>`).join('')}
              </ul>
            </div>
          </div>
        `;
      }).join('');

  document.getElementById('tablaInventarioBody').innerHTML = state.productos.map(p => {
    const prov = state.proveedores.find(pr => pr.id === p.proveedorId);
    const esBajo = p.stock <= p.umbralMinimo;
    return `
      <tr>
        <td class="fw-semibold">${p.nombre}</td>
        <td>${prov ? prov.empresa : 'Sin asignar'}</td>
        <td>${formatoCOP(p.precio)}</td>
        <td>${p.stock} / mín. ${p.umbralMinimo}</td>
        <td>${esBajo ? '<span class="badge bg-danger">Bajo Stock</span>' : '<span class="badge bg-success-subtle text-success">Óptimo</span>'}</td>
      </tr>
    `;
  }).join('');

  // 5. Cartera y Cobro a Morosos (HU-07 / HU-08)
  const clientesOrdenados = [...state.clientes].sort((a, b) => b.saldoActual - a.saldoActual);
  document.getElementById('tablaCarteraBody').innerHTML = clientesOrdenados.map(c => {
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
        <td class="d-flex gap-1">
          ${c.saldoActual > 0 ? `
            <button class="btn btn-sm btn-outline-primary" onclick="registrarAbono('${c.id}')">Abonar</button>
            <a href="${waCobro}" target="_blank" class="btn btn-sm btn-success">📲 Cobrar WhatsApp</a>
          ` : '<span class="text-muted small">Sin saldo</span>'}
        </td>
      </tr>
    `;
  }).join('');

  renderCarrito();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
actualizarEstadoRed();
renderAll();
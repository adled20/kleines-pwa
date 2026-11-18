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

// Carrito y Ventas (HU-04 y HU-06)
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

document.getElementById('btnVaciarCarrito').addEventListener('click', () => {
  state.carrito = [];
  renderCarrito();
});

function procesarVenta(tipo) {
  if (state.carrito.length === 0) return alert('Agrega al menos un producto al carrito.');
  const total = window.KleinesCore.calcularTotalCarrito(state.carrito);
  const clienteId = document.getElementById('selectClienteVenta').value;

  if (tipo === 'fiado') {
    if (!clienteId) return alert('Selecciona un cliente para registrar la venta fiada.');
    const cliente = state.clientes.find(c => c.id === clienteId);
    cliente.saldoActual += total;
    if (cliente.diasMora === 0) cliente.diasMora = 1;
  }

  // Descuento atómico de stock
  state.carrito.forEach(item => {
    const prod = state.productos.find(p => p.id === item.id);
    if (prod) prod.stock = Math.max(0, prod.stock - item.cantidad);
  });

  state.ventas.push({
    id: 'v-' + Date.now(),
    tipo,
    total,
    clienteId: tipo === 'fiado' ? clienteId : null,
    fecha: new Date().toISOString()
  });

  state.carrito = [];
  saveState();
  alert(`Venta (${tipo.toUpperCase()}) registrada correctamente por ${formatoCOP(total)}.`);
}

document.getElementById('btnCobrarContado').addEventListener('click', () => procesarVenta('contado'));
document.getElementById('btnCobrarFiado').addEventListener('click', () => procesarVenta('fiado'));

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

// Renderizado de toda la UI
function renderCarrito() {
  const ul = document.getElementById('listaCarrito');
  ul.innerHTML = state.carrito.length === 0
    ? '<li class="list-group-item text-muted text-center py-3">El carrito está vacío</li>'
    : state.carrito.map(item => `
        <li class="list-group-item d-flex justify-content-between align-items-center px-0">
          <div><strong>${item.nombre}</strong><br><small class="text-muted">${item.cantidad} x ${formatoCOP(item.precio)}</small></div>
          <span class="fw-semibold">${formatoCOP(item.precio * item.cantidad)}</span>
        </li>
      `).join('');
  document.getElementById('totalCarrito').textContent = formatoCOP(window.KleinesCore.calcularTotalCarrito(state.carrito));
}

function renderAll() {
  // 1. Resumen Caja (HU-05)
  const resumen = window.KleinesCore.calcularResumenCaja(state.ventas, state.abonos);
  document.getElementById('cajaEfectivo').textContent = formatoCOP(resumen.dineroFisicoEnCaja);
  document.getElementById('cajaFiado').textContent = formatoCOP(resumen.ventasFiado);
  document.getElementById('cajaTotal').textContent = formatoCOP(resumen.totalOperado);

  // 2. Mostrador
  const grid = document.getElementById('gridProductosMostrador');
  grid.innerHTML = state.productos.map(p => {
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
            <button class="btn btn-sm btn-outline-success" onclick="agregarAlCarrito('${p.id}')">+ Agregar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

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
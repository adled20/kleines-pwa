import { db } from "./firebaseConfig.js";
import {
  doc,
  setDoc,
  writeBatch,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function registrarClienteFirestore(cliente) {
  if (!cliente.consentimiento) {
    throw new Error("Debe aceptar el consentimiento de datos (Ley 1581 de 2012).");
  }

  const clienteRef = doc(db, `negocios/principal/clientes/${cliente.id}`);
  await setDoc(clienteRef, {
    nombre: cliente.nombre,
    telefono: cliente.telefono,
    saldoActual: Number(cliente.saldoActual || 0),
    diasMora: Number(cliente.diasMora || 0),
    consentimiento: true,
    creadoEn: serverTimestamp()
  });
}

export async function registrarVentaFiadaAtomica(venta, carrito) {
  const batch = writeBatch(db);
  const ventaRef = doc(db, `negocios/principal/ventas/${venta.id}`);
  const clienteRef = doc(db, `negocios/principal/clientes/${venta.clienteId}`);

  batch.set(ventaRef, {
    tipo: "fiado",
    total: Number(venta.total),
    clienteId: venta.clienteId,
    items: carrito,
    creadoEn: serverTimestamp()
  });

  batch.update(clienteRef, {
    saldoActual: increment(Number(venta.total))
  });

  carrito.forEach((item) => {
    const prodRef = doc(db, `negocios/principal/productos/${item.id}`);
    batch.update(prodRef, {
      stock: increment(-Number(item.cantidad))
    });
  });

  await batch.commit();
}

export async function registrarAbonoAtomico(abono) {
  const monto = Number(abono.monto);
  if (isNaN(monto) || monto <= 0) {
    throw new Error("El monto del abono debe ser mayor a $0.");
  }
  if (abono.saldoActual !== undefined && monto > Number(abono.saldoActual)) {
    throw new Error("El abono no puede superar la deuda actual del cliente.");
  }

  const batch = writeBatch(db);
  const abonoRef = doc(db, `negocios/principal/abonos/${abono.id}`);
  const clienteRef = doc(db, `negocios/principal/clientes/${abono.clienteId}`);

  // Documento inmutable de auditoría en /abonos
  batch.set(abonoRef, {
    clienteId: abono.clienteId,
    monto: monto,
    inmutable: true,
    creadoEn: serverTimestamp()
  });

  batch.update(clienteRef, {
    saldoActual: increment(-monto)
  });

  await batch.commit();
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  writeBatch,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBugqZJqHq798SEIrTTMSzOmhFNvin7IZg",
  authDomain: "kleines-pwa.firebaseapp.com",
  projectId: "kleines-pwa",
  storageBucket: "kleines-pwa.firebasestorage.app",
  messagingSenderId: "656647534023",
  appId: "1:656647534023:web:9faf23f71ba371a0cbd5e2"
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export async function registrarVentaAtomicaFirestore(venta, carrito) {
  const batch = writeBatch(db);
  const ventaRef = doc(db, `negocios/principal/ventas/${venta.id}`);

  batch.set(ventaRef, {
    tipo: venta.tipo,
    total: Number(venta.total),
    clienteId: venta.clienteId || null,
    items: carrito,
    creadoEn: serverTimestamp()
  });

  carrito.forEach(item => {
    const prodRef = doc(db, `negocios/principal/productos/${item.id}`);
    batch.update(prodRef, {
      stock: increment(-Number(item.cantidad))
    });
  });

  await batch.commit();
}

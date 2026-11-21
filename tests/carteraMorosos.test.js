const {
  procesarAbonoCliente,
  generarEnlaceWhatsAppCobro,
  filtrarClientesMorosos
} = require('../src/core/storeLogic');

describe('Pruebas Dev 3 - Cartera, Abonos Inmutables y Cobro a Morosos (HU-06 / HU-07 / HU-08)', () => {
  test('Liquida la deuda completamente cuando el abono es igual al saldo', () => {
    expect(procesarAbonoCliente(35000, 35000)).toBe(0);
  });

  test('Lanza error si el abono es cero, negativo o supera la deuda actual', () => {
    expect(() => procesarAbonoCliente(35000, 0)).toThrow();
    expect(() => procesarAbonoCliente(35000, -5000)).toThrow();
    expect(() => procesarAbonoCliente(35000, 40000)).toThrow();
  });

  test('Filtra únicamente clientes morosos con 7 o más días de mora y los ordena por deuda', () => {
    const clientes = [
      { id: '1', nombre: 'Ana', saldoActual: 20000, diasMora: 3 },
      { id: '2', nombre: 'Jorge', saldoActual: 45000, diasMora: 10 },
      { id: '3', nombre: 'Rosa', saldoActual: 90000, diasMora: 15 },
      { id: '4', nombre: 'Luis', saldoActual: 0, diasMora: 0 }
    ];
    const morosos = filtrarClientesMorosos(clientes, 7);
    expect(morosos.map(c => c.id)).toEqual(['3', '2']);
  });

  test('Genera enlace de WhatsApp personalizado para recordatorio de cobro', () => {
    const enlace = generarEnlaceWhatsAppCobro({
      nombre: 'Jorge Silva',
      telefono: '573007890123',
      saldoActual: 73000
    });
    expect(enlace).toContain('https://wa.me/573007890123?text=');
    expect(decodeURIComponent(enlace)).toContain('73.000');
  });
});

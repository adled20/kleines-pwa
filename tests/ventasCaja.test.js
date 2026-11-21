const {
  calcularTotalCarrito,
  calcularResumenCaja,
  calcularVuelto
} = require('../src/core/storeLogic');

describe('Pruebas Dev 2 - Ventas de Contado, Vuelto y Arqueo de Caja (HU-04 / HU-05)', () => {
  test('Retorna 0 si el carrito está vacío', () => {
    expect(calcularTotalCarrito([])).toBe(0);
  });

  test('Calcula el vuelto correcto y lanza error si el efectivo es insuficiente', () => {
    expect(calcularVuelto(14500, 20000)).toBe(5500);
    expect(calcularVuelto(14500, 14500)).toBe(0);
    expect(() => calcularVuelto(14500, 10000)).toThrow();
  });

  test('Calcula el cierre de caja sumando contado y abonos sin mezclar fiados', () => {
    const ventas = [
      { tipo: 'contado', total: 100000 },
      { tipo: 'fiado', total: 40000 }
    ];
    const abonos = [{ monto: 25000 }];
    const caja = calcularResumenCaja(ventas, abonos);

    expect(caja.dineroFisicoEnCaja).toBe(125000);
    expect(caja.ventasFiado).toBe(40000);
    expect(caja.totalOperado).toBe(140000);
  });
});
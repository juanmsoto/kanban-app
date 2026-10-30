import { describe, it, expect } from 'vitest';
import { SEPARACION, posicionEntre } from '../src/position.js';

describe('posicionEntre', () => {
    it('sin vecinas (lista vacia o un solo elemento) devuelve SEPARACION', () => {
        expect(posicionEntre(null, null)).toBe(SEPARACION);
    });

    it('al principio (sin vecina de arriba) resta SEPARACION a la siguiente', () => {
        expect(posicionEntre(null, 1000)).toBe(0);
    });

    it('al principio puede dar un numero negativo y no es un error', () => {
        expect(posicionEntre(null, 500)).toBe(-500);
    });

    it('al final (sin vecina de abajo) suma SEPARACION a la anterior', () => {
        expect(posicionEntre(3000, null)).toBe(4000);
    });

    it('entre dos vecinas devuelve el punto medio', () => {
        expect(posicionEntre(1000, 2000)).toBe(1500);
        expect(posicionEntre(1000, 1500)).toBe(1250);
    });

    it('el resultado queda estrictamente entre las dos vecinas', () => {
        const pares: Array<[number, number]> = [[1000, 2000], [0, 1], [-1000, 1000], [1000, 1001], [0.5, 0.75]];

        for(const [anterior, siguiente] of pares) {
            const medio = posicionEntre(anterior, siguiente);
            expect(medio).not.toBeNull();
            expect(medio as number).toBeGreaterThan(anterior);
            expect(medio as number).toBeLessThan(siguiente);
        }
    });

    it('devuelve null si las dos vecinas tienen la misma posicion', () => {
        expect(posicionEntre(1000, 1000)).toBeNull();
    });

    it('devuelve null si las dos vecinas son numeros consecutivos del tipo double', () => {
        const pegada = 1 + Number.EPSILON;

        expect(posicionEntre(1, pegada)).toBeNull();
    });

    it('devuelve null si la anterior es mayor que la siguiente (lista desordenada)', () => {
        expect(posicionEntre(2000, 1000)).toBeNull();
    });

    it('insertando siempre entre las mismas dos vecinas se agota el hueco: cada paso queda entre ellas y al final da null', () => {
        const anterior = 1000;
        let siguiente = 2000;
        let pasos = 0;

        for(;;) {
            const medio = posicionEntre(anterior, siguiente);

            if(medio === null) {
                break;
            }

            expect(medio).toBeGreaterThan(anterior);
            expect(medio).toBeLessThan(siguiente);
            siguiente = medio;
            pasos++;

            expect(pasos).toBeLessThan(200);
        }

        expect(pasos).toBeGreaterThan(40);
    });
});

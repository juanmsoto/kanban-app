export const SEPARACION = 1000;

// Posicion para un elemento que queda entre `anterior` y `siguiente` (null = no hay vecino de ese lado).
// Devuelve null si no entra nada entre las dos (quedaron pegadas): quien llama debe renumerar la lista.
export function posicionEntre(anterior: number | null, siguiente: number | null): number | null {
    if(anterior === null) {
        return siguiente === null ? SEPARACION : siguiente - SEPARACION;
    }

    if(siguiente === null) {
        return anterior + SEPARACION;
    }

    const medio = (anterior + siguiente) / 2;
    return medio > anterior && medio < siguiente ? medio : null;
}
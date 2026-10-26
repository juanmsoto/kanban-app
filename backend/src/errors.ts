// Errores de autorizacion compartidos por todos los modulos (tableros, columnas, tarjetas).
// El errorHandler los traduce: BoardNotFoundError -> 404, ForbiddenError -> 403.

// No es miembro del tablero, o el tablero no existe: se responden igual (no revelar ids).
export class BoardNotFoundError extends Error {}

// Es miembro, pero su rol no alcanza para la operacion.
export class ForbiddenError extends Error {}

// El email que se quiere agregar como miembro no pertenece a ningun usuario.
export class UserNotFoundError extends Error {}

// El usuario ya es miembro del tablero (para cambiarle el rol se usa PATCH).
export class AlreadyMemberError extends Error {}
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

// El usuario indicado en la URL no es miembro de ese tablero.
export class MemberNotFoundError extends Error {}

// La operacion dejaria al tablero sin ningun owner.
export class LastOwnerError extends Error {}

// El afterId de un movimiento no es una vecina valida: no existe, es de otro tablero o es el propio elemento.
export class InvalidMoveError extends Error {}
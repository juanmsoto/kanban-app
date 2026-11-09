import { z } from 'zod';

const dentroDelLimiteDeBcrypt = (valor: string) => Buffer.byteLength(valor, 'utf-8') <= 72;

const email = z.string().trim().toLowerCase().pipe(z.email('El email no es valido'));

export const registerSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'El nombre es obligatorio')
        .max(100, 'El nombre no puede superar los 100 caracteres'),
    email,
    password: z
        .string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .refine(dentroDelLimiteDeBcrypt, {
            error: 'La contraseña no puede superar los 72 bytes'
        })
});

export const loginSchema = z.object({
    email,
    password: z
        .string()
        .min(1, 'La contraseña es obligatoria')
        .refine(dentroDelLimiteDeBcrypt, {
            error: 'La contraseña no puede superar los 72 bytes'
        }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

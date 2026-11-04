import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import styles from './Auth.module.css';
import { login, register } from './auth.api';
import { saveToken } from '../../lib/token';
import { ApiError } from '../../lib/errors';

function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );
    const navigate = useNavigate();

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        setIsLoading(true);

        try {
            await register(name, email, password);
        } catch (err) {
            if (err instanceof ApiError && err.fields) {
                setFieldErrors(err.fields);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Error desconocido');
            }

            setIsLoading(false);
            return;
        }

        try {
            const data = await login(email, password);
            saveToken(data.token);
            navigate('/boards');
        } catch {
            navigate('/login');
        }
    }

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <div>
                    <h1 className={styles.title}>Crear cuenta</h1>
                    <p className={styles.subtitle}>
                        Registrate para empezar a armar tus tableros.
                    </p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.field}>
                        <span className={styles.label}>Nombre</span>
                        <input
                            className={styles.input}
                            type="text"
                            autoComplete="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            aria-invalid={Boolean(fieldErrors.name)}
                            required
                        />
                        {fieldErrors.name && (
                            <span className={styles.fieldError}>
                                {fieldErrors.name[0]}
                            </span>
                        )}
                    </label>

                    <label className={styles.field}>
                        <span className={styles.label}>Email</span>
                        <input
                            className={styles.input}
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            aria-invalid={Boolean(fieldErrors.email)}
                            required
                        />
                        {fieldErrors.email && (
                            <span className={styles.fieldError}>
                                {fieldErrors.email[0]}
                            </span>
                        )}
                    </label>

                    <label className={styles.field}>
                        <span className={styles.label}>Contraseña</span>
                        <input
                            className={styles.input}
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            aria-invalid={Boolean(fieldErrors.password)}
                            required
                        />
                        {fieldErrors.password && (
                            <span className={styles.fieldError}>
                                {fieldErrors.password[0]}
                            </span>
                        )}
                    </label>

                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        className={styles.button}
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
                    </button>
                </form>

                <p className={styles.footer}>
                    ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
                </p>
            </div>
        </main>
    );
}

export default Register;

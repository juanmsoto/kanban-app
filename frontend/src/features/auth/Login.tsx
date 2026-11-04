import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import styles from './Auth.module.css';
import { login } from './auth.api';
import { saveToken } from '../../lib/token';
import { ApiError } from '../../lib/errors';

function Login() {
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
            const data = await login(email, password);
            saveToken(data.token);
            navigate('/boards');
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
    }

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <div>
                    <h1 className={styles.title}>Iniciar sesión</h1>
                    <p className={styles.subtitle}>
                        Entrá para ver tus tableros.
                    </p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
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
                            autoComplete="current-password"
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
                        {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
                    </button>
                </form>

                <p className={styles.footer}>
                    ¿No tenés cuenta? <Link to="/register">Crear cuenta</Link>
                </p>
            </div>
        </main>
    );
}

export default Login;

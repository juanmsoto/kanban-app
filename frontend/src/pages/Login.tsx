import { useState, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import styles from './Auth.module.css';
import { login } from '../api/auth';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const data = await login(email, password);
            console.log(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
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
                            required
                        />
                    </label>

                    <label className={styles.field}>
                        <span className={styles.label}>Contraseña</span>
                        <input
                            className={styles.input}
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
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

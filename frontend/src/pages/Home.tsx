import { Link } from 'react-router';
import styles from './Home.module.css';

function Home() {
    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <h1 className={styles.title}>
                    Organizá el trabajo de tu equipo
                </h1>
                <p className={styles.tagline}>
                    Creá tableros con columnas y tarjetas, invitá a tu equipo y
                    mové las tareas de un estado a otro.
                </p>
                <div className={styles.actions}>
                    <Link to="/register" className={styles.primaryButton}>
                        Crear cuenta
                    </Link>
                    <Link to="/login" className={styles.secondaryButton}>
                        Iniciar sesión
                    </Link>
                </div>
            </section>

            <ul className={styles.features}>
                <li className={styles.feature}>
                    <h2 className={styles.featureTitle}>Tableros</h2>
                    <p className={styles.featureText}>
                        Un tablero por proyecto, con todas sus columnas y
                        tarjetas.
                    </p>
                </li>
                <li className={styles.feature}>
                    <h2 className={styles.featureTitle}>Equipos y roles</h2>
                    <p className={styles.featureText}>
                        Sumá miembros como propietarios, editores o lectores.
                    </p>
                </li>
                <li className={styles.feature}>
                    <h2 className={styles.featureTitle}>Orden a tu medida</h2>
                    <p className={styles.featureText}>
                        Reordená tarjetas y columnas y el orden queda guardado.
                    </p>
                </li>
            </ul>
        </main>
    );
}

export default Home;

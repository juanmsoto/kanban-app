import { Outlet } from 'react-router';
import { useSession } from '../lib/session';
import styles from './AppLayout.module.css';

function AppLayout() {
    const { session, endSession } = useSession();

    if (session.status !== 'loggedIn') {
        return null;
    }

    return (
        <>
            <nav className={styles.nav}>
                <span className={styles.brand}>Kanban</span>

                <div className={styles.user}>
                    <span className={styles.userName}>{session.user.name}</span>
                    <button
                        className={styles.logout}
                        type="button"
                        onClick={endSession}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </nav>

            <Outlet />
        </>
    );
}

export default AppLayout;

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../lib/errors';
import { useSession } from '../../lib/session';
import { getBoards, type Board } from './boards.api';
import styles from './Boards.module.css';
import CreateBoardForm from './CreateBoardForm';

const ROLE_LABELS: Record<Board['role'], string> = {
    owner: 'Propietario',
    editor: 'Editor',
    viewer: 'Lector',
};

function Boards() {
    const [boards, setBoards] = useState<Board[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { endSession } = useSession();

    useEffect(() => {
        async function loadBoards() {
            try {
                const data = await getBoards();
                setBoards(data);
            } catch (err) {
                if (err instanceof ApiError && err.status === 401) {
                    endSession();
                    return;
                }

                setError(
                    err instanceof Error ? err.message : 'Error desconocido',
                );
            } finally {
                setIsLoading(false);
            }
        }

        loadBoards();
    }, [endSession]);

    function handleCreated(board: Board) {
        setBoards([board, ...boards]);
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Mis tableros</h1>

            <CreateBoardForm onCreated={handleCreated} />

            {isLoading && <p className={styles.message}>Cargando...</p>}

            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            {!isLoading && !error && boards.length === 0 && (
                <p className={styles.message}>Todavía no tenés tableros.</p>
            )}

            {boards.length > 0 && (
                <ul className={styles.list}>
                    {boards.map((board) => (
                        <li key={board.id}>
                            <Link
                                className={styles.card}
                                to={`/boards/${board.id}`}
                            >
                                <span className={styles.cardName}>
                                    {board.name}
                                </span>
                                {board.description && (
                                    <span className={styles.cardDescription}>
                                        {board.description}
                                    </span>
                                )}
                                <span className={styles.cardRole}>
                                    {ROLE_LABELS[board.role]}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}

export default Boards;

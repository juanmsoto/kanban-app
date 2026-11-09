import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../lib/errors';
import { useSession } from '../../lib/session';
import {
    getBoard,
    type BoardDetail,
    type Card,
    type Column,
} from './boards.api';
import CreateColumnForm from './CreateColumnForm';
import CreateCardDialog from './CreateCardDialog';
import styles from './Board.module.css';

function Board() {
    const { id } = useParams();
    const [board, setBoard] = useState<BoardDetail | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { endSession } = useSession();

    useEffect(() => {
        let ignore = false;

        async function loadBoard() {
            if (id === undefined) {
                return;
            }

            setIsLoading(true);
            setError('');

            try {
                const data = await getBoard(id);

                if (!ignore) {
                    setBoard(data);
                }
            } catch (err) {
                if (ignore) {
                    return;
                }

                if (err instanceof ApiError && err.status === 401) {
                    endSession();
                    return;
                }

                setBoard(null);
                setError(
                    err instanceof Error ? err.message : 'Error desconocido',
                );
            } finally {
                if (!ignore) {
                    setIsLoading(false);
                }
            }
        }

        loadBoard();

        return () => {
            ignore = true;
        };
    }, [id, endSession]);

    function handleColumnCreated(column: Omit<Column, 'cards'>) {
        if (board === null) {
            return;
        }

        setBoard({
            ...board,
            columns: [...board.columns, { ...column, cards: [] }],
        });
    }

    function handleCardCreated(card: Card) {
        if (board === null) {
            return;
        }

        setBoard({
            ...board,
            columns: board.columns.map((column) =>
                column.id === card.columnId
                    ? { ...column, cards: [...column.cards, card] }
                    : column,
            ),
        });
    }

    return (
        <main className={styles.page}>
            <Link className={styles.back} to="/boards">
                Volver a mis tableros
            </Link>

            {isLoading && <p className={styles.message}>Cargando...</p>}

            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            {board && !isLoading && (
                <>
                    <div>
                        <h1 className={styles.title}>{board.name}</h1>
                        {board.description && (
                            <p className={styles.description}>
                                {board.description}
                            </p>
                        )}
                    </div>

                    {board.role !== 'viewer' && (
                        <CreateColumnForm
                            boardId={board.id}
                            onCreated={handleColumnCreated}
                        />
                    )}

                    {board.columns.length === 0 && (
                        <p className={styles.message}>
                            Este tablero todavía no tiene columnas.
                        </p>
                    )}

                    <div className={styles.columns}>
                        {board.columns.map((column) => (
                            <section className={styles.column} key={column.id}>
                                <h2 className={styles.columnTitle}>
                                    {column.title}
                                </h2>

                                {column.cards.length === 0 ? (
                                    <p className={styles.emptyColumn}>
                                        Sin tarjetas
                                    </p>
                                ) : (
                                    <ul className={styles.cards}>
                                        {column.cards.map((card) => (
                                            <li
                                                className={styles.card}
                                                key={card.id}
                                            >
                                                <span
                                                    className={styles.cardTitle}
                                                >
                                                    {card.title}
                                                </span>
                                                {card.description && (
                                                    <span
                                                        className={
                                                            styles.cardDescription
                                                        }
                                                    >
                                                        {card.description}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {board.role !== 'viewer' && (
                                    <CreateCardDialog
                                        columnId={column.id}
                                        columnTitle={column.title}
                                        onCreated={handleCardCreated}
                                    />
                                )}
                            </section>
                        ))}
                    </div>
                </>
            )}
        </main>
    );
}

export default Board;

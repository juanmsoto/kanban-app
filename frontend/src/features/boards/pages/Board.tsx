import { useEffect, useState } from 'react';
import styles from './Board.module.css';
import { Link, useParams, useNavigate } from 'react-router';
import { ApiError } from '../../../services/errors';
import { useSession } from '../../../context/session';
import {
    getBoard,
    type BoardDetail,
    type Card,
    type Column,
} from '../services/boards.api';
import CreateColumnForm from '../components/CreateColumnForm';
import CreateCardDialog from '../components/CreateCardDialog';
import EditCardDialog from '../components/EditCardDialog';
import EditColumnDialog from '../components/EditColumnDialog';
import EditBoardDialog from '../components/EditBoardDialog';

import { DragDropProvider } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import SortableCard from '../components/SortableCard';

function Board() {
    const { id } = useParams();
    const navigate = useNavigate();
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

    function handleBoardUpdated(updatedBoard: Omit<BoardDetail, 'columns'>) {
        if (board === null) {
            return;
        }

        setBoard({ ...board, ...updatedBoard });
    }

    function handleBoardDeleted() {
        navigate('/boards', { replace: true });
    }

    function handleColumnCreated(column: Omit<Column, 'cards'>) {
        if (board === null) {
            return;
        }

        setBoard({
            ...board,
            columns: [...board.columns, { ...column, cards: [] }],
        });
    }

    function handleColumnUpdated(updatedColumn: Omit<Column, 'cards'>) {
        if (board === null) {
            return;
        }

        setBoard({
            ...board,
            columns: board.columns.map((column) =>
                column.id === updatedColumn.id
                    ? { ...column, title: updatedColumn.title }
                    : column,
            ),
        });
    }

    function handleColumnDeleted(columnId: number) {
        if (board === null) {
            return;
        }

        setBoard({
            ...board,
            columns: board.columns.filter((column) => column.id !== columnId),
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

    function handleCardUpdated(updatedCard: Card) {
        if (board === null) {
            return;
        }

        setBoard({
            ...board,
            columns: board.columns.map((column) =>
                column.id === updatedCard.columnId
                    ? {
                          ...column,
                          cards: column.cards.map((card) =>
                              card.id === updatedCard.id ? updatedCard : card,
                          ),
                      }
                    : column,
            ),
        });
    }

    function handleCardDeleted(deletedCard: Card) {
        if (board === null) {
            return;
        }

        setBoard({
            ...board,
            columns: board.columns.map((column) =>
                column.id === deletedCard.columnId
                    ? {
                          ...column,
                          cards: column.cards.filter(
                              (card) => card.id !== deletedCard.id,
                          ),
                      }
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
                    <div className={styles.titleRow}>
                        <h1 className={styles.title}>{board.name}</h1>
                        {board.role !== 'viewer' && (
                            <EditBoardDialog
                                board={board}
                                onUpdated={handleBoardUpdated}
                                onDeleted={handleBoardDeleted}
                            />
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

                    <DragDropProvider
                        onDragEnd={(event) => {
                            if (event.canceled) {
                                return;
                            }

                            const { source } = event.operation;

                            if (isSortable(source)) {
                                console.log({
                                    cardId: source.id,
                                    desde: {
                                        columna: source.initialGroup,
                                        posicion: source.initialIndex,
                                    },
                                    hasta: {
                                        columna: source.group,
                                        posicion: source.index,
                                    },
                                });
                            }
                        }}
                    >
                        <div className={styles.columns}>
                            {board.columns.map((column) => (
                                <section
                                    className={styles.column}
                                    key={column.id}
                                >
                                    <div className={styles.columnHeader}>
                                        <h2 className={styles.columnTitle}>
                                            {column.title}
                                        </h2>
                                        {board.role !== 'viewer' && (
                                            <EditColumnDialog
                                                column={column}
                                                onUpdated={handleColumnUpdated}
                                                onDeleted={handleColumnDeleted}
                                            />
                                        )}
                                    </div>

                                    {column.cards.length === 0 ? (
                                        <p className={styles.emptyColumn}>
                                            Sin tarjetas
                                        </p>
                                    ) : (
                                        <ul className={styles.cards}>
                                            {column.cards.map((card, index) => (
                                                <SortableCard
                                                    key={card.id}
                                                    id={card.id}
                                                    index={index}
                                                    columnId={column.id}
                                                    title={card.title}
                                                    canDrag={
                                                        board.role !== 'viewer'
                                                    }
                                                    className={styles.card}
                                                >
                                                    <EditCardDialog
                                                        card={card}
                                                        canEdit={
                                                            board.role !==
                                                            'viewer'
                                                        }
                                                        onUpdated={
                                                            handleCardUpdated
                                                        }
                                                        onDeleted={
                                                            handleCardDeleted
                                                        }
                                                    >
                                                        <span
                                                            className={
                                                                styles.cardTitle
                                                            }
                                                        >
                                                            {card.title}
                                                        </span>
                                                        {card.description && (
                                                            <span
                                                                className={
                                                                    styles.cardDescription
                                                                }
                                                            >
                                                                {
                                                                    card.description
                                                                }
                                                            </span>
                                                        )}
                                                    </EditCardDialog>
                                                </SortableCard>
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
                    </DragDropProvider>
                </>
            )}
        </main>
    );
}

export default Board;

import { useRef, useState, type SubmitEvent } from 'react';
import { deleteBoard, updateBoard, type Board } from '../services/boards.api';
import { useSession } from '../../../context/session';
import { ApiError } from '../../../services/errors';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import styles from './CreateCardDialog.module.css';

type EditBoardDialogProps = {
    board: Board;
    onUpdated: (board: Board) => void;
    onDeleted: () => void;
};

function EditBoardDialog({
    board,
    onUpdated,
    onDeleted,
}: EditBoardDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );
    const [isLoading, setIsLoading] = useState(false);
    const { endSession } = useSession();

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        setIsLoading(true);

        try {
            const updatedBoard = await updateBoard(board.id, name, description);

            onUpdated(updatedBoard);
            handleClose();
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                endSession();
                return;
            }

            if (err instanceof ApiError && err.fields) {
                setFieldErrors(err.fields);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Error desconocido');
            }
        } finally {
            setIsLoading(false);
        }
    }

    function handleOpen() {
        setName(board.name);
        setDescription(board.description ?? '');
        setError('');
        setFieldErrors({});
        dialogRef.current?.showModal();
    }

    function handleClose() {
        dialogRef.current?.close();
    }

    async function handleDelete() {
        await deleteBoard(board.id);
        onDeleted();
    }

    return (
        <>
            <button
                className={styles.iconButton}
                type="button"
                onClick={handleOpen}
                aria-label={`Editar tablero ${board.name}`}
            >
                ✎
            </button>

            <dialog
                className={styles.dialog}
                ref={dialogRef}
                aria-label={`Editar tablero ${board.name}`}
            >
                <form className={styles.form} onSubmit={handleSubmit}>
                    <h2 className={styles.title}>Editar tablero</h2>

                    <label className={styles.field}>
                        <span className={styles.label}>Nombre</span>
                        <input
                            className={styles.input}
                            type="text"
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
                        <span className={styles.label}>
                            Descripción (opcional)
                        </span>
                        <textarea
                            className={styles.input}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            aria-invalid={Boolean(fieldErrors.description)}
                        />
                        {fieldErrors.description && (
                            <span className={styles.fieldError}>
                                {fieldErrors.description[0]}
                            </span>
                        )}
                    </label>

                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}

                    <div className={styles.actions}>
                        {board.role === 'owner' && (
                            <ConfirmDialog
                                triggerLabel="Eliminar"
                                title="Eliminar tablero"
                                message={`Se va a eliminar "${board.name}" con todas sus columnas y tarjetas. Esta acción no se puede deshacer.`}
                                onConfirm={handleDelete}
                            />
                        )}
                        <button
                            className={styles.secondaryButton}
                            type="button"
                            onClick={handleClose}
                        >
                            Cancelar
                        </button>
                        <button
                            className={styles.primaryButton}
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </dialog>
        </>
    );
}

export default EditBoardDialog;

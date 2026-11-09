import { useRef, useState, type SubmitEvent } from 'react';
import { deleteColumn, updateColumn, type Column } from './boards.api';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useSession } from '../../lib/session';
import { ApiError } from '../../lib/errors';
import styles from './CreateCardDialog.module.css';

type EditColumnDialogProps = {
    column: Column;
    onUpdated: (column: Omit<Column, 'cards'>) => void;
    onDeleted: (columnId: number) => void;
};

function EditColumnDialog({
    column,
    onUpdated,
    onDeleted,
}: EditColumnDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [title, setTitle] = useState('');
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
            const updatedCard = await updateColumn(column.id, title);

            onUpdated(updatedCard);
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
        setTitle(column.title);
        setError('');
        setFieldErrors({});
        dialogRef.current?.showModal();
    }

    function handleClose() {
        dialogRef.current?.close();
    }

    async function handleDelete() {
        await deleteColumn(column.id);
        onDeleted(column.id);
    }

    return (
        <>
            <button
                className={styles.iconButton}
                type="button"
                onClick={handleOpen}
                aria-label={`Editar columna ${column.title}`}
            >
                ✎
            </button>

            <dialog
                className={styles.dialog}
                ref={dialogRef}
                aria-label={`Editar columna ${column.title}`}
            >
                <form className={styles.form} onSubmit={handleSubmit}>
                    <h2 className={styles.title}>Editar columna</h2>

                    <label className={styles.field}>
                        <span className={styles.label}>Título</span>
                        <input
                            className={styles.input}
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            aria-invalid={Boolean(fieldErrors.title)}
                            required
                        />
                        {fieldErrors.title && (
                            <span className={styles.fieldError}>
                                {fieldErrors.title[0]}
                            </span>
                        )}
                    </label>

                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}

                    <div className={styles.actions}>
                        <ConfirmDialog
                            triggerLabel="Eliminar"
                            title="Eliminar columna"
                            message={`Se va a eliminar "${column.title}" con todas sus tarjetas. Esta acción no se puede deshacer.`}
                            onConfirm={handleDelete}
                        />
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

export default EditColumnDialog;

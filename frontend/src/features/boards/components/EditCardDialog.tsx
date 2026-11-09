import { useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { deleteCard, updateCard, type Card } from '../services/boards.api';
import { useSession } from '../../../context/session';
import { ApiError } from '../../../services/errors';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import styles from './CreateCardDialog.module.css';

type EditCardDialogProps = {
    card: Card;
    canEdit: boolean;
    onUpdated: (card: Card) => void;
    onDeleted: (card: Card) => void;
    children: ReactNode;
};

function EditCardDialog({
    card,
    canEdit,
    onUpdated,
    onDeleted,
    children,
}: EditCardDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [title, setTitle] = useState('');
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
            const updatedCard = await updateCard(card.id, title, description);

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
        setTitle(card.title);
        setDescription(card.description ?? '');
        setError('');
        setFieldErrors({});
        dialogRef.current?.showModal();
    }

    function handleClose() {
        dialogRef.current?.close();
    }

    async function handleDelete() {
        await deleteCard(card.id);
        onDeleted(card);
    }

    return (
        <>
            <button
                className={styles.cardButton}
                type="button"
                onClick={handleOpen}
                disabled={!canEdit}
            >
                {children}
            </button>

            <dialog
                className={styles.dialog}
                ref={dialogRef}
                aria-label={`Editar tarjeta ${card.title}`}
            >
                <form className={styles.form} onSubmit={handleSubmit}>
                    <h2 className={styles.title}>Editar tarjeta</h2>

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
                        <ConfirmDialog
                            triggerLabel="Eliminar"
                            title="Eliminar tarjeta"
                            message={`Se va a eliminar "${card.title}". Esta acción no se puede deshacer.`}
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

export default EditCardDialog;

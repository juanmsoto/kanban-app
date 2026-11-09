import { useRef, useState, type SubmitEvent } from 'react';
import { useSession } from '../../../context/session';
import { ApiError } from '../../../services/errors';
import { createCard, type Card } from '../services/boards.api';
import styles from './CreateCardDialog.module.css';

type CreateCardDialogProps = {
    columnId: number;
    columnTitle: string;
    onCreated: (card: Card) => void;
};

function CreateCardDialog({
    columnId,
    columnTitle,
    onCreated,
}: CreateCardDialogProps) {
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
            const card = await createCard(columnId, title, description);

            onCreated(card);

            setTitle('');
            setDescription('');
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
        setError('');
        setFieldErrors({});
        dialogRef.current?.showModal();
    }

    function handleClose() {
        dialogRef.current?.close();
    }

    return (
        <>
            <button
                className={styles.openButton}
                type="button"
                onClick={handleOpen}
                aria-label={`Agregar tarjeta en ${columnTitle}`}
            >
                +
            </button>

            <dialog
                className={styles.dialog}
                ref={dialogRef}
                aria-label={`Nueva tarjeta en ${columnTitle}`}
            >
                <form className={styles.form} onSubmit={handleSubmit}>
                    <h2 className={styles.title}>Nueva tarjeta</h2>

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
                            {isLoading ? 'Creando...' : 'Crear tarjeta'}
                        </button>
                    </div>
                </form>
            </dialog>
        </>
    );
}

export default CreateCardDialog;

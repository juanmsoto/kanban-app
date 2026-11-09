import { useState, type SubmitEvent } from 'react';
import { ApiError } from '../../../services/errors';
import { useSession } from '../../../context/session';
import { createBoard, type Board } from '../services/boards.api';
import styles from './CreateBoardForm.module.css';

type CreateBoardFormProps = {
    onCreated: (board: Board) => void;
};

function CreateBoardForm({ onCreated }: CreateBoardFormProps) {
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
            const board = await createBoard(name, description);
            onCreated(board);
            setName('');
            setDescription('');
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

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
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
                <span className={styles.label}>Descripción (opcional)</span>
                <input
                    className={styles.input}
                    type="text"
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

            <button
                className={styles.button}
                type="submit"
                disabled={isLoading}
            >
                {isLoading ? 'Creando...' : 'Crear tablero'}
            </button>
        </form>
    );
}

export default CreateBoardForm;

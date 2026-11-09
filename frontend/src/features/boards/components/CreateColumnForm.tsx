import { useState, type SubmitEvent } from 'react';
import { createColumn, type Column } from '../services/boards.api';
import { useSession } from '../../../context/session';
import { ApiError } from '../../../services/errors';
import styles from './CreateColumnForm.module.css';

type CreateColumnFormProps = {
    boardId: number;
    onCreated: (column: Omit<Column, 'cards'>) => void;
};

function CreateColumnForm({ boardId, onCreated }: CreateColumnFormProps) {
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
            const column = await createColumn(boardId, title);
            onCreated(column);
            setTitle('');
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
                <span className={styles.label}>Nueva columna</span>
                <input
                    className={styles.input}
                    type="text"
                    placeholder="Nueva columna"
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

            <button
                className={styles.button}
                type="submit"
                disabled={isLoading}
            >
                {isLoading ? 'Creando...' : 'Agregar columna'}
            </button>
        </form>
    );
}

export default CreateColumnForm;

import { useRef, useState } from 'react';
import { useSession } from '../../context/session';
import { ApiError } from '../../services/errors';
import styles from './ConfirmDialog.module.css';

type ConfirmDialogProps = {
    triggerLabel: string;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
    confirmLabel?: string;
    pendingLabel?: string;
};

function ConfirmDialog({
    triggerLabel,
    title,
    message,
    onConfirm,
    confirmLabel = 'Eliminar',
    pendingLabel = 'Eliminando...',
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { endSession } = useSession();

    async function handleConfirm() {
        setError('');
        setIsLoading(true);

        try {
            await onConfirm();
            handleClose();
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                endSession();
                return;
            }

            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    }

    function handleOpen() {
        setError('');
        dialogRef.current?.showModal();
    }

    function handleClose() {
        dialogRef.current?.close();
    }

    return (
        <>
            <button
                className={styles.trigger}
                type="button"
                onClick={handleOpen}
            >
                {triggerLabel}
            </button>

            <dialog
                className={styles.dialog}
                ref={dialogRef}
                aria-label={title}
            >
                <div className={styles.content}>
                    <h2 className={styles.title}>{title}</h2>
                    <p className={styles.message}>{message}</p>

                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}

                    <div className={styles.actions}>
                        <button
                            className={styles.cancelButton}
                            type="button"
                            onClick={handleClose}
                        >
                            Cancelar
                        </button>
                        <button
                            className={styles.confirmButton}
                            type="button"
                            onClick={handleConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? pendingLabel : confirmLabel}
                        </button>
                    </div>
                </div>
            </dialog>
        </>
    );
}

export default ConfirmDialog;

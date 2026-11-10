import { useRef, useState, type SubmitEvent } from 'react';
import {
    addMember,
    getMembers,
    removeMember,
    updateMemberRole,
    type BoardRole,
    type Member,
} from '../services/boards.api';
import { useSession } from '../../../context/session';
import { ApiError } from '../../../services/errors';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import formStyles from './CreateCardDialog.module.css';
import styles from './MembersDialog.module.css';

const roleLabels: Record<BoardRole, string> = {
    owner: 'Dueño',
    editor: 'Editor',
    viewer: 'Lector',
};

const roles: BoardRole[] = ['owner', 'editor', 'viewer'];

type MembersDialogProps = {
    boardId: number;
    boardName: string;
    role: BoardRole;
    onOwnRoleChanged: (role: BoardRole) => void;
    onLeft: () => void;
};

function MembersDialog({
    boardId,
    boardName,
    role,
    onOwnRoleChanged,
    onLeft,
}: MembersDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [email, setEmail] = useState('');
    const [newRole, setNewRole] = useState<BoardRole>('editor');
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );
    const { session, endSession } = useSession();

    const currentUserId =
        session.status === 'loggedIn' ? session.user.id : null;
    const isOwner = role === 'owner';

    function handleError(err: unknown, show: (message: string) => void) {
        if (err instanceof ApiError && err.status === 401) {
            endSession();
            return;
        }

        show(err instanceof Error ? err.message : 'Error desconocido');
    }

    async function loadMembers() {
        setIsLoading(true);
        setError('');

        try {
            const data = await getMembers(boardId);
            setMembers(data);
        } catch (err) {
            handleError(err, setError);
        } finally {
            setIsLoading(false);
        }
    }

    function handleOpen() {
        setMembers([]);
        setEmail('');
        setNewRole('editor');
        setAddError('');
        setFieldErrors({});
        dialogRef.current?.showModal();
        loadMembers();
    }

    function handleClose() {
        dialogRef.current?.close();
    }

    async function handleAdd(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setAddError('');
        setFieldErrors({});
        setIsAdding(true);

        try {
            const member = await addMember(boardId, email, newRole);
            setMembers([...members, member]);
            setEmail('');
        } catch (err) {
            if (err instanceof ApiError && err.fields) {
                setFieldErrors(err.fields);
            } else {
                handleError(err, setAddError);
            }
        } finally {
            setIsAdding(false);
        }
    }

    async function handleRoleChange(member: Member, nextRole: BoardRole) {
        setError('');
        setAddError('');
        setUpdatingId(member.id);

        try {
            const updated = await updateMemberRole(boardId, member.id, nextRole);

            setMembers(
                members.map((m) => (m.id === updated.id ? updated : m)),
            );

            if (updated.id === currentUserId) {
                onOwnRoleChanged(updated.role);
            }
        } catch (err) {
            handleError(err, setError);
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleRemove(member: Member) {
        await removeMember(boardId, member.id);

        if (member.id === currentUserId) {
            onLeft();
            return;
        }

        setMembers(members.filter((m) => m.id !== member.id));
    }

    return (
        <>
            <button
                className={styles.openButton}
                type="button"
                onClick={handleOpen}
            >
                Miembros
            </button>

            <dialog
                className={styles.dialog}
                ref={dialogRef}
                aria-label={`Miembros de ${boardName}`}
            >
                <div className={styles.content}>
                    <h2 className={formStyles.title}>Miembros de {boardName}</h2>

                    {isLoading && (
                        <p className={styles.message}>Cargando miembros...</p>
                    )}

                    {!isLoading && members.length > 0 && (
                        <ul className={styles.list}>
                            {members.map((member) => {
                                const isMe = member.id === currentUserId;

                                return (
                                    <li className={styles.member} key={member.id}>
                                        <div className={styles.info}>
                                            <span className={styles.name}>
                                                {member.name}
                                                {isMe && (
                                                    <span className={styles.you}>
                                                        {' '}
                                                        (vos)
                                                    </span>
                                                )}
                                            </span>
                                            <span className={styles.email}>
                                                {member.email}
                                            </span>
                                        </div>

                                        {isOwner ? (
                                            <select
                                                className={styles.roleSelect}
                                                value={member.role}
                                                onChange={(e) =>
                                                    handleRoleChange(
                                                        member,
                                                        e.target.value as BoardRole,
                                                    )
                                                }
                                                disabled={updatingId === member.id}
                                                aria-label={`Rol de ${member.name}`}
                                            >
                                                {roles.map((r) => (
                                                    <option key={r} value={r}>
                                                        {roleLabels[r]}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={styles.roleBadge}>
                                                {roleLabels[member.role]}
                                            </span>
                                        )}

                                        {isMe && (
                                            <ConfirmDialog
                                                triggerLabel="Salir"
                                                title="Salir del tablero"
                                                message={`Vas a dejar de ver "${boardName}". Para volver, un dueño te tiene que agregar de nuevo.`}
                                                confirmLabel="Salir"
                                                pendingLabel="Saliendo..."
                                                onConfirm={() => handleRemove(member)}
                                            />
                                        )}

                                        {!isMe && isOwner && (
                                            <ConfirmDialog
                                                triggerLabel="Quitar"
                                                title="Quitar miembro"
                                                message={`${member.name} va a dejar de ver "${boardName}".`}
                                                confirmLabel="Quitar"
                                                pendingLabel="Quitando..."
                                                onConfirm={() => handleRemove(member)}
                                            />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {error && (
                        <p className={formStyles.error} role="alert">
                            {error}
                        </p>
                    )}

                    {isOwner && (
                        <form className={formStyles.form} onSubmit={handleAdd}>
                            <h3 className={styles.sectionTitle}>
                                Agregar miembro
                            </h3>

                            <div className={styles.addForm}>
                                <label
                                    className={`${formStyles.field} ${styles.emailField}`}
                                >
                                    <span className={formStyles.label}>
                                        Email
                                    </span>
                                    <input
                                        className={formStyles.input}
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        aria-invalid={Boolean(fieldErrors.email)}
                                        required
                                    />
                                    {fieldErrors.email && (
                                        <span className={formStyles.fieldError}>
                                            {fieldErrors.email[0]}
                                        </span>
                                    )}
                                </label>

                                <label className={formStyles.field}>
                                    <span className={formStyles.label}>Rol</span>
                                    <select
                                        className={formStyles.input}
                                        value={newRole}
                                        onChange={(e) =>
                                            setNewRole(e.target.value as BoardRole)
                                        }
                                    >
                                        {roles.map((r) => (
                                            <option key={r} value={r}>
                                                {roleLabels[r]}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {addError && (
                                <p className={formStyles.error} role="alert">
                                    {addError}
                                </p>
                            )}

                            <div className={formStyles.actions}>
                                <button
                                    className={formStyles.primaryButton}
                                    type="submit"
                                    disabled={isAdding}
                                >
                                    {isAdding ? 'Agregando...' : 'Agregar'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className={formStyles.actions}>
                        <button
                            className={formStyles.secondaryButton}
                            type="button"
                            onClick={handleClose}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </dialog>
        </>
    );
}

export default MembersDialog;

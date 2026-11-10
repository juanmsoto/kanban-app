import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import styles from './SortableCard.module.css';

type SortableCardProps = {
    id: number;
    index: number;
    columnId: number;
    title: string;
    canDrag: boolean;
    className: string;
    children: ReactNode;
};

function SortableCard({
    id,
    index,
    columnId,
    title,
    canDrag,
    className,
    children,
}: SortableCardProps) {
    const { ref, handleRef } = useSortable({
        id,
        index,
        group: columnId,
        type: 'card',
        accept: 'card',
        disabled: !canDrag,
    });

    return (
        <li ref={ref} className={className}>
            {canDrag && (
                <button
                    ref={handleRef}
                    className={styles.handle}
                    type="button"
                    aria-label={`Mover tarjeta ${title}`}
                >
                    ⠿
                </button>
            )}
            {children}
        </li>
    );
}

export default SortableCard;

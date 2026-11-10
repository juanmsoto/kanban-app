import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import styles from './SortableColumn.module.css';

type SortableColumnProps = {
    id: string;
    index: number;
    title: string;
    canDrag: boolean;
    className: string;
    children: ReactNode;
};

function SortableColumn({
    id,
    index,
    title,
    canDrag,
    className,
    children,
}: SortableColumnProps) {
    const { ref, handleRef } = useSortable({
        id,
        index,
        type: 'column',
        accept: ['card', 'column'],
        collisionPriority: 1,
        disabled: !canDrag,
    });

    return (
        <section ref={ref} className={className}>
            {canDrag && (
                <button
                    ref={handleRef}
                    className={styles.handle}
                    type="button"
                    aria-label={`Mover columna ${title}`}
                >
                    ⠿⠿
                </button>
            )}
            {children}
        </section>
    );
}

export default SortableColumn;

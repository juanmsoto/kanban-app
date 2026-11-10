import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/react';

type DroppableColumnProps = {
    id: string;
    className: string;
    children: ReactNode;
};

function DroppableColumn({ id, className, children }: DroppableColumnProps) {
    const { ref } = useDroppable({
        id,
        type: 'column',
        accept: 'card',
        collisionPriority: 1,
    });

    return (
        <section ref={ref} className={className}>
            {children}
        </section>
    );
}

export default DroppableColumn;

import { useState } from 'react';
import './App.css';

type CardProps = {
    title: string;
};

function Card({ title }: CardProps) {
    const [isDone, setIsDone] = useState(false);

    return (
        <div>
            <p>{title}</p>
            <p>{isDone ? 'Hecha' : 'Pendiente'}</p>
            <button onClick={() => setIsDone(!isDone)}>Alternar</button>
        </div>
    );
}

function App() {
    return (
        <div>
            <h1>Hola, Kanban App</h1>
            <Card title="Estudiar React" />
            <Card title="Hacer el login" />
        </div>
    );
}

export default App;

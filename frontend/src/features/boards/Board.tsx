import { Link, useParams } from 'react-router';

function Board() {
    const { id } = useParams();

    return (
        <div>
            <h1>Tablero {id}</h1>
            <Link to="/boards">Volver</Link>
        </div>
    );
}

export default Board;

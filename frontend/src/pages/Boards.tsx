import { Link } from 'react-router';

function Boards() {
    return (
        <div>
            <h1>Mis tableros</h1>
            <Link to="/boards/1">Tablero 1</Link>
        </div>
    );
}

export default Boards;

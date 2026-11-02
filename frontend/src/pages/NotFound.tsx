import { Link } from 'react-router';

function NotFound() {
    return (
        <div>
            <h1>Página no encontrada</h1>
            <Link to="/">Volver</Link>
        </div>
    );
}

export default NotFound;

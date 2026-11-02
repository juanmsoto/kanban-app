import { Link } from 'react-router';

function Login() {
    return (
        <div>
            <h1>Iniciar sesión</h1>
            <Link to="/boards">Mis tableros</Link>
        </div>
    );
}

export default Login;

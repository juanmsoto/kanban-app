import { Navigate, Outlet } from 'react-router';
import { useSession } from '../lib/session';

function PublicRoute() {
    const { session } = useSession();

    if (session.status === 'checking') {
        return <p>Cargando...</p>;
    }

    if (session.status === 'loggedIn') {
        return <Navigate to="/boards" replace />;
    }

    return <Outlet />;
}

export default PublicRoute;

import { Navigate, Outlet } from 'react-router';
import { useSession } from '../lib/session';

function ProtectedRoute() {
    const { session } = useSession();

    if (session.status === 'checking') {
        return <p>Cargando...</p>;
    }

    if (session.status === 'loggedOut') {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;

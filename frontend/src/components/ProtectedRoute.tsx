import { Navigate, Outlet } from 'react-router';
import { getToken } from '../auth/token';

function ProtectedRoute() {
    const token = getToken();

    const isAllowed = token !== null;

    if (!isAllowed) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;

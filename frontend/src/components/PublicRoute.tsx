import { Navigate, Outlet } from 'react-router';
import { getToken } from '../auth/token';

function PublicRoute() {
    const token = getToken();

    const isLoggedIn = token !== null;

    if (isLoggedIn) {
        return <Navigate to="/boards" replace />;
    }

    return <Outlet />;
}

export default PublicRoute;

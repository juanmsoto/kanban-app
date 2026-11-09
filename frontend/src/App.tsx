import { BrowserRouter, Routes, Route } from 'react-router';
import Home from './pages/Home';
import Login from './features/auth/pages/Login';
import Register from './features/auth/pages/Register';
import Boards from './features/boards/pages/Boards';
import Board from './features/boards/pages/Board';
import NotFound from './pages/NotFound';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './routes/PublicRoute';
import AppLayout from './components/layout/AppLayout';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<PublicRoute />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                </Route>
                <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                        <Route path="/boards" element={<Boards />} />
                        <Route path="/boards/:id" element={<Board />} />
                    </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

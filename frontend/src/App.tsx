import { BrowserRouter, Routes, Route } from 'react-router';
import Home from './pages/Home';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import Boards from './features/boards/Boards';
import Board from './features/boards/Board';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';

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
                    <Route path="/boards" element={<Boards />} />
                    <Route path="/boards/:id" element={<Board />} />
                </Route>
                <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

import { BrowserRouter, Routes, Route, useParams, Link } from 'react-router';
import './App.css';

function Home() {
    return <h1>Inicio</h1>;
}

function About() {
    return <h1>Acerca de</h1>;
}

function Login() {
    return (
        <div>
            <h1>Iniciar sesion</h1>
            <Link to="/boards">Mis tableros</Link>
        </div>
    );
}

function Boards() {
    return (
        <div>
            <h1>Mis tableros</h1>
            <Link to="/boards/1">Tablero 1</Link>
        </div>
    );
}

function Board() {
    const { id } = useParams();

    return (
        <div>
            <h1>Tablero {id}</h1>
            <Link to="/boards">Volver</Link>
        </div>
    );
}

function NotFound() {
    return (
        <div>
            <h1>Página no encontrada</h1>
            <Link to="/boards">Volver</Link>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/login" element={<Login />} />
                <Route path="/boards" element={<Boards />} />
                <Route path="/boards/:id" element={<Board />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

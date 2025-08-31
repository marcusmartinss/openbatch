import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

// Estilos globais
import './styles/main.css';
import './styles/components.css';
import './styles/sections.css';

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  // Estado para armazenar o nome do usuário
  const [currentUser, setCurrentUser] = useState(null);

  // useEffect para definir o usuário ao carregar a página se já houver um token
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setCurrentUser(decodedToken.username);
      } catch (error) {
        console.error("Erro ao decodificar o token:", error);
        // Se o token for inválido, faz o logout
        handleLogout();
      }
    }
  }, []); // O array vazio garante que rode apenas uma vez

  const handleLogin = (token) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    // Decodifica o token e define o usuário no estado após o login
    try {
      const decodedToken = jwtDecode(token);
      setCurrentUser(decodedToken.username);
    } catch (error) {
      console.error("Erro ao decodificar o token no login:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    // Limpa o usuário do estado ao fazer logout
    setCurrentUser(null);
  };

  return (
    <>
      {authToken ? (
        // Passa o nome do usuário para a página principal
        <Dashboard user={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </>
  );
}

export default App;
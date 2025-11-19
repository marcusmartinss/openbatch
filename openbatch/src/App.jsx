import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';

// Estilos globais
import './styles/main.css';
import './styles/components.css';
import './styles/sections.css';

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setCurrentUser(decodedToken.username);
      } catch (error) {
        console.error("Token inválido:", error);
        handleLogout();
      }
    }
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    try {
      const decodedToken = jwtDecode(token);
      setCurrentUser(decodedToken.username);
    } catch (error) {
      console.error("Erro no login:", error);
    }
  };

  const handleLogout = () => {
    console.log("Logout acionado!");
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setCurrentUser(null);
  };

  return (
    <>
      {authToken ? (
        <Dashboard user={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </>
  );
}

export default App;
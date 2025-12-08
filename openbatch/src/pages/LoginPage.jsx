import React, { useState } from 'react';
import '../styles/login.css';

// Recebe a função onLogin para passar o token para o App.jsx
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Se a resposta for OK (200), chama a função onLogin com o token
        console.log('Login validado, passando o token para o App.');
        onLogin(data.token);
      } else {
        // Se a resposta for de erro, mostra a mensagem do servidor
        setError(data.message || 'Credenciais inválidas.');
      }
    } catch (err) {
      // Tratamento de erros na rede
      console.error('Erro de rede:', err);
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <h1 className="app-brand-title">OpenBatch</h1>
      
      <div className="login-box">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="user-box">
            <input
              type="text"
              name="usuario"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder=" "
            />
            <label>Usuário</label>
          </div>
          <div className="user-box">
            <input
              type="password"
              name="senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
            />
            <label>Senha</label>
          </div>

          {/* Exibe a mensagem de erro, se houver */}
          {error && <p style={{ color: '#ff4d4d', textAlign: 'center', fontSize: '14px' }}>{error}</p>}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
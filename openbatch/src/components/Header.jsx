import React from 'react';

function Header({ user, onLogout }) {
  return (
    <header className="main-header">
      <div className="logo">
        OpenBatch
      </div>
      
      <div className="user-info">
        <span className="user-greeting">
          Olá, <span className="user-name">{user}</span>
        </span>
        
        <button
          onClick={onLogout}
          className="logout-btn"
          aria-label="Sair da aplicação"
        >
          Sair
        </button>
      </div>
    </header>
  );
}

export default Header;
import React from 'react';

function Header({ user, onLogout }) {
  return (
    <header>
      <div className="logo">OpenBatch</div>
      <div className="user-info">
        <span>Olá, {user || 'Usuário'}!</span>
        <button
          onClick={onLogout}
          className="logout-btn" 
        >
          Sair
        </button>
      </div>
    </header>
  );
}

export default Header;
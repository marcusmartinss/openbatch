import React from 'react';

function Navigation({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'submitJob', label: 'Submeter Job' },
    { id: 'uploadModules', label: 'Upload Módulos' },
    { id: 'observability', label: 'Observabilidade' },
  ];

  return (
    <nav className="main-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-link ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default Navigation;
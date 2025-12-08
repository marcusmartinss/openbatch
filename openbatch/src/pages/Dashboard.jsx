import React, { useState } from 'react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import Navigation from '../components/Navigation.jsx';

import Terminal from '../components/sections/Terminal.jsx';
import SubmitJob from '../components/sections/SubmitJob.jsx';
import UploadModules from '../components/sections/UploadModules.jsx';
import Observability from '../components/sections/Observability.jsx';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('submitJob');

  return (
    <div className="dashboard-layout">
      <Header user={user} onLogout={onLogout} />
      
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      <main className="container">
        <div style={{ display: activeTab === 'terminal' ? 'block' : 'none', height: '100%' }}>
          <Terminal />
        </div>

        {activeTab === 'submitJob' && <SubmitJob />}
        {activeTab === 'uploadModules' && <UploadModules />}
        {activeTab === 'observability' && <Observability />}
      </main>
      
      <Footer />
    </div>
  );
}

export default Dashboard;
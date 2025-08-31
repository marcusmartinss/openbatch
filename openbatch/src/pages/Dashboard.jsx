import { useState } from 'react';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import TerminalComponent from '../components/sections/Terminal';
import SubmitJob from '../components/sections/SubmitJob';
import UploadModules from '../components/sections/UploadModules';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('terminal');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'terminal':
        return <TerminalComponent />;
      case 'submitJob':
        return <SubmitJob />;
      case 'uploadModules':
        return <UploadModules />;
      default:
        return <TerminalComponent />;
    }
  };

  return (
    <>
      <Header user={user} onLogout={onLogout} />
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="container">
        {renderTabContent()}
      </main>
      <Footer />
    </>
  );
}

export default Dashboard;
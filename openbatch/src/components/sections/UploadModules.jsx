import React, { useState } from 'react';

function UploadModules() {
  const [file, setFile] = useState(null);
  const [moduleName, setModuleName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!moduleName) {
        setModuleName(e.target.files[0].name.replace('.zip', ''));
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatus({ type: 'error', message: 'Por favor, selecione um arquivo ZIP.' });
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      setStatus({ type: 'error', message: 'Usuário não autenticado.' });
      return;
    }

    setIsUploading(true);
    setStatus({ type: 'info', message: 'Enviando e descompactando...' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('moduleName', moduleName);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: data.message });
        setFile(null);
        setModuleName('');
      } else {
        throw new Error(data.message || 'Erro no upload');
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: `Falha: ${error.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="content-box">
        <h2>Upload de Módulos</h2>
        <p>Envie bibliotecas ou códigos em formato <strong>.ZIP</strong>. Eles serão extraídos automaticamente na sua pasta <code>~/modulos</code>.</p>
      </div>

      <div className="content-box">
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label htmlFor="module-name">Nome do Módulo (Pasta de destino)</label>
            <input 
              type="text" 
              id="module-name" 
              placeholder="Ex: python_tools"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              disabled={isUploading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="module-file">Arquivo ZIP</label>
            <input 
              type="file" 
              id="module-file" 
              accept=".zip"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          {/* Barra de Status / Feedback */}
          {status.message && (
            <div style={{ 
              padding: '10px', 
              marginBottom: '20px', 
              borderRadius: '4px',
              backgroundColor: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 
                               status.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(56, 189, 248, 0.1)',
              color: status.type === 'error' ? '#FCA5A5' : 
                     status.type === 'success' ? '#86EFAC' : '#7DD3FC',
              border: `1px solid ${
                status.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 
                status.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(56, 189, 248, 0.3)'
              }`
            }}>
              {status.message}
            </div>
          )}

          <button 
            type="submit" 
            className="primary-btn"
            disabled={isUploading}
          >
            {isUploading ? 'Processando...' : 'Enviar e Extrair'}
          </button>
        </form>
      </div>
    </>
  );
}

export default UploadModules;
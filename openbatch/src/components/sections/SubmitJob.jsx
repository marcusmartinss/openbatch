import React, { useRef, useEffect, useState } from 'react';
import { useJobRunner, JOB_STATUS } from '../../hooks/useJobRunner';

const COMMAND_TEMPLATES = [
  {
    id: 'sbatch',
    command: 'sbatch meu_script.sh',
    description: 'Submeter um script SLURM',
  },
  {
    id: 'srun',
    command: 'srun -N 1 --ntasks-per-node=2 ./meu_programa',
    description: 'Executar interativo em múltiplos nós',
  },
  {
    id: 'sinfo',
    command: 'sinfo -o "%.8P %.5a %.10l %.6D %.6C"',
    description: 'Verificar status detalhado do cluster',
  },
  {
    id: 'squeue',
    command: 'squeue -u $USER',
    description: 'Listar seus jobs em execução',
  }
];

function SubmitJob() {
  const { logs, status, runJob, isRunning } = useJobRunner();
  const logsEndRef = useRef(null);
  
  const [commandInput, setCommandInput] = useState('sbatch meu_script.sh');

  const handleSubmit = (e) => {
    e.preventDefault();
    const jobData = {
       command: commandInput,
       nodes: document.getElementById('job-nodes').value
    };
    runJob(jobData);
  };

  const applyTemplate = (cmd) => {
    if (isRunning) return;
    setCommandInput(cmd);
  };

  return (
    <div>
      <div className="content-box">
        <h2>Comandos Rápidos</h2>
        <p>Selecione um template abaixo para preencher o comando automaticamente:</p>
        
        <div className="command-examples">
          {COMMAND_TEMPLATES.map((template) => (
            <button 
              key={template.id} 
              className="example-card interactive"
              onClick={() => applyTemplate(template.command)}
              disabled={isRunning}
              type="button"
              title="Clique para usar este comando"
            >
              <code className="example-code">{template.command}</code>
              <p className="example-desc">{template.description}</p>
            </button>
          ))}
        </div>
      </div>
      
      {/* Formulário de Configuração */}
      <div className="content-box">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="slurm-command">Comando ou Script</label>
            <input 
              type="text" 
              id="slurm-command" 
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              disabled={isRunning}
              placeholder="Digite seu comando SLURM..."
            />
          </div>
          
          <div className="job-form-grid">
            <div className="form-group">
              <label htmlFor="job-name">Nome do Job</label>
              <input type="text" id="job-name" defaultValue="Job_01" disabled={isRunning} />
            </div>
            <div className="form-group">
              <label htmlFor="job-nodes">Nós (Nodes)</label>
              <input type="number" id="job-nodes" defaultValue="2" min="1" disabled={isRunning} />
            </div>
            <div className="form-group">
              <label htmlFor="job-memory">Memória (GB)</label>
              <input type="number" id="job-memory" defaultValue="16" min="1" disabled={isRunning} />
            </div>
            
            <button 
              type="submit" 
              className="primary-btn" 
              style={{ marginBottom: '20px' }} 
              disabled={isRunning}
            >
              {isRunning ? 'Processando...' : 'Submeter Job'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Área de Logs (Output) */}
      <div className="job-output-container">
        <div className="job-output-header">
          <span className="job-output-title">Console de Saída</span>
          <span style={{ fontSize: '0.8em', color: getStatusColor(status) }}>
            Status: {status.toUpperCase()}
          </span>
        </div>
        
        <div className="job-log-area">
          {logs.length === 0 ? (
            <div className="log-placeholder">
              Aguardando submissão... Os logs aparecerão aqui.
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={log.id || index} className={`log-line ${log.type}`}>
                {log.message}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status) {
  switch(status) {
    case JOB_STATUS.RUNNING: return '#38BDF8'; 
    case JOB_STATUS.COMPLETED: return '#51cf66'; 
    case JOB_STATUS.ERROR: return '#ff6b6b'; 
    default: return '#94A3B8'; 
  }
}

export default SubmitJob;
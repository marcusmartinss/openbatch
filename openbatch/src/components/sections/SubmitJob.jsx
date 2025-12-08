import React, { useRef, useEffect, useState } from 'react';
import { useJobRunner, JOB_STATUS } from '../../hooks/useJobRunner';

import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-bash'; 
import 'prismjs/themes/prism-tomorrow.css'; 

const COMMAND_TEMPLATES = [
  {
    id: 'sbatch',
    command: 'sbatch meu_script.sh',
    description: 'Submeter um script SLURM',
  },
  {
    id: 'scancel',
    command: 'scancel --name=NOME_DO_JOB',
    description: 'Cancelar um job pelo nome',
  },
  {
    id: 'sinfo',
    command: 'sinfo -o "%.8P %.5a %.10l %.6D %.6C"',
    description: 'Verificar status do cluster',
  },
  {
    id: 'squeue',
    command: 'squeue -u $USER',
    description: 'Listar meus jobs em execução',
  }
];

const DEFAULT_SCRIPT = `#!/bin/bash

echo "Iniciando Job no host: $(hostname)"
echo "Data: $(date)"
# Seus comandos aqui...
sleep 2
echo "Finalizado."
`;

function SubmitJob() {
  const { logs, status, runJob, isRunning } = useJobRunner();
  const logsEndRef = useRef(null);
  
  const [submissionMode, setSubmissionMode] = useState('command');
  const [commandInput, setCommandInput] = useState('sbatch meu_script.sh');
  const [scriptCode, setScriptCode] = useState(DEFAULT_SCRIPT);

  // Estados do Formulário (Sincronizados com o Script)
  const [formConfig, setFormConfig] = useState({
    name: 'Job_01',
    partition: 'normal',
    nodes: 1,
    tasks: 1,
    memory: 4,
    time: '01:00:00',
    output: 'slurm-%j.out'
  });

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- LÓGICA DE SINCRONIZAÇÃO FORMULÁRIO -> SCRIPT ---
  const updateScriptDirective = (key, value) => {
    setScriptCode((prevScript) => {
      let directive = '';
      let valStr = value;

      // Mapeia o campo do form para a flag do SLURM
      switch (key) {
        case 'name': directive = '--job-name'; break;
        case 'partition': directive = '--partition'; break;
        case 'nodes': directive = '--nodes'; break;
        case 'tasks': directive = '--ntasks-per-node'; break;
        case 'memory': directive = '--mem'; valStr = `${value}G`; break; // Adiciona G para memória
        case 'time': directive = '--time'; break;
        case 'output': directive = '--output'; break;
        default: return prevScript;
      }

      // Regex para encontrar a linha existente (multiline)
      const regex = new RegExp(`^#SBATCH\\s+${directive}=.*$`, 'm');
      const newLine = `#SBATCH ${directive}=${valStr}`;

      if (regex.test(prevScript)) {
        // Se existir, substitui o valor
        return prevScript.replace(regex, newLine);
      } else {
        // Se não existir, insere após o shebang (#!/bin/bash) ou no topo
        if (prevScript.includes('#!/bin/bash')) {
          return prevScript.replace('#!/bin/bash', `#!/bin/bash\n${newLine}`);
        } else {
          return `${newLine}\n${prevScript}`;
        }
      }
    });
  };

  const handleConfigChange = (e) => {
    const { id, value } = e.target;
    // Remove o prefixo 'job-' para achar a chave correta no estado
    const key = id.replace('job-', '');
    
    setFormConfig(prev => ({ ...prev, [key]: value }));
    updateScriptDirective(key, value);
  };
  // ----------------------------------------------------

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const jobData = {
       type: submissionMode,
       payload: submissionMode === 'command' ? commandInput : scriptCode,
       config: {
         name: formConfig.name,
         partition: formConfig.partition,
         nodes: formConfig.nodes,
         tasks: formConfig.tasks,
         memory: formConfig.memory,
         time: formConfig.time,
         output: formConfig.output,
       }
    };
    
    runJob(jobData);
  };

  const applyTemplate = (cmd) => {
    if (isRunning) return;
    setSubmissionMode('command');
    setCommandInput(cmd);
  };

  return (
    <>
      <div className="content-box">
        <h2>Submissão de Jobs</h2>
        <div className="command-examples">
          {COMMAND_TEMPLATES.map((template) => (
            <button 
              key={template.id} 
              className="example-card interactive"
              onClick={() => applyTemplate(template.command)}
              disabled={isRunning}
              type="button"
            >
              <code className="example-code">{template.command}</code>
              <p className="example-desc">{template.description}</p>
            </button>
          ))}
        </div>
      </div>
      
      <div className="content-box">
        <div className="submission-tabs">
          <button 
            className={`sub-tab ${submissionMode === 'command' ? 'active' : ''}`}
            onClick={() => setSubmissionMode('command')}
            type="button"
          >
            Linha de Comando
          </button>
          <button 
            className={`sub-tab ${submissionMode === 'script' ? 'active' : ''}`}
            onClick={() => setSubmissionMode('script')}
            type="button"
          >
            Editor de Script
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          {submissionMode === 'command' ? (
            <div className="form-group fade-in">
              <label htmlFor="slurm-command">Comando do Terminal</label>
              <input 
                type="text" 
                id="slurm-command" 
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                disabled={isRunning}
              />
            </div>
          ) : (
            <div className="form-group fade-in">
              <label htmlFor="script-editor">Script Bash</label>
              <div className="code-editor-wrapper">
                <Editor
                  value={scriptCode}
                  onValueChange={code => setScriptCode(code)}
                  highlight={code => highlight(code, languages.bash, 'bash')}
                  padding={15}
                  disabled={isRunning}
                  textareaId="script-editor"
                  style={{
                    fontFamily: '"Fira Code", monospace',
                    fontSize: 14,
                    backgroundColor: '#0d1117',
                    minHeight: '200px',
                  }}
                  className="prism-editor"
                />
              </div>
              <p style={{ fontSize: '0.8em', color: '#94A3B8', marginTop: '5px' }}>
                * As alterações no formulário abaixo atualizam automaticamente o script.
              </p>
            </div>
          )}
          
          {/* Formulário Sincronizado */}
          <div className="job-form-grid">
            <div className="form-group">
              <label>Nome do Job</label>
              <input type="text" id="job-name" value={formConfig.name} onChange={handleConfigChange} disabled={isRunning} />
            </div>
            <div className="form-group">
              <label>Partição</label>
              <input type="text" id="job-partition" value={formConfig.partition} onChange={handleConfigChange} disabled={isRunning} />
            </div>
            <div className="form-group">
              <label>Nós</label>
              <input type="number" id="job-nodes" value={formConfig.nodes} onChange={handleConfigChange} disabled={isRunning} />
            </div>
            <div className="form-group">
              <label>Tarefas por Nó</label>
              <input type="number" id="job-tasks" value={formConfig.tasks} onChange={handleConfigChange} disabled={isRunning} />
            </div>
            <div className="form-group">
              <label>Memória (GB)</label>
              <input type="number" id="job-memory" value={formConfig.memory} onChange={handleConfigChange} disabled={isRunning} />
            </div>
            <div className="form-group">
              <label>Tempo (HH:MM:SS)</label>
              <input type="text" id="job-time" value={formConfig.time} onChange={handleConfigChange} disabled={isRunning} />
            </div>
            <div className="form-group">
              <label>Saída</label>
              <input type="text" id="job-output" value={formConfig.output} onChange={handleConfigChange} disabled={isRunning} />
            </div>
            
            <div className="form-group full-width" style={{marginBottom: 0}}>
              <button type="submit" className="primary-btn" style={{ width: '100%' }} disabled={isRunning}>
                {isRunning ? 'Executando...' : (submissionMode === 'command' ? 'Executar Comando' : 'Submeter Script')}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      <div className="job-output-container">
        <div className="job-output-header">
          <span className="job-output-title">Console de Saída</span>
          <span style={{ fontSize: '0.8em', color: getStatusColor(status) }}>Status: {status}</span>
        </div>
        <div className="job-log-area">
          {logs.length === 0 ? (
            <div className="log-placeholder">Os logs aparecerão aqui...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`log-line ${log.type}`}>{log.message}</div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </>
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
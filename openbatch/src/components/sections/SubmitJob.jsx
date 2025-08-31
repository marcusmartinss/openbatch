import React, { useState } from 'react';

const commandTemplates = [
  {
    id: 'sbatch',
    command: 'sbatch meu_script.sh',
    description: 'Submeter um script SLURM',
  },
  {
    id: 'srun',
    command: 'srun -N 1 --ntasks-per-node=2 ./meu_programa',
    description: 'Executar um programa em múltiplos nós',
  },
  {
    id: 'sinfo',
    command: 'sinfo -o "%.8P %.5a %.10l %.6D %.6C"',
    description: 'Verificar status do cluster',
  },
  {
    id: 'squeue',
    command: 'squeue -u $USER',
    description: 'Listar seus jobs em execução',
  }
];

function SubmitJob() {
  const [slurmCommand, setSlurmCommand] = useState('');
  const [slurmScript, setSlurmScript] = useState(``);

  const handleTemplateClick = (template) => {
    setSlurmCommand(template.command);
    setSlurmScript(template.script);
  };

  return (
    <>
      <div className="content-box">
        <h2>Submissão de Jobs SLURM</h2>
        <p>Preencha o formulário abaixo ou clique em um dos templates para preencher automaticamente.</p>
        
        <div className="info-grid">
          {commandTemplates.map((template) => (
            <div
              key={template.id}
              className="command-box"
              onClick={() => handleTemplateClick(template)}
            >
              <code>{template.command}</code>
              <p>{template.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="content-box">
        <div className="form-group">
          <label htmlFor="slurm-command">Comando SLURM</label>
          <input
            type="text"
            id="slurm-command"
            value={slurmCommand}
            onChange={(e) => setSlurmCommand(e.target.value)}
            placeholder="Clique em um template acima..."
          />
        </div>
        <label htmlFor="slurm-command">Ou escreva seu script SLURM</label>
        <div className="form-group">
          <textarea
            id="slurm-script"
            rows="12"
            value={slurmScript}
            onChange={(e) => setSlurmScript(e.target.value)}
            placeholder={`#!/bin/bash\n#SBATCH --job-name=meu_job\n#SBATCH --output=resultado.txt\n\n# Escreva seu script aqui...`}
          ></textarea>
        </div>

        <div className="job-form-grid">
          <div className="form-group"><label htmlFor="job-name">Nome do Job</label><input type="text" id="job-name" defaultValue="Meu Job" /></div>
          <div className="form-group"><label htmlFor="partition">Partição</label><select id="partition"><option>normal</option></select></div>
          <div className="form-group"><label htmlFor="nodes">Nós</label><input type="number" id="nodes" defaultValue="1" /></div>
          <div className="form-group"><label htmlFor="cpus">CPUs por nó</label><input type="number" id="cpus" defaultValue="1" /></div>
          <div className="form-group"><label htmlFor="memory">Memória (GB)</label><input type="number" id="memory" defaultValue="4" /></div>
          <div className="form-group"><label htmlFor="time">Tempo (HH:MM:SS)</label><input type="text" id="time" defaultValue="01:00:00" /></div>
          <button type="button" className="primary-btn full-width">Submeter Job</button>
        </div>
      </div>
      
       <div className="content-box">
          <strong>Saída do Job</strong>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary-color)', marginTop: '10px' }}>
            Nenhuma saída ainda. O resultado do job aparecerá aqui...
          </p>
      </div>
    </>
  );
}

export default SubmitJob;
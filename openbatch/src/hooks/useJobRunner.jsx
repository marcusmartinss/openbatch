import { useState, useRef, useEffect, useCallback } from 'react';

// Estados possíveis para a máquina de estados do Job
export const JOB_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
};

export function useJobRunner() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(JOB_STATUS.IDLE);
  const wsRef = useRef(null);

  // Função para adicionar logs com timestamp (opcional)
  const addLog = useCallback((message, type = 'normal') => {
    setLogs((prev) => [...prev, { message, type, id: Date.now() + Math.random() }]);
  }, []);

  const runJob = useCallback((jobConfig) => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      addLog("Erro: Token de autenticação não encontrado.", 'error');
      setStatus(JOB_STATUS.ERROR);
      return;
    }

    // Limpa logs anteriores e define estado
    setLogs([]);
    setStatus(JOB_STATUS.CONNECTING);
    addLog("Iniciando conexão segura com o cluster...", 'info');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:8080/?token=${token}&type=job`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus(JOB_STATUS.RUNNING);
        addLog("Conexão estabelecida. Enviando payload do job...", 'success');
      };

      ws.onmessage = (event) => {
        addLog(event.data);
      };

      ws.onclose = (event) => {
        if (event.code === 1000 || event.code === 1005) {
            addLog("--- Processo finalizado ---", 'info');
            setStatus(JOB_STATUS.COMPLETED);
        } else {
            addLog(`Conexão encerrada (Código: ${event.code})`, 'error');
            setStatus(JOB_STATUS.ERROR);
        }
      };

      ws.onerror = () => {
        addLog("Erro fatal na conexão WebSocket.", 'error');
        setStatus(JOB_STATUS.ERROR);
      };

    } catch (error) {
      addLog(`Erro ao tentar conectar: ${error.message}`, 'error');
      setStatus(JOB_STATUS.ERROR);
    }
  }, [addLog]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    logs,
    status,
    runJob,
    isRunning: status === JOB_STATUS.RUNNING || status === JOB_STATUS.CONNECTING
  };
}

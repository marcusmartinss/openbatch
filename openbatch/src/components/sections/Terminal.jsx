import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import '@xterm/xterm/css/xterm.css';

function TerminalComponent() {
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      // Pega o token de autenticação salvo no localStorage.
      const token = localStorage.getItem('authToken');

      // Verifica se o token existe antes de tentar conectar.
      if (!token) {
        console.error("Token de autenticação não encontrado. Conexão WebSocket não iniciada.");
        return;
      }

      // Passa o token como um parâmetro na URL do WebSocket.
      const socket = new WebSocket(`ws://localhost:8080?token=${token}`);

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 15,
        theme: {
          background: '#0d1117',
        },
      });

      const fitAddon = new FitAddon();
      const attachAddon = new AttachAddon(socket);

      term.loadAddon(fitAddon);
      term.loadAddon(attachAddon);

      term.open(terminalRef.current);
      fitAddon.fit();

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
      });
      resizeObserver.observe(terminalRef.current);

      term.focus();

      return () => {
        resizeObserver.disconnect();
        socket.close();
        term.dispose();
      };
    }
  }, []);

  return <div id="terminal-container" ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
}

export default TerminalComponent;
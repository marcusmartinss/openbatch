import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { pamAuthenticate } from 'node-linux-pam';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = 'sua-chave-secreta-super-longa-e-aleatoria-aqui';
const port = 8080;
const BLOCKED_USERS = ['root', 'daemon', 'bin', 'sys', 'sync', 'games', 'man', 'lp', 'mail', 'news', 'uucp', 'proxy', 'www-data', 'backup', 'list', 'irc', 'gnats', 'nobody'];

const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

const server = http.createServer(app);

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
  }

  if (BLOCKED_USERS.includes(username.toLowerCase())) {
    return res.status(403).json({ message: 'Login para este usuário não é permitido.' });
  }

  try {
    pamAuthenticate({ username, password }, (err) => {
      if (err) {
        console.error(`Falha na autenticação PAM para ${username}:`, err);
        return res.status(401).json({ message: 'Credenciais inválidas ou erro no PAM (o servidor está rodando como sudo?).' });
      }
      
      console.log(`Usuário ${username} autenticado com sucesso via PAM.`);
      
      const payload = { username: username };
      const options = { expiresIn: '1h' };
      const token = jwt.sign(payload, JWT_SECRET, options);
      
      console.log(`Token JWT gerado para ${username}.`);
      res.status(200).json({ message: 'Autenticação bem-sucedida.', token: token });
    });
  } catch (e) {
    console.error("Erro crítico ao chamar PAM:", e);
    res.status(500).json({ message: "Erro interno no servidor de autenticação." });
  }
});

app.get('/api/metrics', (req, res) => {
  const mockMetrics = {
    nodes: { idle: 120, allocated: 75, down: 5 },
    cpus: { allocated: 3000, total: 4800 },
    memory: { allocated: 12000, total: 24000 },
    jobs: { pending: 150, running: 320 },
  };

  res.json(mockMetrics);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) { return ws.close(1008, 'Token não fornecido.'); }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) { return ws.close(1008, 'Token inválido ou expirado.'); }
    
    const username = decoded.username;
    console.log(`Cliente (${username}) conectado. Iniciando shell...`);

    try {
      let shell = 'bash';
      let args = [];

      if (username === 'admin') {
         shell = 'bash';
      } else {
         shell = 'su';
         args = ['-', username];
      }

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME, 
        env: process.env,
      });
      
      ptyProcess.onData(data => { 
        if (ws.readyState === ws.OPEN) {
          ws.send(data); 
        }
      });

      ws.on('message', data => { ptyProcess.write(data.toString()); });
      
      ws.on('close', () => {
        console.log(`Cliente (${username}) desconectado.`);
        try { ptyProcess.kill(); } catch(e) {}
      });

    } catch (error) {
      console.error(`Falha ao iniciar o shell:`, error.message);
      ws.send(`\r\n\x1b[31mErro ao iniciar terminal: ${error.message}\x1b[0m`);
    }
  });
});

server.listen(port, () => {
  console.log(`Servidor backend rodando em http://localhost:${port}`);
});
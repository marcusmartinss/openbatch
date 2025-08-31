import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { pamAuthenticate } from 'node-linux-pam';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = 'sua-chave-secreta-super-longa-e-aleatoria-aqui';
const port = 8080;
const BLOCKED_USERS = ['root', 'daemon', 'bin', 'sys', 'sync', 'games', 'man', 'lp', 'mail', 'news', 'uucp', 'proxy', 'www-data', 'backup', 'list', 'irc', 'gnats', 'nobody'];

const app = express();
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

  pamAuthenticate({ username, password }, (err) => {
    if (err) {
      console.error(`Falha na autenticação para ${username}:`, err);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    
    console.log(`Usuário ${username} autenticado com sucesso via PAM.`);
    
    const payload = { username: username };
    const options = { expiresIn: '1h' };
    const token = jwt.sign(payload, JWT_SECRET, options);
    
    console.log(`Token JWT gerado para ${username}.`);
    res.status(200).json({ message: 'Autenticação bem-sucedida.', token: token });
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) { return ws.close(1008, 'Token não fornecido.'); }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) { return ws.close(1008, 'Token inválido ou expirado.'); }
    
    const username = decoded.username;
    console.log(`Cliente com token válido (${username}) conectado. Iniciando shell com 'su'...`);

    try {
      const ptyProcess = pty.spawn('su', ['-', username], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME, // O 'su' irá alterar para o diretório correto do usuário
        env: process.env,
      });
      
      ptyProcess.onData(data => { ws.send(data); });
      ws.on('message', data => { ptyProcess.write(data.toString()); });
      ws.on('close', () => {
        console.log(`Cliente (${username}) desconectado.`);
        ptyProcess.kill();
      });

    } catch (error) {
      console.error(`Falha ao iniciar o shell para o usuário ${username}:`, error.message);
      ws.send(`\r\n\x1b[31mErro: Não foi possível iniciar o terminal para o usuário ${username}.\x1b[0m`);
      ws.close(1011, 'Falha ao iniciar PTY');
    }
  });
});

server.listen(port, () => {
  console.log(`Servidor HTTP e WebSocket rodando em http://localhost:${port}`);
});
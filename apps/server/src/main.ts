import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createAdminRouter } from './admin/AdminController';
import { AuthService } from './auth/AuthService';
import { DatabaseService } from './db/schema';
import { GameGateway } from './gateway/GameGateway';
import { MatchmakingService } from './matchmaking/MatchmakingService';
import { TableManager } from './table/TableManager';

dotenv.config();

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Services
const db = DatabaseService.getInstance();
const authService = new AuthService();
const matchmakingService = new MatchmakingService();
const tableManager = new TableManager();

// Create HTTP and Socket.IO Server
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Initialize WebSocket Gateway
const gateway = new GameGateway(io, authService, matchmakingService, tableManager);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'Indian Rummy Game Server',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Authentication endpoints
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    const result = authService.register(username, email, password);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    const result = authService.login(identifier, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/profile/:userId', (req: Request, res: Response) => {
  try {
    const result = authService.getProfile(req.params.userId);
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Game history endpoint
app.get('/api/games/history/:userId', (req: Request, res: Response) => {
  try {
    const history = db.getGameHistoryForUser(req.params.userId);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoints
app.use('/api/admin', createAdminRouter(tableManager));

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🏆 Authoritative Indian Rummy Server Running on :${PORT}`);
    console.log(`🎲 WebSocket Gateway ready for Points and Pool Rummy`);
    console.log(`=======================================================`);
  });
}

export { app, server, tableManager, matchmakingService, authService };

import { Request, Response, Router } from 'express';
import { DatabaseService } from '../db/schema';
import { TableManager } from '../table/TableManager';

export function createAdminRouter(tableManager: TableManager): Router {
  const router = Router();
  const db = DatabaseService.getInstance();

  // Overview metrics
  router.get('/overview', (req: Request, res: Response) => {
    const activeTables = tableManager.getActiveTablesList();
    const completedResults = Array.from(db.results.values());

    const pointsGamesCount = completedResults.filter((r) => r.variant === 'POINTS').length;
    const poolGamesCount = completedResults.filter((r) => r.variant.startsWith('POOL')).length;

    res.json({
      totalUsers: db.users.size,
      activeTablesCount: activeTables.length,
      completedGamesCount: completedResults.length,
      pointsGamesCount,
      poolGamesCount,
      serverStatus: 'HEALTHY',
      uptimeSec: Math.floor(process.uptime()),
    });
  });

  // Active game tables
  router.get('/tables', (req: Request, res: Response) => {
    res.json(tableManager.getActiveTablesList());
  });

  // User management
  router.get('/players', (req: Request, res: Response) => {
    const playerList = Array.from(db.users.values()).map((u) => {
      const prof = db.profiles.get(u.id);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        status: u.status,
        role: u.role,
        gamesPlayed: prof?.gamesPlayed || 0,
        gamesWon: prof?.gamesWon || 0,
        createdAt: u.createdAt,
      };
    });
    res.json(playerList);
  });

  // Suspend player
  router.post('/players/:id/suspend', (req: Request, res: Response) => {
    const user = db.users.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Player not found' });
    user.status = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    db.logAdminAction('admin-1', 'TOGGLE_SUSPEND', user.id, { newStatus: user.status });
    res.json({ success: true, status: user.status });
  });

  // Audit logs
  router.get('/audit-logs', (req: Request, res: Response) => {
    res.json(db.auditLogs);
  });

  return router;
}

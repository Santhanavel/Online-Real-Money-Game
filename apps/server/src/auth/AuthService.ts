import jwt from 'jsonwebtoken';
import { DatabaseService, DbUser, DbUserProfile } from '../db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'rummy-master-secret-key-production-grade';

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: string;
}

export class AuthService {
  private db = DatabaseService.getInstance();

  public register(
    username: string,
    email: string,
    passwordPlain: string
  ): { user: DbUser; profile: DbUserProfile; token: string } {
    if (!username || username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Valid email address is required');
    }
    if (!passwordPlain || passwordPlain.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const existing = this.db.findUserByUsernameOrEmail(username) || this.db.findUserByUsernameOrEmail(email);
    if (existing) {
      throw new Error('Username or email is already registered');
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const user: DbUser = {
      id: userId,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: `hash-${passwordPlain}`, // secure password hashing in production
      role: 'USER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    const profile: DbUserProfile = {
      userId,
      displayName: username.trim(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username.trim()}`,
      gamesPlayed: 0,
      gamesWon: 0,
      totalPointsWon: 0,
      updatedAt: new Date().toISOString(),
    };

    this.db.users.set(userId, user);
    this.db.profiles.set(userId, profile);

    const token = this.generateToken(user);
    return { user, profile, token };
  }

  public login(
    identifier: string,
    passwordPlain: string
  ): { user: DbUser; profile: DbUserProfile; token: string } {
    const user = this.db.findUserByUsernameOrEmail(identifier);
    if (!user) {
      throw new Error('Invalid username/email or password');
    }

    if (user.status === 'SUSPENDED') {
      throw new Error('Account has been suspended. Please contact support.');
    }

    const profile = this.db.profiles.get(user.id)!;
    const token = this.generateToken(user);

    return { user, profile, token };
  }

  public generateToken(user: DbUser): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  public verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch {
      throw new Error('Invalid or expired authentication token');
    }
  }

  public getProfile(userId: string): { user: DbUser; profile: DbUserProfile } {
    const user = this.db.findUserById(userId);
    if (!user) throw new Error('User not found');
    const profile = this.db.profiles.get(userId) || {
      userId,
      displayName: user.username,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`,
      gamesPlayed: 0,
      gamesWon: 0,
      totalPointsWon: 0,
      updatedAt: new Date().toISOString(),
    };
    return { user, profile };
  }
}

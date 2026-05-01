import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

// Supabase JWT payload shape (HS256, role='authenticated')
export interface SupabaseJwtPayload {
  sub: string;       // Supabase user UUID
  email: string;
  role: string;      // 'authenticated' | 'anon'
  aud: string;
  exp: number;
  iat: number;
  user_metadata?: { full_name?: string; avatar_url?: string; name?: string };
}

export interface AuthUser {
  id: string;        // local DB UUID
  supabaseId: string;
  email: string;
  plan: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Supabase signs with the project JWT secret (HS256)
      secretOrKey:
        config.get<string>('SUPABASE_JWT_SECRET') ||
        config.get<string>('app.jwt.secret'),
    });
  }

  async validate(payload: SupabaseJwtPayload): Promise<AuthUser> {
    if (payload.role !== 'authenticated') throw new UnauthorizedException();

    // Sync strategy: look up by supabaseId, fall back to email for migrated records
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ supabaseId: payload.sub }, { email: payload.email }] },
      select: { id: true, supabaseId: true, email: true, plan: true, status: true },
    });

    if (!user) {
      // First login — provision local profile from Supabase token data
      const meta = payload.user_metadata ?? {};
      user = await this.prisma.user.create({
        data: {
          supabaseId: payload.sub,
          email: payload.email,
          fullName: meta.full_name ?? meta.name ?? null,
          avatarUrl: meta.avatar_url ?? null,
          emailVerified: true,
          status: 'ACTIVE',
          lastLoginAt: new Date(),
        },
        select: { id: true, supabaseId: true, email: true, plan: true, status: true },
      });
    } else if (!user.supabaseId) {
      // Existing password-auth user — link to Supabase account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { supabaseId: payload.sub, emailVerified: true, lastLoginAt: new Date() },
        select: { id: true, supabaseId: true, email: true, plan: true, status: true },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account suspended');

    return { id: user.id, supabaseId: user.supabaseId!, email: user.email, plan: user.plan };
  }
}

import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';

export interface SupabaseJwtPayload {
  sub: string;
  email: string;
  role: string;
  aud: string;
  exp: number;
  iat: number;
  user_metadata?: { full_name?: string; avatar_url?: string; name?: string };
}

export interface AuthUser {
  id: string;
  supabaseId: string;
  email: string;
  plan: string;
  onboardingComplete: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly email: EmailService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('SUPABASE_JWT_SECRET') ||
        config.get<string>('app.jwt.secret'),
    });
  }

  async validate(payload: SupabaseJwtPayload): Promise<AuthUser> {
    if (payload.role !== 'authenticated') throw new UnauthorizedException();

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ supabaseId: payload.sub }, { email: payload.email }] },
      select: { id: true, supabaseId: true, email: true, plan: true, status: true, fullName: true, welcomeEmailSent: true, onboardingComplete: true },
    });

    if (!user) {
      const meta = payload.user_metadata ?? {};
      const name = meta.full_name ?? meta.name ?? null;
      user = await this.prisma.user.create({
        data: {
          supabaseId: payload.sub,
          email: payload.email,
          fullName: name,
          avatarUrl: meta.avatar_url ?? null,
          emailVerified: true,
          status: 'ACTIVE',
          welcomeEmailSent: false,
          lastLoginAt: new Date(),
        },
        select: { id: true, supabaseId: true, email: true, plan: true, status: true, fullName: true, welcomeEmailSent: true, onboardingComplete: true },
      });

      // Fire welcome email asynchronously — don't block the request
      if (this.email && !user.welcomeEmailSent) {
        this.email.sendWelcome(user.email, user.fullName ?? 'there').then(() =>
          this.prisma.user.update({ where: { id: user!.id }, data: { welcomeEmailSent: true } }),
        ).catch(() => { /* non-fatal */ });
      }
    } else if (!user.supabaseId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { supabaseId: payload.sub, emailVerified: true, lastLoginAt: new Date() },
        select: { id: true, supabaseId: true, email: true, plan: true, status: true, fullName: true, welcomeEmailSent: true, onboardingComplete: true },
      });
    } else {
      await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    }

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account suspended');

    return {
      id: user.id,
      supabaseId: user.supabaseId!,
      email: user.email,
      plan: user.plan,
      onboardingComplete: user.onboardingComplete,
    };
  }
}

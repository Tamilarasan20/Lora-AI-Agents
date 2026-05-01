import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, SupabaseJwtPayload } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validate(_req: any, payload: SupabaseJwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, supabaseId: true, email: true, plan: true, status: true, onboardingComplete: true },
    });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
    return {
      id: user.id,
      supabaseId: user.supabaseId ?? user.id,
      email: user.email,
      plan: user.plan,
      onboardingComplete: user.onboardingComplete,
    };
  }
}

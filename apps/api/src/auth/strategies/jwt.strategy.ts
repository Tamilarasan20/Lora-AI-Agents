import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { createPublicKey } from 'crypto';
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

interface JwtHeader {
  alg?: string;
  kid?: string;
}

type SecretOrKeyProviderDone = (err: Error | null, secret?: string) => void;
type Jwk = {
  kid?: string;
  kty?: string;
  use?: string;
  key_ops?: string[];
  alg?: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  ext?: boolean;
  [key: string]: unknown;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private jwksCache = new Map<string, string>();
  private lastJwksFetchAt = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly email: EmailService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: async (
        _req: unknown,
        rawJwtToken: string,
        done: SecretOrKeyProviderDone,
      ) => {
        try {
          const key = await this.resolveVerificationKey(rawJwtToken);
          done(null, key);
        } catch (error) {
          done(error as Error);
        }
      },
    });
  }

  private async resolveVerificationKey(rawJwtToken: string): Promise<string> {
    const symmetricSecret =
      this.config.get<string>('SUPABASE_JWT_SECRET') ||
      this.config.get<string>('app.supabase.jwtSecret');

    if (symmetricSecret) {
      return symmetricSecret;
    }

    const { kid } = this.parseJwtHeader(rawJwtToken);
    if (!kid) {
      throw new UnauthorizedException('Missing JWT key id');
    }

    const cached = this.jwksCache.get(kid);
    if (cached) {
      return cached;
    }

    await this.refreshJwks();

    const resolved = this.jwksCache.get(kid);
    if (!resolved) {
      throw new UnauthorizedException(`Unknown JWT key id: ${kid}`);
    }

    return resolved;
  }

  private parseJwtHeader(rawJwtToken: string): JwtHeader {
    const [encodedHeader] = rawJwtToken.split('.');
    if (!encodedHeader) {
      throw new UnauthorizedException('Malformed JWT');
    }

    try {
      return JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as JwtHeader;
    } catch {
      throw new UnauthorizedException('Invalid JWT header');
    }
  }

  private getJwksUrl(): string {
    const explicit = this.config.get<string>('app.supabase.jwksUrl') || process.env.SUPABASE_JWKS_URL;
    if (explicit) {
      return explicit;
    }

    const supabaseUrl = this.config.get<string>('app.supabase.url') || process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new UnauthorizedException('Supabase URL is not configured');
    }

    return `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
  }

  private async refreshJwks(): Promise<void> {
    const now = Date.now();
    if (this.jwksCache.size > 0 && now - this.lastJwksFetchAt < 5 * 60 * 1000) {
      return;
    }

    const response = await fetch(this.getJwksUrl());
    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch Supabase JWKS');
    }

    const payload = (await response.json()) as { keys?: Jwk[] };
    const nextCache = new Map<string, string>();

    for (const jwk of payload.keys ?? []) {
      if (!jwk.kid) continue;
      const pem = createPublicKey({ key: jwk, format: 'jwk' }).export({
        format: 'pem',
        type: 'spki',
      });
      nextCache.set(jwk.kid, pem.toString());
    }

    if (nextCache.size === 0) {
      throw new UnauthorizedException('Supabase JWKS did not contain any usable keys');
    }

    this.jwksCache = nextCache;
    this.lastJwksFetchAt = now;
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

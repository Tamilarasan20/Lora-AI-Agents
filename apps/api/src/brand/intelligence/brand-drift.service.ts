import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmRouterService } from '../../llm-router/llm-router.service';

export interface ChannelSample {
  channel: 'website' | 'instagram' | 'linkedin' | 'twitter' | 'tiktok' | 'email' | 'ads';
  content: string;
  url?: string;
}

@Injectable()
export class BrandDriftService {
  private readonly logger = new Logger(BrandDriftService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmRouterService,
  ) {}

  async getLatestReport(userId: string) {
    return this.prisma.brandDriftReport.findFirst({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async getAllReports(userId: string, limit = 10) {
    return this.prisma.brandDriftReport.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });
  }

  async analyze(userId: string, channels: ChannelSample[]) {
    const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });
    if (!brand) return null;

    const brandBaseline = {
      tone: brand.tone,
      voice: (brand.voiceCharacteristics as string[]).join(', '),
      valueProposition: brand.valueProposition,
      prohibitedWords: (brand.prohibitedWords as string[]),
    };

    let result: any = this.fallbackAnalysis(channels, brandBaseline);

    if (this.llm && channels.length > 0) {
      const channelSummary = channels
        .map((c) => `### ${c.channel.toUpperCase()}\n${c.content.slice(0, 800)}`)
        .join('\n\n');

      try {
        const response = await this.llm.route({
          systemPrompt: 'You are a brand consistency analyst. Detect drift and inconsistencies across channels. Respond with JSON only.',
          messages: [{
            role: 'user',
            content: `Analyze brand consistency across these channels.

Brand baseline:
- Tone: ${brandBaseline.tone}
- Voice characteristics: ${brandBaseline.voice}
- Value proposition: ${brandBaseline.valueProposition}
- Prohibited words: ${brandBaseline.prohibitedWords.join(', ')}

Channel content:
${channelSummary}

Return ONLY valid JSON:
{
  "consistencyScore": 0-100,
  "detectedConflicts": [
    { "channel": "name", "issue": "what's inconsistent", "severity": "high|medium|low" }
  ],
  "toneMismatches": [
    { "channel": "name", "expectedTone": "...", "detectedTone": "...", "example": "..." }
  ],
  "strengths": ["2-4 what's consistent and working well"],
  "recommendations": [
    { "priority": "high|medium", "action": "specific fix", "channel": "which channel" }
  ],
  "prohibitedWordsFound": ["any prohibited words detected"],
  "overallAssessment": "one sentence summary"
}`,
          }],
          routing: { forceModel: 'gemini-flash-2' },
        });

        const match = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.content.match(/(\{[\s\S]*\})/);
        result = JSON.parse(match?.[1] ?? response.content);
      } catch (err) {
        this.logger.warn(`Drift analysis LLM failed: ${err}`);
      }
    }

    const report = await this.prisma.brandDriftReport.create({
      data: {
        userId,
        consistencyScore: result.consistencyScore ?? 75,
        detectedConflicts: result.detectedConflicts ?? [],
        toneMismatches: result.toneMismatches ?? [],
        channelsAnalyzed: channels.map((c) => c.channel),
        strengths: result.strengths ?? [],
        recommendations: result.recommendations ?? [],
      },
    });

    this.logger.log(`Brand drift report generated for user=${userId}: score=${report.consistencyScore}`);
    return report;
  }

  async quickDriftFromPublishedPosts(userId: string) {
    const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });
    if (!brand) return null;

    // Get last 20 published posts per platform as channel samples
    const posts = await this.prisma.publishedPost.findMany({
      where: { userId },
      orderBy: { publishedAt: 'desc' },
      take: 40,
    });

    if (posts.length === 0) return null;

    // Group by platform
    const byPlatform = new Map<string, string[]>();
    posts.forEach((p) => {
      if (!byPlatform.has(p.platform)) byPlatform.set(p.platform, []);
      if (p.caption) byPlatform.get(p.platform)!.push(p.caption);
    });

    const channels: ChannelSample[] = Array.from(byPlatform.entries()).map(([platform, captions]) => ({
      channel: platform as ChannelSample['channel'],
      content: captions.slice(0, 5).join('\n\n'),
    }));

    return this.analyze(userId, channels);
  }

  private fallbackAnalysis(channels: ChannelSample[], baseline: any) {
    const prohibitedFound = channels.flatMap((c) =>
      (baseline.prohibitedWords ?? []).filter((w: string) => c.content.toLowerCase().includes(w.toLowerCase())),
    );

    return {
      consistencyScore: prohibitedFound.length > 0 ? 60 : 80,
      detectedConflicts: prohibitedFound.map((w: string) => ({
        channel: 'unknown',
        issue: `Prohibited word "${w}" detected`,
        severity: 'medium',
      })),
      toneMismatches: [],
      strengths: ['Brand voice guidelines exist'],
      recommendations: [{ priority: 'medium', action: 'Review all channel content for tone consistency', channel: 'all' }],
    };
  }
}

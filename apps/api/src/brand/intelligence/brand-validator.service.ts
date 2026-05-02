import { Injectable, Logger, Optional } from '@nestjs/common';
import { LlmRouterService } from '../../llm-router/llm-router.service';

export interface ValidationIssue {
  issue: string;
  confidence: number;
  field?: string;
  recommendation: string;
}

export interface Contradiction {
  fields: string[];
  description: string;
  severity: 'high' | 'medium' | 'low';
  resolution: string;
}

export interface MissingInsight {
  area: string;
  opportunity: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ConfidenceScore {
  value: string | object | string[];
  confidence: number;
  sources: string[];
  improved?: boolean;
  notes?: string;
}

export interface GeminiValidationReport {
  validatedProfile: Record<string, ConfidenceScore>;
  contradictions: Contradiction[];
  missingInsights: MissingInsight[];
  validationWarnings: ValidationIssue[];
  audiencePsychology: {
    emotionalTriggers: string[];
    fears: string[];
    aspirations: string[];
    identityDrivers: string[];
    buyingMotivations: string[];
    psychographics: string;
  };
  contentStrategyImprovements: {
    improvedPillars: string[];
    hooks: string[];
    platformPriority: Record<string, string>;
    messagingHierarchy: string[];
  };
  marketIntelligence: {
    industryTrends: string[];
    categoryRisks: string[];
    opportunities: string[];
    competitivePositioning: string;
    marketSophistication: number;
  };
  overallScore: number;
  strategicSummary: string;
}

const EMPTY_REPORT: GeminiValidationReport = {
  validatedProfile: {},
  contradictions: [],
  missingInsights: [],
  validationWarnings: [],
  audiencePsychology: {
    emotionalTriggers: [], fears: [], aspirations: [],
    identityDrivers: [], buyingMotivations: [], psychographics: '',
  },
  contentStrategyImprovements: {
    improvedPillars: [], hooks: [], platformPriority: {}, messagingHierarchy: [],
  },
  marketIntelligence: {
    industryTrends: [], categoryRisks: [], opportunities: [],
    competitivePositioning: '', marketSophistication: 3,
  },
  overallScore: 0.7,
  strategicSummary: '',
};

@Injectable()
export class BrandValidatorService {
  private readonly logger = new Logger(BrandValidatorService.name);

  constructor(@Optional() private readonly llm: LlmRouterService) {}

  // ── Stage 3: Gemini Cross-Validation ──────────────────────────────────────

  async validate(
    rawProfile: Record<string, any>,
    scrapedPages: string[],
    websiteUrl: string,
  ): Promise<GeminiValidationReport> {
    if (!this.llm) {
      this.logger.warn('LLM not available — skipping Gemini validation');
      return { ...EMPTY_REPORT, strategicSummary: 'Validation skipped — no LLM available' };
    }

    const profileJson = JSON.stringify(rawProfile, null, 2).slice(0, 8000);
    const pagesContext = scrapedPages.map((p, i) => `Page ${i + 1}: ${p.slice(0, 500)}`).join('\n\n');

    try {
      const response = await this.llm.route({
        systemPrompt: `You are a senior brand strategist and market intelligence analyst with 15+ years of experience building brand intelligence for Fortune 500 companies.

Your role: critically review AI-generated brand analysis for accuracy, strategic depth, logical consistency, and completeness.

You should produce outputs that feel like senior strategy consulting deliverables — not shallow AI summaries.

Be specific, evidence-based, and strategically rigorous. Respond with valid JSON only.`,
        messages: [{
          role: 'user',
          content: `Review this AI-generated brand analysis for "${websiteUrl}" and validate, improve, and enrich it.

## Raw AI Analysis (Pass 1+2 output):
${profileJson}

## Additional context from scraped pages:
${pagesContext.slice(0, 4000)}

## Your Tasks:

1. **VALIDATE** each field for factual plausibility and strategic accuracy
2. **IMPROVE** shallow descriptions into senior-level strategic insights
3. **DETECT** contradictions between different sections
4. **IDENTIFY** missing intelligence gaps and opportunities
5. **DEEPEN** audience psychology beyond surface demographics
6. **STRENGTHEN** competitive positioning analysis
7. **ASSIGN** confidence scores (0.0–1.0) based on evidence quality

## Improvement Standard:
- BEFORE: "Target audience is fitness people"
- AFTER: "Primary audience: protein-conscious flexitarians aged 28–42 seeking whole-food alternatives to ultra-processed meat substitutes, motivated by performance optimization and identity alignment with 'clean eating' culture"

Return ONLY valid JSON:
{
  "validatedProfile": {
    "brandName": { "value": "...", "confidence": 0.0-1.0, "sources": ["page names"], "notes": "..." },
    "industry": { "value": "...", "confidence": 0.0-1.0, "sources": [], "improved": false },
    "targetAudience": { "value": "improved strategic description", "confidence": 0.0-1.0, "sources": [], "improved": true },
    "valueProposition": { "value": "...", "confidence": 0.0-1.0, "sources": [], "notes": "..." },
    "tone": { "value": "...", "confidence": 0.0-1.0, "sources": [] },
    "productDescription": { "value": "...", "confidence": 0.0-1.0, "sources": [] },
    "voiceCharacteristics": { "value": ["..."], "confidence": 0.0-1.0, "sources": [] },
    "contentPillars": { "value": ["..."], "confidence": 0.0-1.0, "sources": [] },
    "competitors": { "value": ["..."], "confidence": 0.0-1.0, "sources": [], "notes": "validation of competitor claims" }
  },
  "contradictions": [
    {
      "fields": ["tone", "socialMediaStrategy"],
      "description": "exact description of the contradiction",
      "severity": "high|medium|low",
      "resolution": "how to resolve it"
    }
  ],
  "missingInsights": [
    {
      "area": "area name e.g. sustainability positioning",
      "opportunity": "specific opportunity description",
      "priority": "high|medium|low"
    }
  ],
  "validationWarnings": [
    {
      "issue": "specific issue",
      "confidence": 0.0-1.0,
      "field": "which field",
      "recommendation": "what to do"
    }
  ],
  "audiencePsychology": {
    "emotionalTriggers": ["5-8 specific emotional triggers"],
    "fears": ["4-6 core fears this audience has"],
    "aspirations": ["4-6 specific aspirations"],
    "identityDrivers": ["3-5 identity statements: 'I am someone who...'"],
    "buyingMotivations": ["4-6 specific buying motivations"],
    "psychographics": "2-3 sentence psychographic profile"
  },
  "contentStrategyImprovements": {
    "improvedPillars": ["4-6 strategic content pillars with rationale"],
    "hooks": ["5-8 high-performing content hook templates for this brand"],
    "platformPriority": { "instagram": "rationale", "linkedin": "rationale" },
    "messagingHierarchy": ["primary message", "secondary message", "tertiary message"]
  },
  "marketIntelligence": {
    "industryTrends": ["3-5 relevant industry trends"],
    "categoryRisks": ["2-4 specific market risks"],
    "opportunities": ["3-5 specific market opportunities"],
    "competitivePositioning": "strategic positioning assessment",
    "marketSophistication": 1-5
  },
  "overallScore": 0.0-1.0,
  "strategicSummary": "2-3 sentence executive summary of validated brand intelligence"
}`,
        }],
        routing: { forceModel: 'gemini-2.5-pro' },
      });

      const match = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.content.match(/(\{[\s\S]*\})/s);
      const parsed = JSON.parse(match?.[1] ?? response.content);
      this.logger.log(`Gemini validation complete — score=${parsed.overallScore}, contradictions=${parsed.contradictions?.length ?? 0}`);
      return { ...EMPTY_REPORT, ...parsed };
    } catch (err) {
      this.logger.error(`Gemini validation failed: ${err}`);
      return { ...EMPTY_REPORT, strategicSummary: 'Validation encountered an error — using raw extraction.' };
    }
  }

  // ── Stage 4: Contradiction Resolution + Final Synthesis ───────────────────

  async synthesizeFinal(
    rawProfile: Record<string, any>,
    geminiReport: GeminiValidationReport,
  ): Promise<Record<string, any>> {
    const validated = geminiReport.validatedProfile;

    // Merge validated improvements over raw profile
    const final: Record<string, any> = { ...rawProfile };

    for (const [field, score] of Object.entries(validated)) {
      if (score.improved || (score.confidence > 0.6 && score.value)) {
        final[field] = score.value;
      }
    }

    // Inject enriched intelligence
    final.audiencePsychology = geminiReport.audiencePsychology;
    final.marketIntelligence = geminiReport.marketIntelligence;
    final.contentStrategyImprovements = geminiReport.contentStrategyImprovements;
    final.contradictions = geminiReport.contradictions;
    final.missingInsights = geminiReport.missingInsights;
    final.validationScore = geminiReport.overallScore;
    final.confidenceScores = Object.fromEntries(
      Object.entries(validated).map(([k, v]) => [k, { confidence: v.confidence, sources: v.sources }]),
    );

    // Use improved content pillars if available
    if (geminiReport.contentStrategyImprovements.improvedPillars.length > 0) {
      final.contentPillars = geminiReport.contentStrategyImprovements.improvedPillars;
    }

    return final;
  }

  // ── Stage 3b: Contradiction Detection (fast Gemini Flash pass) ────────────

  async detectContradictions(sections: Record<string, string>): Promise<Contradiction[]> {
    if (!this.llm) return [];

    const sectionText = Object.entries(sections)
      .map(([k, v]) => `### ${k}\n${v.slice(0, 600)}`)
      .join('\n\n');

    try {
      const response = await this.llm.route({
        systemPrompt: 'You are a brand consistency analyst. Detect logical contradictions across brand documents. Respond with JSON array only.',
        messages: [{
          role: 'user',
          content: `Detect contradictions across these brand intelligence sections:

${sectionText}

Return ONLY a JSON array (can be empty []):
[
  {
    "fields": ["section_a", "section_b"],
    "description": "exact contradiction description",
    "severity": "high|medium|low",
    "resolution": "how to resolve"
  }
]`,
        }],
        routing: { forceModel: 'gemini-2.0-flash' },
      });

      const match = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.content.match(/(\[[\s\S]*\])/s);
      return JSON.parse(match?.[1] ?? response.content) ?? [];
    } catch {
      return [];
    }
  }
}

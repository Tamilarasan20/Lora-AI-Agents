import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentRunResult, ToolDefinition } from '../base-agent';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { SOPHIE_SYSTEM_PROMPT } from './sophie.prompts';
import { buildSophieTools } from './sophie.tools';

export type SeoPlatform = 'blog' | 'web' | 'youtube' | 'linkedin' | 'medium';

export interface SeoBriefRequest {
  topic: string;
  brandName: string;
  brandVoice?: string;
  platform?: SeoPlatform;
  targetKeywords?: string[];
  audience?: string;
  existingContent?: string;
}

export interface ContentOptimizationRequest {
  draft: string;
  primaryKeyword: string;
  brandName: string;
}

export interface FaqBlockRequest {
  topic: string;
  brandName: string;
  count?: number;
}

@Injectable()
export class SophieAgent extends BaseAgent {
  protected readonly agentName = 'Sophie';
  protected readonly systemPrompt = SOPHIE_SYSTEM_PROMPT;
  protected readonly tools: ToolDefinition[] = buildSophieTools();

  constructor(router: LlmRouterService) {
    super();
    this.router = router;
  }

  /**
   * Produce a full SEO + GEO brief for a topic. Returns keywords, meta tags,
   * headings outline, FAQs, schema markup, citable facts, and a content score.
   */
  async buildBrief(req: SeoBriefRequest): Promise<AgentRunResult> {
    const prompt = `Build a complete SEO + GEO brief for the topic below.

Topic: ${req.topic}
Brand: ${req.brandName}
${req.brandVoice ? `Brand voice: ${req.brandVoice}` : ''}
Platform: ${req.platform ?? 'blog'}
${req.audience ? `Audience: ${req.audience}` : ''}
${req.targetKeywords?.length ? `Seed keywords: ${req.targetKeywords.join(', ')}` : ''}
${req.existingContent ? `\nExisting draft to optimise:\n${req.existingContent.slice(0, 2000)}` : ''}

Return STRICT JSON:
{
  "primaryKeyword": "...",
  "secondaryKeywords": ["..."],
  "longTailKeywords": ["..."],
  "searchIntent": "informational | navigational | transactional | commercial",
  "metaTitle": "<= 60 chars",
  "metaDescription": "<= 155 chars",
  "slug": "kebab-case-url",
  "h1": "...",
  "outline": [{ "heading": "...", "level": "h2", "bullets": ["..."] }],
  "faqs": [{ "question": "...", "answer": "..." }],
  "schemaMarkup": { "type": "Article|Product|FAQPage|HowTo|LocalBusiness", "jsonLd": {} },
  "geoOptimisations": {
    "citableFacts": ["..."],
    "directAnswers": [{ "question": "...", "answer": "..." }],
    "sourceCredibilityHooks": ["..."],
    "structuredFormat": "..."
  },
  "internalLinkSuggestions": ["..."],
  "contentScore": 0-100
}`;

    return this.run(prompt, { brief: req }, {
      taskType: 'sophie-build-brief',
      temperature: 0.6,
      maxTokens: 4096,
    });
  }

  /**
   * Rewrite an existing draft to be SEO + GEO optimised against a primary
   * keyword. Returns the rewritten content + a diff summary.
   */
  async optimizeContent(req: ContentOptimizationRequest): Promise<AgentRunResult> {
    const prompt = `Rewrite the draft below to optimise for SEO + GEO.

Brand: ${req.brandName}
Primary keyword: ${req.primaryKeyword}

DRAFT:
${req.draft.slice(0, 6000)}

Return STRICT JSON:
{
  "optimizedDraft": "Full rewritten content",
  "metaTitle": "...",
  "metaDescription": "...",
  "changesApplied": ["concrete change 1", "..."],
  "scoreBefore": 0-100,
  "scoreAfter": 0-100
}`;

    return this.run(prompt, { request: req }, {
      taskType: 'sophie-optimize-content',
      temperature: 0.5,
      maxTokens: 6144,
    });
  }

  /**
   * Generate a FAQ block on a topic, tuned to be both schema-eligible and
   * LLM-citable (direct, 2-3 sentence answers).
   */
  async generateFaqs(req: FaqBlockRequest): Promise<AgentRunResult> {
    const prompt = `Generate ${req.count ?? 8} high-value FAQs for the topic below.

Topic: ${req.topic}
Brand: ${req.brandName}

Each answer must:
- Stand alone if quoted by an LLM (no "see above" / "as mentioned")
- Be 2-3 sentences
- Lead with the most direct answer in sentence 1
- Be factually verifiable

Return STRICT JSON: { "faqs": [{ "question": "...", "answer": "..." }] }`;

    return this.run(prompt, { request: req }, {
      taskType: 'sophie-generate-faqs',
      temperature: 0.5,
      maxTokens: 2048,
    });
  }
}

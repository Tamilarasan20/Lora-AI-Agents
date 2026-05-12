import { ToolDefinition } from '../base-agent';

/**
 * Sophie's tools — keyword research, SERP inspection, schema generation.
 *
 * Phase 1: built-in JSON outputs (no external API calls). Phase 2 will
 * wire in DataForSEO / Ahrefs APIs through the same interface.
 */
export function buildSophieTools(): ToolDefinition[] {
  return [
    {
      name: 'classify_search_intent',
      description:
        'Classify the search intent of a keyword as informational, navigational, transactional, or commercial. Returns the intent and a confidence score.',
      inputSchema: {
        properties: {
          keyword: { type: 'string' },
        },
        required: ['keyword'],
      },
      handler: async (input) => {
        const kw = String(input.keyword).toLowerCase();
        const has = (...needles: string[]) => needles.some((n) => kw.includes(n));

        let intent: 'informational' | 'navigational' | 'transactional' | 'commercial';
        let confidence: number;

        if (has('buy', 'price', 'order', 'shop', 'cheap', 'discount')) {
          intent = 'transactional'; confidence = 0.9;
        } else if (has('best', 'vs', 'review', 'compare', 'top')) {
          intent = 'commercial'; confidence = 0.85;
        } else if (has('login', 'signin', 'official')) {
          intent = 'navigational'; confidence = 0.85;
        } else {
          intent = 'informational'; confidence = 0.7;
        }

        return { keyword: input.keyword, intent, confidence };
      },
    },
    {
      name: 'generate_schema_markup',
      description:
        'Generate JSON-LD schema markup for a piece of content. Returns the schema object ready to embed in <script type="application/ld+json">.',
      inputSchema: {
        properties: {
          schemaType: {
            type: 'string',
            enum: ['Article', 'Product', 'FAQPage', 'HowTo', 'LocalBusiness'],
          },
          title: { type: 'string' },
          description: { type: 'string' },
          author: { type: 'string' },
          datePublished: { type: 'string', description: 'ISO 8601 date' },
          extra: {
            type: 'object',
            description: 'Type-specific properties (e.g. faqs, steps, offers)',
          },
        },
        required: ['schemaType', 'title'],
      },
      handler: async (input) => {
        const base: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': input.schemaType,
          name: input.title,
        };
        if (input.description) base.description = input.description;
        if (input.author) base.author = { '@type': 'Person', name: input.author };
        if (input.datePublished) base.datePublished = input.datePublished;
        if (input.extra && typeof input.extra === 'object') {
          Object.assign(base, input.extra as Record<string, unknown>);
        }
        return { schema: base, embedTag: `<script type="application/ld+json">${JSON.stringify(base)}</script>` };
      },
    },
    {
      name: 'score_content',
      description:
        'Score a piece of content on SEO + GEO axes (0-100). Returns sub-scores and improvement suggestions.',
      inputSchema: {
        properties: {
          content: { type: 'string' },
          primaryKeyword: { type: 'string' },
          hasMetaTitle: { type: 'boolean' },
          hasMetaDescription: { type: 'boolean' },
          hasSchemaMarkup: { type: 'boolean' },
          headingCount: { type: 'number' },
          internalLinkCount: { type: 'number' },
        },
        required: ['content', 'primaryKeyword'],
      },
      handler: async (input) => {
        const content = String(input.content);
        const kw = String(input.primaryKeyword).toLowerCase();
        const wordCount = content.split(/\s+/).length;
        const kwInContent = (content.toLowerCase().match(new RegExp(`\\b${kw}\\b`, 'g'))?.length ?? 0);
        const kwDensity = wordCount > 0 ? (kwInContent / wordCount) * 100 : 0;

        const seoScore =
          (input.hasMetaTitle ? 10 : 0) +
          (input.hasMetaDescription ? 10 : 0) +
          (input.hasSchemaMarkup ? 10 : 0) +
          Math.min(20, ((input.headingCount as number) ?? 0) * 4) +
          Math.min(15, ((input.internalLinkCount as number) ?? 0) * 3) +
          (kwDensity >= 0.5 && kwDensity <= 2.5 ? 20 : kwDensity > 0 ? 10 : 0) +
          (wordCount >= 600 ? 15 : Math.floor(wordCount / 40));

        const issues: string[] = [];
        if (!input.hasMetaTitle) issues.push('Missing meta title');
        if (!input.hasMetaDescription) issues.push('Missing meta description');
        if (!input.hasSchemaMarkup) issues.push('No schema markup — add JSON-LD');
        if (wordCount < 600) issues.push(`Content is short (${wordCount} words) — most SERPs reward 1000+`);
        if (kwDensity < 0.5) issues.push(`Primary keyword density low (${kwDensity.toFixed(2)}%)`);
        if (kwDensity > 2.5) issues.push(`Primary keyword density too high (${kwDensity.toFixed(2)}%) — risk of stuffing`);

        return {
          overallScore: Math.min(100, seoScore),
          subScores: {
            metadata: (input.hasMetaTitle ? 10 : 0) + (input.hasMetaDescription ? 10 : 0),
            structure: Math.min(20, ((input.headingCount as number) ?? 0) * 4),
            keywordUse: kwDensity >= 0.5 && kwDensity <= 2.5 ? 20 : 10,
            depth: wordCount >= 600 ? 15 : Math.floor(wordCount / 40),
            schema: input.hasSchemaMarkup ? 10 : 0,
          },
          wordCount,
          keywordDensity: Number(kwDensity.toFixed(2)),
          issues,
        };
      },
    },
  ];
}

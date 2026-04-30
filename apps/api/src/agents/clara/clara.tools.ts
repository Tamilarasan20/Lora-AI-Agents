import { ToolDefinition } from '../base-agent';

export function buildClaraTools(): ToolDefinition[] {
  return [
    {
      name: 'generate_hashtags',
      description:
        'Generate a curated list of relevant hashtags for a topic, mixing high-reach and niche tags appropriate to a platform.',
      inputSchema: {
        properties: {
          topic: { type: 'string', description: 'The content topic or theme' },
          platform: { type: 'string', description: 'Target platform (instagram, twitter, etc.)' },
          count: { type: 'number', description: 'Number of hashtags to generate (default: 15)' },
          brandKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Brand-specific keywords to incorporate',
          },
        },
        required: ['topic', 'platform'],
      },
      handler: async (input) => {
        // TODO Phase 6: Call real trending hashtag API or vector search against historical performance data
        const count = (input.count as number) ?? 15;
        const topic = input.topic as string;
        return {
          hashtags: Array.from({ length: count }, (_, i) => `#${topic.replace(/\s+/g, '')}${i > 0 ? i : ''}`),
          note: 'Stub — real implementation uses trending data from platform APIs',
        };
      },
    },
    {
      name: 'analyze_brand_voice',
      description:
        'Analyze existing brand content samples to extract voice characteristics, preferred phrases, and avoid list.',
      inputSchema: {
        properties: {
          samples: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of existing brand post examples',
          },
          brandName: { type: 'string' },
        },
        required: ['samples', 'brandName'],
      },
      handler: async (input) => {
        // TODO Phase 4: Embed samples into Qdrant, run similarity clustering, extract patterns via LLM
        const samples = input.samples as string[];
        return {
          averageLength: Math.floor(samples.reduce((sum, s) => sum + s.length, 0) / samples.length),
          detectedTone: 'professional',
          commonPhrases: [],
          note: 'Stub — real implementation uses Qdrant vector analysis',
        };
      },
    },
    {
      name: 'adapt_content_for_platform',
      description:
        'Take a master content brief and adapt it for a specific platform, respecting character limits and platform conventions.',
      inputSchema: {
        properties: {
          masterCaption: { type: 'string', description: 'Original full-length caption or brief' },
          platform: { type: 'string' },
          tone: { type: 'string' },
          maxLength: { type: 'number' },
          includeHashtags: { type: 'boolean' },
        },
        required: ['masterCaption', 'platform'],
      },
      handler: async (input) => {
        // Clara uses this as a structured output target — the LLM fills in the real adaptation
        return {
          adaptedCaption: (input.masterCaption as string).slice(0, (input.maxLength as number) ?? 280),
          platform: input.platform,
          note: 'Clara should generate the adapted content in its response, not rely on this stub',
        };
      },
    },
    {
      name: 'generate_image_prompt',
      description:
        'Create a detailed prompt for AI image generation (DALL-E / Stable Diffusion) based on content context and brand aesthetics.',
      inputSchema: {
        properties: {
          contentTheme: { type: 'string' },
          brandColors: { type: 'array', items: { type: 'string' } },
          style: {
            type: 'string',
            enum: ['photorealistic', 'illustrated', 'minimalist', 'bold', 'lifestyle'],
          },
          platform: { type: 'string' },
          aspectRatio: { type: 'string', description: 'e.g. 1:1, 9:16, 16:9' },
        },
        required: ['contentTheme', 'platform'],
      },
      handler: async (input) => {
        // TODO Phase 6: Pass to image generation service (Replicate/DALL-E)
        return {
          prompt: `A ${input.style ?? 'photorealistic'} image about ${input.contentTheme}, optimized for ${input.platform}, aspect ratio ${input.aspectRatio ?? '1:1'}`,
          negativePrompt: 'low quality, blurry, watermark, text overlay',
          note: 'Stub — real implementation calls image generation API',
        };
      },
    },
    {
      name: 'check_content_compliance',
      description:
        'Check if content violates platform community guidelines or brand prohibited words list.',
      inputSchema: {
        properties: {
          content: { type: 'string' },
          platform: { type: 'string' },
          prohibitedWords: { type: 'array', items: { type: 'string' } },
        },
        required: ['content', 'platform'],
      },
      handler: async (input) => {
        const content = (input.content as string).toLowerCase();
        const prohibited = (input.prohibitedWords as string[]) ?? [];
        const violations = prohibited.filter((w) => content.includes(w.toLowerCase()));
        return {
          compliant: violations.length === 0,
          violations,
          suggestions: violations.map((v) => `Remove or replace "${v}"`),
        };
      },
    },
  ];
}

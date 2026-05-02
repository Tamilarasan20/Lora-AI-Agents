import OpenAI from 'openai';
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
        const topic = input.topic as string;
        const platform = input.platform as string;
        const count = (input.count as number) ?? 15;
        const keywords = (input.brandKeywords as string[]) ?? [];

        // Build a smart hashtag set from the topic using word variations
        const base = topic
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(Boolean);
        const brandTags = keywords.map(k => `#${k.replace(/\s+/g, '')}`);

        // Platform-specific strategy
        const platformLimits: Record<string, number> = {
          instagram: 30,
          twitter: 3,
          linkedin: 5,
          tiktok: 10,
          facebook: 5,
        };
        const maxForPlatform = Math.min(count, platformLimits[platform] ?? 15);

        // Generate compound and single-word hashtags
        const generated: string[] = [];
        // Add compound: full topic joined
        if (base.length > 1) generated.push(`#${base.join('')}`);
        // Add each word
        base.forEach(w => { if (w.length > 3) generated.push(`#${w}`); });
        // Add common engagement tags per platform
        const engagementTags: Record<string, string[]> = {
          instagram: ['#instagood', '#photooftheday', '#explorepage', '#reels', '#viral'],
          twitter: ['#trending', '#viral'],
          linkedin: ['#business', '#leadership', '#innovation'],
          tiktok: ['#fyp', '#foryoupage', '#viral', '#trending'],
          facebook: ['#facebook', '#share'],
        };
        const extras = engagementTags[platform] ?? [];
        const all = [...new Set([...generated, ...brandTags, ...extras])].slice(0, maxForPlatform);

        return { hashtags: all, count: all.length, platform };
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
        const samples = input.samples as string[];
        const brandName = input.brandName as string;

        // Compute real stats from the samples
        const avgLength = Math.floor(
          samples.reduce((s, t) => s + t.length, 0) / (samples.length || 1),
        );
        const avgWords = Math.floor(
          samples.reduce((s, t) => s + t.split(/\s+/).length, 0) / (samples.length || 1),
        );

        // Detect tone by keyword frequency
        const text = samples.join(' ').toLowerCase();
        const toneSignals: Record<string, string[]> = {
          professional: ['we', 'our', 'team', 'solution', 'strategy', 'results', 'growth'],
          casual: ['you', 'hey', 'love', 'awesome', 'check out', 'omg', 'lol'],
          inspirational: ['dream', 'believe', 'inspire', 'journey', 'achieve', 'passion', 'purpose'],
          educational: ['learn', 'tip', 'how to', 'guide', 'explained', 'understand', 'insight'],
          witty: ['haha', '😂', 'just saying', 'plot twist', 'ngl', 'hot take'],
        };
        let detectedTone = 'professional';
        let maxScore = 0;
        for (const [tone, toneKeywords] of Object.entries(toneSignals)) {
          const score = toneKeywords.filter(k => text.includes(k)).length;
          if (score > maxScore) { maxScore = score; detectedTone = tone; }
        }

        // Extract common phrases (2+ word sequences that appear multiple times)
        const wordPairs: Record<string, number> = {};
        samples.forEach(s => {
          const words = s.toLowerCase().split(/\s+/);
          for (let i = 0; i < words.length - 1; i++) {
            const pair = `${words[i]} ${words[i + 1]}`;
            if (pair.length > 6) wordPairs[pair] = (wordPairs[pair] ?? 0) + 1;
          }
        });
        const commonPhrases = Object.entries(wordPairs)
          .filter(([, c]) => c > 1)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([phrase]) => phrase);

        // Emoji usage
        const emojiCount = (samples.join('').match(/\p{Emoji}/gu) ?? []).length;
        const usesEmoji = emojiCount > samples.length * 0.5;

        return {
          brandName,
          averageLength: avgLength,
          averageWordCount: avgWords,
          detectedTone,
          commonPhrases,
          usesEmoji,
          emojiFrequency: usesEmoji ? 'frequent' : 'minimal',
          sampleCount: samples.length,
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
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
        if (!process.env.OPENAI_API_KEY) {
          return {
            prompt: `A ${input.style ?? 'photorealistic'} image about ${input.contentTheme}`,
            negativePrompt: 'low quality, blurry, watermark',
            note: 'OPENAI_API_KEY not configured — returning prompt only',
          };
        }
        const prompt = `A ${input.style ?? 'photorealistic'} image about ${input.contentTheme}, optimized for ${input.platform ?? 'social media'}, aspect ratio ${input.aspectRatio ?? '1:1'}, brand colors: ${(input.brandColors as string[] | undefined ?? []).join(', ') || 'vibrant'}`;
        const size: '1792x1024' | '1024x1792' | '1024x1024' =
          input.aspectRatio === '16:9' ? '1792x1024'
          : input.aspectRatio === '9:16' ? '1024x1792'
          : '1024x1024';
        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size,
          quality: 'standard',
          response_format: 'url',
        });
        const imageData = response.data?.[0];
        return {
          imageUrl: imageData?.url,
          revisedPrompt: imageData?.revised_prompt,
          prompt,
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

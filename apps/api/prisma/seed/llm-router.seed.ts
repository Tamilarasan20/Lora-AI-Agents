import { PrismaClient } from '@prisma/client';

export async function seedLlmRouter(prisma: PrismaClient) {
  console.log('🌱 Seeding LLM router registry...');

  // ─── Providers ─────────────────────────────────────────────────────────────

  const providers = [
    {
      name: 'anthropic', displayName: 'Anthropic (Claude)',
      supportsText: true, supportsImage: false, supportsVideo: false,
      supportsAudio: false, supportsVision: true, supportsSearch: false,
      priority: 10,
    },
    {
      name: 'openai', displayName: 'OpenAI (GPT + DALL-E)',
      supportsText: true, supportsImage: true, supportsVideo: false,
      supportsAudio: true, supportsVision: true, supportsSearch: false,
      priority: 20,
    },
    {
      name: 'gemini', displayName: 'Google (Gemini + Imagen + Veo)',
      supportsText: true, supportsImage: true, supportsVideo: true,
      supportsAudio: true, supportsVision: true, supportsSearch: false,
      priority: 30,
    },
    {
      name: 'perplexity', displayName: 'Perplexity (Sonar)',
      supportsText: true, supportsImage: false, supportsVideo: false,
      supportsAudio: false, supportsVision: false, supportsSearch: true,
      priority: 40,
    },
    {
      name: 'xai', displayName: 'xAI (Grok)',
      supportsText: true, supportsImage: false, supportsVideo: false,
      supportsAudio: false, supportsVision: false, supportsSearch: false,
      priority: 50,
    },
    {
      name: 'meta', displayName: 'Meta (Llama via Groq)',
      supportsText: true, supportsImage: false, supportsVideo: false,
      supportsAudio: false, supportsVision: false, supportsSearch: false,
      priority: 60,
    },
  ];

  const providerMap: Record<string, string> = {};
  for (const p of providers) {
    const record = await prisma.llmProviderRegistry.upsert({
      where: { name: p.name },
      create: { ...p, healthStatus: 'unknown' },
      update: { displayName: p.displayName, priority: p.priority },
    });
    providerMap[p.name] = record.id;
    console.log(`  ✅ Provider: ${p.displayName}`);
  }

  // ─── Models ────────────────────────────────────────────────────────────────

  const models = [
    // ── Anthropic ────────────────────────────────────────────────────────────
    {
      provider: 'anthropic', modelId: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5',
      modality: ['text'], strengths: ['chat', 'classification', 'summarization', 'coding'],
      tier: 'cheap', latencyClass: 'fast', qualityClass: 'standard',
      maxInputTokens: 200000, maxOutputTokens: 8192,
      inputCostPerMTok: 0.80, outputCostPerMTok: 4.00,
      supportsJson: true, supportsTools: true, supportsVision: true, supportsStreaming: true,
      qualityScore: 0.65, latencyScore: 0.95, reliabilityScore: 0.98,
    },
    {
      provider: 'anthropic', modelId: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6',
      modality: ['text'], strengths: ['copywriting', 'planning', 'analysis', 'coding', 'review'],
      tier: 'premium', latencyClass: 'medium', qualityClass: 'premium',
      maxInputTokens: 200000, maxOutputTokens: 8192,
      inputCostPerMTok: 3.00, outputCostPerMTok: 15.00,
      supportsJson: true, supportsTools: true, supportsVision: true, supportsStreaming: true,
      qualityScore: 0.88, latencyScore: 0.72, reliabilityScore: 0.97,
    },
    {
      provider: 'anthropic', modelId: 'claude-opus-4-7', displayName: 'Claude Opus 4.7',
      modality: ['text'], strengths: ['strategy', 'long-context', 'planning', 'review', 'research'],
      tier: 'frontier', latencyClass: 'slow', qualityClass: 'frontier',
      maxInputTokens: 200000, maxOutputTokens: 8192,
      inputCostPerMTok: 15.00, outputCostPerMTok: 75.00,
      supportsJson: true, supportsTools: true, supportsVision: true, supportsStreaming: true,
      qualityScore: 0.97, latencyScore: 0.45, reliabilityScore: 0.96,
    },

    // ── OpenAI ────────────────────────────────────────────────────────────────
    {
      provider: 'openai', modelId: 'gpt-4o-mini', displayName: 'GPT-4o mini',
      modality: ['text'], strengths: ['chat', 'classification', 'coding', 'summarization'],
      tier: 'cheap', latencyClass: 'fast', qualityClass: 'standard',
      maxInputTokens: 128000, maxOutputTokens: 16384,
      inputCostPerMTok: 0.15, outputCostPerMTok: 0.60,
      supportsJson: true, supportsTools: true, supportsVision: true, supportsStreaming: true,
      qualityScore: 0.68, latencyScore: 0.92, reliabilityScore: 0.99,
    },
    {
      provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-4o',
      modality: ['text'], strengths: ['copywriting', 'analysis', 'coding', 'research', 'vision'],
      tier: 'premium', latencyClass: 'medium', qualityClass: 'premium',
      maxInputTokens: 128000, maxOutputTokens: 16384,
      inputCostPerMTok: 2.50, outputCostPerMTok: 10.00,
      supportsJson: true, supportsTools: true, supportsVision: true, supportsStreaming: true,
      qualityScore: 0.87, latencyScore: 0.75, reliabilityScore: 0.99,
    },
    {
      provider: 'openai', modelId: 'dall-e-3', displayName: 'DALL-E 3',
      modality: ['image'], strengths: ['image-generation', 'creative'],
      tier: 'standard', latencyClass: 'medium', qualityClass: 'premium',
      maxInputTokens: 4000, maxOutputTokens: 0,
      inputCostPerMTok: 0, outputCostPerMTok: 0, imageCostUnit: 0.04,
      supportsJson: false, supportsTools: false, supportsVision: false, supportsStreaming: false,
      qualityScore: 0.85, latencyScore: 0.65, reliabilityScore: 0.97,
    },

    // ── Google Gemini ─────────────────────────────────────────────────────────
    {
      provider: 'gemini', modelId: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash',
      modality: ['text'], strengths: ['chat', 'scraping', 'analysis', 'summarization', 'vision'],
      tier: 'cheap', latencyClass: 'fast', qualityClass: 'standard',
      maxInputTokens: 1000000, maxOutputTokens: 8192,
      inputCostPerMTok: 0.075, outputCostPerMTok: 0.30,
      supportsJson: true, supportsTools: true, supportsVision: true, supportsStreaming: true,
      qualityScore: 0.72, latencyScore: 0.93, reliabilityScore: 0.97,
    },
    {
      provider: 'gemini', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro',
      modality: ['text'], strengths: ['strategy', 'long-context', 'research', 'analysis', 'coding'],
      tier: 'frontier', latencyClass: 'slow', qualityClass: 'frontier',
      maxInputTokens: 1000000, maxOutputTokens: 8192,
      inputCostPerMTok: 1.25, outputCostPerMTok: 10.00,
      supportsJson: true, supportsTools: true, supportsVision: true, supportsStreaming: true,
      qualityScore: 0.94, latencyScore: 0.55, reliabilityScore: 0.96,
    },
    {
      provider: 'gemini', modelId: 'imagen-3.0-generate-001', displayName: 'Imagen 3',
      modality: ['image'], strengths: ['image-generation', 'photorealism'],
      tier: 'standard', latencyClass: 'medium', qualityClass: 'premium',
      maxInputTokens: 4000, maxOutputTokens: 0,
      inputCostPerMTok: 0, outputCostPerMTok: 0, imageCostUnit: 0.02,
      supportsJson: false, supportsTools: false, supportsVision: false, supportsStreaming: false,
      qualityScore: 0.88, latencyScore: 0.60, reliabilityScore: 0.95,
    },
    {
      provider: 'gemini', modelId: 'veo-3.0-generate-preview', displayName: 'Veo 3',
      modality: ['video'], strengths: ['video-generation'],
      tier: 'specialist', latencyClass: 'slow', qualityClass: 'frontier',
      maxInputTokens: 4000, maxOutputTokens: 0,
      inputCostPerMTok: 0, outputCostPerMTok: 0, videoCostUnit: 0.35,
      supportsJson: false, supportsTools: false, supportsVision: false, supportsStreaming: false,
      qualityScore: 0.95, latencyScore: 0.20, reliabilityScore: 0.90,
    },

    // ── Perplexity ────────────────────────────────────────────────────────────
    {
      provider: 'perplexity', modelId: 'sonar', displayName: 'Sonar',
      modality: ['text'], strengths: ['research', 'search', 'realtime'],
      tier: 'standard', latencyClass: 'medium', qualityClass: 'standard',
      maxInputTokens: 127000, maxOutputTokens: 8192,
      inputCostPerMTok: 1.00, outputCostPerMTok: 1.00,
      supportsJson: false, supportsTools: false, supportsVision: false, supportsSearch: true, supportsStreaming: true,
      qualityScore: 0.75, latencyScore: 0.70, reliabilityScore: 0.94,
    },
    {
      provider: 'perplexity', modelId: 'sonar-pro', displayName: 'Sonar Pro',
      modality: ['text'], strengths: ['research', 'search', 'realtime', 'analysis'],
      tier: 'premium', latencyClass: 'medium', qualityClass: 'premium',
      maxInputTokens: 200000, maxOutputTokens: 8192,
      inputCostPerMTok: 3.00, outputCostPerMTok: 15.00,
      supportsJson: false, supportsTools: false, supportsVision: false, supportsSearch: true, supportsStreaming: true,
      qualityScore: 0.85, latencyScore: 0.65, reliabilityScore: 0.93,
    },

    // ── xAI Grok ─────────────────────────────────────────────────────────────
    {
      provider: 'xai', modelId: 'grok-3-mini', displayName: 'Grok 3 Mini',
      modality: ['text'], strengths: ['chat', 'social-media', 'trending', 'commentary'],
      tier: 'cheap', latencyClass: 'fast', qualityClass: 'standard',
      maxInputTokens: 131072, maxOutputTokens: 8192,
      inputCostPerMTok: 0.30, outputCostPerMTok: 0.50,
      supportsJson: true, supportsTools: false, supportsVision: false, supportsStreaming: true,
      qualityScore: 0.65, latencyScore: 0.90, reliabilityScore: 0.93,
    },
    {
      provider: 'xai', modelId: 'grok-3', displayName: 'Grok 3',
      modality: ['text'], strengths: ['social-media', 'trending', 'commentary', 'analysis'],
      tier: 'standard', latencyClass: 'medium', qualityClass: 'standard',
      maxInputTokens: 131072, maxOutputTokens: 8192,
      inputCostPerMTok: 2.00, outputCostPerMTok: 10.00,
      supportsJson: true, supportsTools: false, supportsVision: false, supportsStreaming: true,
      qualityScore: 0.76, latencyScore: 0.72, reliabilityScore: 0.92,
    },

    // ── Meta Llama (Groq) ────────────────────────────────────────────────────
    {
      provider: 'meta', modelId: 'meta-llama/llama-4-maverick-17b-128e-instruct', displayName: 'Llama 4 Maverick',
      modality: ['text'], strengths: ['classification', 'summarization', 'chat', 'translation'],
      tier: 'cheap', latencyClass: 'fast', qualityClass: 'standard',
      maxInputTokens: 131072, maxOutputTokens: 8192,
      inputCostPerMTok: 0.20, outputCostPerMTok: 0.60,
      supportsJson: true, supportsTools: false, supportsVision: false, supportsStreaming: true,
      qualityScore: 0.62, latencyScore: 0.97, reliabilityScore: 0.95,
    },
  ];

  for (const model of models) {
    const providerId = providerMap[model.provider];
    if (!providerId) {
      console.warn(`  ⚠️  Provider ${model.provider} not found, skipping ${model.modelId}`);
      continue;
    }

    const { provider: _provider, imageCostUnit, videoCostUnit, ...modelData } = model as any;

    await prisma.llmModelRegistry.upsert({
      where: { modelId: model.modelId },
      create: {
        ...modelData,
        providerId,
        imageCostUnit: imageCostUnit ?? null,
        videoCostUnit: videoCostUnit ?? null,
      },
      update: {
        displayName:   modelData.displayName,
        tier:          modelData.tier,
        qualityScore:  modelData.qualityScore,
        latencyScore:  modelData.latencyScore,
        reliabilityScore: modelData.reliabilityScore,
        inputCostPerMTok:  modelData.inputCostPerMTok,
        outputCostPerMTok: modelData.outputCostPerMTok,
        isActive:      true,
        isDeprecated:  false,
      },
    });
    console.log(`  ✅ Model: ${model.displayName}`);
  }

  // ─── Routing policies ────────────────────────────────────────────────────────

  const policies = [
    {
      name: 'lora-orchestrator',
      description: 'Lora agent — orchestrator and final reviewer',
      agentName: 'Lora',
      taskType: null,
      modality: 'text',
      minTier: 'standard',
      maxTier: 'frontier',
      preferredProviders: ['anthropic', 'openai'],
      blockedProviders: [],
      requiredStrengths: ['planning'],
    },
    {
      name: 'sam-strategist',
      description: 'Sam agent — strategy and market research',
      agentName: 'Sam',
      taskType: 'research',
      modality: 'text',
      minTier: 'standard',
      maxTier: 'frontier',
      preferredProviders: ['perplexity', 'anthropic'],
      blockedProviders: [],
      requiredStrengths: [],
    },
    {
      name: 'sam-competitor-research',
      description: 'Sam agent — realtime competitor analysis',
      agentName: 'Sam',
      taskType: 'strategy',
      modality: 'text',
      minTier: 'standard',
      maxTier: 'premium',
      preferredProviders: ['perplexity'],
      blockedProviders: [],
      requiredStrengths: ['search'],
    },
    {
      name: 'clara-copywriter',
      description: 'Clara agent — copywriting and content creation',
      agentName: 'Clara',
      taskType: 'copywriting',
      modality: 'text',
      minTier: 'standard',
      maxTier: 'premium',
      preferredProviders: ['anthropic', 'openai'],
      blockedProviders: ['meta'],
      requiredStrengths: [],
    },
    {
      name: 'steve-image-gen',
      description: 'Steve agent — image generation',
      agentName: 'Steve',
      taskType: 'image_generation',
      modality: 'image',
      minTier: 'standard',
      maxTier: 'specialist',
      preferredProviders: ['openai', 'gemini'],
      blockedProviders: ['anthropic', 'perplexity', 'xai', 'meta'],
      requiredStrengths: [],
    },
    {
      name: 'steve-video-gen',
      description: 'Steve agent — video generation',
      agentName: 'Steve',
      taskType: 'video_generation',
      modality: 'video',
      minTier: 'specialist',
      maxTier: 'specialist',
      preferredProviders: ['gemini'],
      blockedProviders: ['anthropic', 'openai', 'perplexity', 'xai', 'meta'],
      requiredStrengths: [],
    },
    {
      name: 'sarah-social-scheduler',
      description: 'Sarah agent — social media scheduling',
      agentName: 'Sarah',
      taskType: 'chat',
      modality: 'text',
      minTier: 'cheap',
      maxTier: 'standard',
      preferredProviders: ['gemini', 'openai'],
      blockedProviders: [],
      requiredStrengths: [],
    },
    {
      name: 'scraping-gemini-required',
      description: 'Scraping tasks — must use Gemini multimodal',
      agentName: null,
      taskType: 'scraping',
      modality: 'text',
      minTier: 'cheap',
      maxTier: 'premium',
      preferredProviders: ['gemini'],
      blockedProviders: ['anthropic', 'perplexity', 'xai', 'meta'],
      requiredStrengths: [],
    },
    {
      name: 'realtime-research-perplexity',
      description: 'Realtime research — prefer Perplexity search-augmented',
      agentName: null,
      taskType: 'research',
      modality: 'text',
      minTier: 'standard',
      maxTier: 'premium',
      preferredProviders: ['perplexity'],
      blockedProviders: [],
      requiredStrengths: ['search'],
    },
    {
      name: 'social-trending-xai',
      description: 'Social/trending commentary — prefer xAI Grok for cultural context',
      agentName: null,
      taskType: 'chat',
      modality: 'text',
      minTier: 'cheap',
      maxTier: 'standard',
      preferredProviders: ['xai'],
      blockedProviders: [],
      requiredStrengths: ['social-media'],
    },
  ];

  for (const policy of policies) {
    await prisma.llmRoutingPolicy.upsert({
      where: { name: policy.name },
      create: { ...policy, isActive: true },
      update: {
        preferredProviders: policy.preferredProviders,
        blockedProviders:   policy.blockedProviders,
        minTier:            policy.minTier,
        maxTier:            policy.maxTier,
      },
    });
    console.log(`  ✅ Policy: ${policy.name}`);
  }

  console.log(`🎉 LLM router seeded: ${providers.length} providers, ${models.length} models, ${policies.length} policies`);
}

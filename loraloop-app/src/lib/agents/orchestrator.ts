/**
 * Orchestrator - Coordinates all agents
 */

import { OrchestratorInput, OrchestratorOutput, BusinessKnowledgeBase } from '@/types/agents';
import { getMockBusiness } from '../mockData';
import { extractBrandVoice, generateBrandVoiceSummary } from '../brandVoiceEngine';
import { runLora } from './lora';
import { runClara } from './clara';
import { runSteve } from './steve';
import { getServiceSupabase } from '../supabase';
import { getMemoryContext, extractFacts } from './_memoryContext';

async function loadBusinessKB(businessId: string): Promise<BusinessKnowledgeBase> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (error || !data) throw new Error(`Business not found: ${businessId}`);

  const enrichedData = data.enriched_data || {};
  const brandGuidelines = data.brand_guidelines || {};

  // Map Supabase array-based colors to object format
  const colorsArray: Array<{ usage: string; hex: string }> = brandGuidelines.colors || [];
  const colorsObj = colorsArray.reduce((acc: Record<string, string>, c) => {
    acc[c.usage] = c.hex;
    return acc;
  }, {});

  const logosArray: Array<{ url: string }> = brandGuidelines.logos || [];
  const logoUrl = logosArray[0]?.url || '';

  const typographyArray: Array<{ usage: string; family: string }> = brandGuidelines.typography || [];
  const headingFont = typographyArray.find(t => t.usage === 'headings')?.family || 'Inter Bold';
  const bodyFont = typographyArray.find(t => t.usage === 'body')?.family || 'Inter Regular';

  return {
    enrichedData: {
      brandName: data.business_name || '',
      businessOverview: enrichedData.businessOverview || '',
      brandValues: enrichedData.brandValues || [],
      brandAesthetic: enrichedData.brandAesthetic || '',
      toneOfVoice: enrichedData.brandTone || enrichedData.toneOfVoice || '',
      tagline: enrichedData.tagline || '',
      logoUrl,
    },
    brandGuidelines: {
      colors: colorsObj,
      typography: { headingFont, bodyFont },
      logos: logosArray.map(l => l.url),
      images: brandGuidelines.images || [],
    },
    businessProfile: data.business_profile || '',
    marketResearch: data.market_research || '',
    socialStrategy: data.social_strategy || '',
  };
}

export async function orchestrateContent(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const startTime = Date.now();
  console.log('\n🚀 ORCHESTRATION START');

  try {
    // Load knowledge base — Supabase if businessId given, else mock
    console.log('📚 Loading knowledge base...');
    let kb: BusinessKnowledgeBase;
    if (input.businessId && !input.useMockData) {
      try {
        kb = await loadBusinessKB(input.businessId);
        console.log(`✅ Loaded KB from Supabase for: ${kb.enrichedData.brandName}`);
      } catch (err) {
        console.warn('⚠️ Supabase KB load failed, falling back to mock:', err);
        kb = getMockBusiness();
      }
    } else {
      kb = getMockBusiness();
    }
    const businessName = kb.enrichedData.brandName;

    // Extract brand voice
    console.log('🎭 Extracting brand voice...');
    const brandVoice = extractBrandVoice(kb);
    const brandSummary = generateBrandVoiceSummary(brandVoice);

    // Pre-fetch memory for Lora and Clara in parallel (if a workspaceId was provided).
    const [loraMemory, claraMemory] = input.workspaceId
      ? await Promise.all([
          getMemoryContext({
            workspaceId: input.workspaceId,
            query:       input.goal,
            layers:      ['strategic', 'reflection'],
            agentScopes: ['lora', 'nick', 'shared'],
            limit:       8,
          }),
          getMemoryContext({
            workspaceId: input.workspaceId,
            query:       input.goal,
            layers:      ['brand', 'preference', 'reflection'],
            agentScopes: ['clara', 'shared'],
            limit:       8,
          }),
        ])
      : ['', ''];

    // Run Lora
    console.log('🧠 Running LORA...');
    const loraOutput = await runLora({
      goal: input.goal,
      platform: input.platform,
      businessName,
      brandVoice,
      businessProfile: kb.businessProfile,
      memoryContext: loraMemory,
    });

    // Lora's strategic decisions become durable strategic memory
    if (input.workspaceId) {
      extractFacts({
        workspaceId: input.workspaceId,
        agentScope:  'lora',
        layer:       'strategic',
        raw:         JSON.stringify({ goal: input.goal, platform: input.platform, strategy: loraOutput }),
        sourceType:  'lora-strategy',
        metadata:    { goal: input.goal, platform: input.platform },
      });
    }

    // Run Clara
    console.log('✍️  Running CLARA...');
    const claraOutput = await runClara({
      loraStrategy: loraOutput,
      brandVoice,
      businessName,
      platform: input.platform,
      goal: input.goal,
      memoryContext: claraMemory,
    });

    // Run Steve if image requested
    let steveOutput = undefined;
    if (input.contentTypes.includes('image')) {
      console.log('🎨 Running STEVE...');
      steveOutput = await runSteve({
        claraOutput,
        brandVoice,
        businessName,
        platform: input.platform,
        style: input.preferences?.style,
        imageType: input.preferences?.imageType,
        referenceImages: kb.brandGuidelines.images?.slice(0, 3),
        logoUrl: kb.enrichedData.logoUrl,
      });
    }

    // Format output
    const processingTime = Date.now() - startTime;
    const output: OrchestratorOutput = {
      metadata: {
        businessId: input.businessId,
        businessName,
        platform: input.platform,
        goal: input.goal,
        generatedAt: new Date().toISOString(),
        brandVoice: brandSummary,
        usedMockData: input.useMockData === true || !input.businessId,
        processingTime,
        agentDecisions: {
          lora: loraOutput,
          clara: claraOutput,
        },
      },
    };

    // Add content
    if (input.contentTypes.includes('text')) {
      output.text = {
        caption: claraOutput.caption,
        hashtags: claraOutput.hashtags,
        keyPhrases: claraOutput.keyPhrases,
      };
    }

    if (input.contentTypes.includes('image') && steveOutput) {
      output.image = {
        url: steveOutput.imageUrl,
        prompt: steveOutput.prompt.prompt,
        metadata: {
          platform: input.platform,
          dimensions: `${1080}x${1350}`,
          generatedAt: steveOutput.generatedAt!,
        },
      };
    }

    console.log(`✅ Complete (${processingTime}ms)\n`);
    return output;
  } catch (error) {
    console.error('❌ Orchestration failed:', error);
    throw error;
  }
}

export function prettyPrintOutput(output: OrchestratorOutput): string {
  let result = '\n📦 READY-TO-SHARE CONTENT\n';
  result += `Business: ${output.metadata.businessName}\n`;
  result += `Platform: ${output.metadata.platform}\n\n`;

  if (output.text) {
    result += '📝 CAPTION:\n' + output.text.caption + '\n\n';
    result += '#️⃣  ' + output.text.hashtags.join(' ') + '\n\n';
  }

  if (output.image) {
    result += '🖼️  IMAGE: ' + (output.image.url || '[Prompt ready for generation]') + '\n\n';
  }

  return result;
}

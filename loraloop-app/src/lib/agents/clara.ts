/**
 * CLARA - Message Agent
 */

import { BrandVoice, ClaraOutput, LoraOutput, Platform } from '@/types/agents';
import { callGemini } from '../gemini';
import { buildBrandContext } from '../brandVoiceEngine';

export interface ClaraInput {
  loraStrategy: LoraOutput;
  brandVoice: BrandVoice;
  businessName: string;
  platform: Platform;
  goal: string;
  /** Pre-fetched memory context (brand + preference + reflection facts). */
  memoryContext?: string;
}

export async function runClara(input: ClaraInput): Promise<ClaraOutput> {
  const { loraStrategy, brandVoice, businessName, platform, goal, memoryContext } = input;

  const brandContext = buildBrandContext(brandVoice, businessName);
  const memoryBlock = memoryContext ? `\n${memoryContext}\n` : '';

  const prompt = `You are CLARA, Chief Content Officer for ${businessName}.
${memoryBlock}
Brand: ${brandContext}

Strategy from Lora:
- Angle: ${loraStrategy.angle}
- Message: ${loraStrategy.messaging}
- Tone: ${loraStrategy.tone}

Create compelling copy for ${platform}. Return JSON:
{
  "hook": "Attention-grabbing opening",
  "coreMessage": "Main value proposition",
  "textOverlays": [{"text": "Text", "placement": "top", "size": "large"}],
  "keyPhrases": ["phrase1", "phrase2"],
  "caption": "Platform-optimized caption",
  "hashtags": ["#brand", "#relevant"]
}`;

  try {
    const result = await callGemini({
      taskType: 'social-strategy',
      prompt,
      mimeType: 'application/json',
      minLength: 100,
    });

    return JSON.parse(result.text);
  } catch (error) {
    console.error('[CLARA] Error:', error);
    return {
      hook: loraStrategy.angle,
      coreMessage: loraStrategy.messaging,
      textOverlays: [{ text: loraStrategy.messaging, placement: 'center', size: 'large' }],
      keyPhrases: loraStrategy.keyThemes,
      caption: `${loraStrategy.angle}\n\n${loraStrategy.messaging}`,
      hashtags: brandVoice.values.slice(0, 3).map((v) => `#${v.replace(/\s+/g, '')}`),
    };
  }
}

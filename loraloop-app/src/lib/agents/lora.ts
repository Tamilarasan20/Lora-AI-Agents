/**
 * LORA - Strategy Agent
 */

import { BusinessKnowledgeBase, BrandVoice, LoraOutput, Platform } from '@/types/agents';
import { callGemini } from '../gemini';
import { buildBrandContext } from '../brandVoiceEngine';

export interface LoraInput {
  goal: string;
  platform: Platform;
  businessName: string;
  brandVoice: BrandVoice;
  businessProfile?: string;
  /** Pre-fetched memory context (strategic + reflection facts). */
  memoryContext?: string;
}

export async function runLora(input: LoraInput): Promise<LoraOutput> {
  const { goal, platform, businessName, brandVoice, memoryContext } = input;

  const brandContext = buildBrandContext(brandVoice, businessName);
  const memoryBlock = memoryContext ? `\n${memoryContext}\n` : '';

  const prompt = `You are LORA, CMO for ${businessName}.
${memoryBlock}
Brand: ${brandContext}

Goal: ${goal}
Platform: ${platform}

Make strategic content decisions. Return JSON:
{
  "contentType": ["image", "text"],
  "angle": "Hook/angle",
  "messaging": "Core message",
  "platformAdaptation": "How to adapt",
  "tone": "Emotional tone",
  "keyThemes": ["theme1", "theme2"]
}`;

  try {
    const result = await callGemini({
      taskType: 'social-strategy',
      prompt,
      mimeType: 'application/json',
      minLength: 50,
    });

    return JSON.parse(result.text);
  } catch (error) {
    console.error('[LORA] Error:', error);
    return {
      contentType: ['image', 'text'],
      angle: 'Strategic positioning',
      messaging: goal,
      platformAdaptation: `Optimized for ${platform}`,
      tone: brandVoice.tone,
      keyThemes: brandVoice.values,
    };
  }
}

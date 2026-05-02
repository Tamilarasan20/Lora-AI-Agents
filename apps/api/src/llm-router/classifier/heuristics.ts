import { ModalityType, TaskCategory } from '../llm-router.types';

// ─── Modality keyword maps ────────────────────────────────────────────────────

const IMAGE_KEYWORDS = [
  'generate image', 'create image', 'draw', 'paint', 'illustrate',
  'make a picture', 'make an image', 'design a logo', 'create a banner',
  'image of', 'photo of', 'picture of', 'visual of', 'artwork', 'illustration',
  'render', 'dalle', 'stable diffusion', 'midjourney', 'thumbnail',
  'icon', 'avatar', 'wallpaper', 'infographic', 'poster',
];

const VIDEO_KEYWORDS = [
  'generate video', 'create video', 'make a video', 'video of',
  'animate', 'animation', 'motion', 'clip', 'footage', 'short film',
  'reel', 'cinematic', 'timelapse', 'runway', 'sora', 'veo', 'video generation',
];

const AUDIO_KEYWORDS = [
  'transcribe', 'transcript', 'speech to text', 'voice', 'audio',
  'podcast', 'speak', 'narrate', 'text to speech', 'tts',
  'whisper', 'sound effect', 'music generation', 'sing',
];

// ─── Task category keyword maps ───────────────────────────────────────────────

const CODING_KEYWORDS = [
  'write code', 'write a function', 'write a class', 'implement',
  'debug', 'fix this bug', 'fix this error', 'refactor', 'optimize code',
  'sql query', 'api endpoint', 'unit test', 'typescript', 'javascript',
  'python', 'java', 'rust', 'golang', 'regex', 'algorithm', 'data structure',
  'bash script', 'shell script', 'dockerfile', 'kubernetes', 'terraform',
  'code review', 'pull request', 'git',
];

const ANALYSIS_KEYWORDS = [
  'analyze', 'evaluate', 'compare', 'contrast', 'pros and cons',
  'decision', 'strategy', 'plan', 'should i', 'best approach',
  'trade-off', 'recommendation', 'advice', 'explain why', 'reason',
  'logical', 'argument', 'counterargument', 'critique', 'assess',
  'root cause', 'hypothesis', 'summarize', 'summarize this', 'tldr',
  'extract from', 'analyze this document', 'detailed analysis',
];

const CREATIVE_KEYWORDS = [
  'write a story', 'write a poem', 'creative writing', 'brainstorm',
  'ideate', 'come up with', 'invent', 'imagine', 'fiction', 'narrative',
  'blog post', 'social media caption', 'marketing copy', 'ad copy',
  'email draft', 'write an email', 'cover letter', 'product description',
  'tagline', 'slogan', 'tweet', 'instagram caption',
];

const RESEARCH_KEYWORDS = [
  'today', 'right now', 'current', 'latest', 'recent', 'news',
  'live', 'real-time', 'stock price', 'weather', 'trending', 'trends',
  'what is happening', 'as of today', 'this week', 'this month',
  'market research', 'competitor insights', 'competitor analysis',
  'search for', 'find information', 'look up', 'research',
  'fact check', 'verify', 'source', 'citation',
];

// ─── Complexity signal keywords ───────────────────────────────────────────────

const HIGH_COMPLEXITY_KEYWORDS = [
  'deeply analyze', 'comprehensive', 'exhaustive', 'detailed analysis',
  'in-depth', 'thorough', 'step by step explanation', 'break down completely',
  'full architecture', 'system design', 'design a system',
  'complex', 'nuanced', 'critical', 'mission-critical',
  'multiple perspectives', 'consider all', 'edge cases',
];

const LOW_COMPLEXITY_KEYWORDS = [
  'what is', 'what are', 'who is', 'when was', 'where is',
  'define', 'explain briefly', 'short answer', 'quick', 'simple',
  'tldr', 'one line', 'in one sentence', 'yes or no',
];

// ─── Web search detection ─────────────────────────────────────────────────────

const WEB_SEARCH_KEYWORDS = [
  'latest', 'today', 'right now', 'current', 'recent', 'news',
  'live', 'real-time', 'stock price', 'weather', 'trending', 'trends',
  'what is happening', 'as of today', 'this week', 'this month',
  'breaking news', 'just announced', 'recently released', 'new release',
  'search the web', 'look up online', 'find online', 'internet',
  'market data', 'price today', 'exchange rate',
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectModality(prompt: string): ModalityType {
  const lower = prompt.toLowerCase();
  if (anyMatch(lower, VIDEO_KEYWORDS)) return 'video';
  if (anyMatch(lower, AUDIO_KEYWORDS)) return 'audio';
  if (anyMatch(lower, IMAGE_KEYWORDS)) return 'image';
  return 'text';
}

export function detectTaskCategory(prompt: string): TaskCategory {
  const lower = prompt.toLowerCase();
  if (anyMatch(lower, RESEARCH_KEYWORDS)) return 'research';
  if (anyMatch(lower, CODING_KEYWORDS))   return 'coding';
  if (anyMatch(lower, ANALYSIS_KEYWORDS)) return 'analysis';
  if (anyMatch(lower, CREATIVE_KEYWORDS)) return 'creative';
  return 'chat';
}

export function detectWebSearch(prompt: string): boolean {
  return anyMatch(prompt.toLowerCase(), WEB_SEARCH_KEYWORDS);
}

export function detectComplexitySignals(prompt: string): {
  highSignals: number;
  lowSignals: number;
} {
  const lower = prompt.toLowerCase();
  const highSignals = HIGH_COMPLEXITY_KEYWORDS.filter((k) => lower.includes(k)).length;
  const lowSignals  = LOW_COMPLEXITY_KEYWORDS.filter((k) => lower.includes(k)).length;
  return { highSignals, lowSignals };
}

export function detectStructuralComplexity(prompt: string): number {
  let score = 0;
  const questionMarks = (prompt.match(/\?/g) ?? []).length;
  const listItems     = (prompt.match(/^[\s]*[-*\d+.]\s/gm) ?? []).length;
  const codeBlocks    = (prompt.match(/```/g) ?? []).length / 2;
  const sentences     = (prompt.match(/[.!?]+\s/g) ?? []).length;
  const paragraphs    = (prompt.match(/\n\n+/g) ?? []).length;

  if (questionMarks > 2) score += 2;
  if (listItems > 3)     score += 1;
  if (codeBlocks > 0)    score += 2;
  if (sentences > 10)    score += 1;
  if (paragraphs > 3)    score += 1;

  return score;
}

function anyMatch(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

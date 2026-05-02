import fs from 'fs';
import path from 'path';
import type { BrandDocumentSet, BrandProfileRecord } from '@/lib/brand-types';

const storePath = path.join(process.cwd(), '.brand-local-db.json');

function nowIso() {
  return new Date().toISOString();
}

function createEmptyDocuments(brandName = 'Brand', websiteUrl = ''): BrandDocumentSet {
  return {
    business_profile: `# Business Profile\n\nBrand: ${brandName}\nWebsite: ${websiteUrl}\n`,
    market_research: `# Market Research\n\nNo market research generated yet.\n`,
    social_strategy: `# Social Strategy\n\nNo social strategy generated yet.\n`,
    brand_guidelines: `# Brand Guidelines\n\nNo brand guidelines generated yet.\n`,
    visual_intelligence: `# Visual Intelligence\n\nNo visual intelligence generated yet.\n`,
  };
}

function createDefaultProfile(): BrandProfileRecord {
  const createdAt = nowIso();
  return {
    brandName: '',
    industry: '',
    websiteUrl: '',
    targetAudience: '',
    tone: 'professional',
    voiceCharacteristics: [],
    prohibitedWords: [],
    preferredHashtags: [],
    brandColors: { secondary: [] },
    competitors: [],
    logoUrl: '',
    productDescription: '',
    valueProposition: '',
    contentPillars: [],
    autoReplyEnabled: true,
    sentimentThreshold: -0.5,
    pagesScraped: [],
    lastValidatedAt: '',
    createdAt,
    updatedAt: createdAt,
    documents: createEmptyDocuments(),
    validationHistory: [],
    memory: [],
    dna: { coreValues: [] },
  };
}

export function readBrandProfile(): BrandProfileRecord {
  if (!fs.existsSync(storePath)) {
    return createDefaultProfile();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as Partial<BrandProfileRecord>;
    return {
      ...createDefaultProfile(),
      ...parsed,
      brandColors: parsed.brandColors ?? { secondary: [] },
      competitors: parsed.competitors ?? [],
      voiceCharacteristics: parsed.voiceCharacteristics ?? [],
      prohibitedWords: parsed.prohibitedWords ?? [],
      preferredHashtags: parsed.preferredHashtags ?? [],
      contentPillars: parsed.contentPillars ?? [],
      pagesScraped: parsed.pagesScraped ?? [],
      validationHistory: parsed.validationHistory ?? [],
      memory: parsed.memory ?? [],
      dna: {
        coreValues: [],
        ...(parsed.dna ?? {}),
      },
      documents: {
        ...createEmptyDocuments(parsed.brandName ?? 'Brand', parsed.websiteUrl ?? ''),
        ...(parsed.documents ?? {}),
      },
    };
  } catch {
    return createDefaultProfile();
  }
}

export function writeBrandProfile(profile: BrandProfileRecord) {
  fs.writeFileSync(storePath, JSON.stringify(profile, null, 2), 'utf8');
}

export function updateBrandProfile(updates: Partial<BrandProfileRecord>) {
  const current = readBrandProfile();
  const nextProfile: BrandProfileRecord = {
    ...current,
    ...updates,
    brandColors: updates.brandColors ?? current.brandColors,
    updatedAt: nowIso(),
  };
  writeBrandProfile(nextProfile);
  return nextProfile;
}

function toAbsoluteUrl(baseUrl: string, candidate?: string | null) {
  if (!candidate) return '';
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return '';
  }
}

function pickFirstMatch(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function inferIndustry(description: string, title: string) {
  const source = `${title} ${description}`.toLowerCase();
  if (/(ai|artificial intelligence|automation|saas|software|platform)/.test(source)) return 'AI & Software';
  if (/(fashion|apparel|clothing|jewelry|beauty|cosmetic)/.test(source)) return 'Fashion & Lifestyle';
  if (/(agency|marketing|creative|branding|design)/.test(source)) return 'Marketing & Creative Services';
  if (/(health|wellness|fitness|nutrition|supplement)/.test(source)) return 'Health & Wellness';
  if (/(finance|invest|bank|insurance|fintech)/.test(source)) return 'Finance';
  if (/(education|course|academy|learning)/.test(source)) return 'Education';
  if (/(ecommerce|shop|store|product)/.test(source)) return 'Ecommerce';
  return 'Digital Business';
}

function inferTone(description: string) {
  const source = description.toLowerCase();
  if (/(friendly|warm|community|support)/.test(source)) return 'friendly';
  if (/(bold|disrupt|transform|powerful|future)/.test(source)) return 'bold';
  if (/(fun|playful|humor|creative)/.test(source)) return 'casual';
  return 'professional';
}

function inferVoiceCharacteristics(tone: string, description: string) {
  const base: Record<string, string[]> = {
    friendly: ['approachable', 'helpful', 'clear'],
    bold: ['confident', 'visionary', 'direct'],
    casual: ['playful', 'human', 'relatable'],
    professional: ['credible', 'polished', 'concise'],
  };

  const traits = [...(base[tone] ?? base.professional)];
  if (/premium|luxury/i.test(description)) traits.push('premium');
  if (/innov/i.test(description)) traits.push('innovative');
  return Array.from(new Set(traits));
}

function inferContentPillars(industry: string, description: string) {
  const generic = ['education', 'proof', 'behind the scenes', 'product value'];
  if (/Marketing/.test(industry)) return ['case studies', 'strategy tips', 'brand storytelling', 'results'];
  if (/Software|AI/.test(industry)) return ['product education', 'use cases', 'automation tips', 'customer wins'];
  if (/Fashion|Lifestyle/.test(industry)) return ['product highlights', 'style inspiration', 'community', 'launches'];
  if (/Education/.test(industry)) return ['learning tips', 'expert insights', 'success stories', 'resources'];
  if (/wellness|health/i.test(description)) return ['education', 'wellness advice', 'customer stories', 'product benefits'];
  return generic;
}

function inferCoreValues(description: string) {
  const values = [];
  if (/innovation|future|technology/i.test(description)) values.push('innovation');
  if (/quality|craft|premium/i.test(description)) values.push('quality');
  if (/community|people|customer/i.test(description)) values.push('community');
  if (/trust|reliable|secure/i.test(description)) values.push('trust');
  if (/growth|results|performance/i.test(description)) values.push('growth');
  return values.length ? values : ['clarity', 'consistency', 'growth'];
}

function inferArchetype(industry: string, tone: string) {
  if (tone === 'bold') return 'Creator';
  if (/AI|Software/.test(industry)) return 'Sage';
  if (/Fashion|Lifestyle/.test(industry)) return 'Lover';
  return 'Everyman';
}

function pickBrandColors(html: string) {
  const themeColor = pickFirstMatch(html, /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  const ogColor = pickFirstMatch(html, /--(?:primary|brand|accent)[^:]*:\s*([^;"]+)/i);
  const primary = themeColor || ogColor || '#2563eb';
  return {
    primary,
    secondary: primary === '#2563eb' ? ['#0f172a', '#e2e8f0'] : ['#0f172a', '#f8fafc'],
    accent: '#14b8a6',
  };
}

function buildDocuments(profile: {
  brandName: string;
  websiteUrl: string;
  industry: string;
  valueProposition: string;
  productDescription: string;
  targetAudience: string;
  tone: string;
  voiceCharacteristics: string[];
  contentPillars: string[];
  brandColors: { primary?: string; secondary: string[]; accent?: string };
}) {
  return {
    business_profile: `# Business Profile\n\n## Brand\n- Name: ${profile.brandName}\n- Website: ${profile.websiteUrl}\n- Industry: ${profile.industry}\n\n## Offer\n${profile.productDescription}\n\n## Value Proposition\n${profile.valueProposition}\n\n## Audience\n${profile.targetAudience}\n`,
    market_research: `# Market Research\n\n## Category\n${profile.industry}\n\n## Audience Signals\n${profile.targetAudience}\n\n## Observed Positioning\n${profile.valueProposition}\n`,
    social_strategy: `# Social Strategy\n\n## Tone\n${profile.tone}\n\n## Voice Traits\n${profile.voiceCharacteristics.join(', ')}\n\n## Content Pillars\n${profile.contentPillars.map((pillar) => `- ${pillar}`).join('\n')}\n`,
    brand_guidelines: `# Brand Guidelines\n\n## Tone of Voice\n${profile.tone}\n\n## Voice Characteristics\n${profile.voiceCharacteristics.map((item) => `- ${item}`).join('\n')}\n\n## Colors\n- Primary: ${profile.brandColors.primary ?? 'N/A'}\n- Secondary: ${profile.brandColors.secondary.join(', ') || 'N/A'}\n- Accent: ${profile.brandColors.accent ?? 'N/A'}\n`,
    visual_intelligence: `# Visual Intelligence\n\n## Primary Color\n${profile.brandColors.primary ?? 'N/A'}\n\n## Accent Color\n${profile.brandColors.accent ?? 'N/A'}\n\n## Suggested Visual Direction\nClean, modern, and consistent with the site’s current brand presentation.\n`,
  };
}

export async function analyzeWebsite(websiteUrl: string) {
  const normalizedUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
  let html = '';

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; LoraloopLocalBrandBot/1.0)',
      },
    });

    if (response.ok) {
      html = await response.text();
    }
  } catch {
    html = '';
  }
  const title = cleanText(pickFirstMatch(html, /<title>([^<]+)<\/title>/i));
  const description = cleanText(
    pickFirstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    pickFirstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i),
  );
  const siteName = cleanText(pickFirstMatch(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i));
  const logoHref = toAbsoluteUrl(
    normalizedUrl,
    pickFirstMatch(html, /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
    pickFirstMatch(html, /<img[^>]+(?:alt|class)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i),
  );

  const host = new URL(normalizedUrl).hostname.replace(/^www\./, '');
  const brandName = siteName || title.split('|')[0]?.split('-')[0]?.trim() || host;
  const industry = inferIndustry(description, title);
  const tone = inferTone(description);
  const voiceCharacteristics = inferVoiceCharacteristics(tone, description);
  const contentPillars = inferContentPillars(industry, description);
  const brandColors = pickBrandColors(html);
  const valueProposition = description || `Helping customers through ${industry.toLowerCase()} solutions.`;
  const productDescription = description || `${brandName} offers services and products related to ${industry.toLowerCase()}.`;
  const targetAudience = `Prospects looking for ${industry.toLowerCase()} solutions from ${brandName}.`;
  const now = nowIso();

  const nextProfile: BrandProfileRecord = {
    ...readBrandProfile(),
    brandName,
    industry,
    websiteUrl: normalizedUrl,
    targetAudience,
    tone,
    voiceCharacteristics,
    brandColors,
    logoUrl: logoHref,
    productDescription,
    valueProposition,
    contentPillars,
    pagesScraped: [normalizedUrl],
    lastValidatedAt: now,
    updatedAt: now,
    documents: buildDocuments({
      brandName,
      websiteUrl: normalizedUrl,
      industry,
      valueProposition,
      productDescription,
      targetAudience,
      tone,
      voiceCharacteristics,
      contentPillars,
      brandColors,
    }),
    validationHistory: [
      {
        id: crypto.randomUUID(),
        validatedAt: now,
        overallScore: 0.78,
        pagesScraped: 1,
        imagesFound: logoHref ? 1 : 0,
      },
      ...readBrandProfile().validationHistory,
    ].slice(0, 10),
    memory: [
      {
        id: crypto.randomUUID(),
        detectedAt: now,
        changeType: 'website_analysis',
        field: 'websiteUrl',
        previousValue: readBrandProfile().websiteUrl || null,
        currentValue: normalizedUrl,
      },
      ...readBrandProfile().memory,
    ].slice(0, 20),
    dna: {
      archetype: inferArchetype(industry, tone),
      persuasionStyle: tone === 'bold' ? 'assertive' : 'evidence-led',
      emotionalEnergy: tone === 'friendly' ? 'warm' : tone === 'bold' ? 'high-energy' : 'steady',
      brandPromise: valueProposition,
      coreValues: inferCoreValues(description),
      extractedAt: now,
    },
  };

  writeBrandProfile(nextProfile);
  return nextProfile;
}

export function documentUrls(profile: BrandProfileRecord) {
  return Object.fromEntries(
    Object.entries(profile.documents).map(([key, content]) => [
      key,
      `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`,
    ]),
  ) as Record<keyof BrandDocumentSet, string>;
}

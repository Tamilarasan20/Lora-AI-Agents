import fs from 'fs';
import path from 'path';
import type { BrandDocumentSet, BrandProfileRecord } from '@/lib/brand-types';

const storePath = path.join(process.cwd(), '.brand-local-db.json');
const SCRAPE_TIMEOUT_MS = 8_000;
const MAX_INTERNAL_PAGES = 4;
const MAX_REFERENCE_IMAGES = 18;

function nowIso() {
  return new Date().toISOString();
}

function normalizeUrl(raw: string) {
  const value = raw.trim();
  return value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
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
    referenceImages: [],
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
      referenceImages: parsed.referenceImages ?? [],
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
    referenceImages: updates.referenceImages ?? current.referenceImages,
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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMetaContent(html: string, selector: 'description' | 'og:description' | 'og:site_name' | 'theme-color') {
  const patterns: Record<typeof selector, RegExp[]> = {
    description: [/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i],
    'og:description': [/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i],
    'og:site_name': [/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i],
    'theme-color': [/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i],
  };

  for (const pattern of patterns[selector]) {
    const value = pickFirstMatch(html, pattern);
    if (value) return value;
  }
  return '';
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
  const themeColor = extractMetaContent(html, 'theme-color');
  const cssVar = pickFirstMatch(html, /--(?:primary|brand|accent)[^:]*:\s*([^;"]+)/i);
  const primary = themeColor || cssVar || '#2563eb';
  return {
    primary,
    secondary: primary === '#2563eb' ? ['#0f172a', '#e2e8f0'] : ['#0f172a', '#f8fafc'],
    accent: '#14b8a6',
  };
}

function isUsefulImage(src: string) {
  if (!src || src.length < 10) return false;
  if (/\s+\d+(\.\d+)?[wx]/.test(src)) return false;
  if (/,\s*https?:\/\//.test(src)) return false;
  if (src.includes(' ')) return false;

  const lower = src.toLowerCase();
  const hardReject = [
    'pixel', 'track', 'analytics', 'beacon', '1x1', 'spacer',
    'facebook.com/tr', 'google-analytics', 'doubleclick', 'googletagmanager',
    'hotjar', 'data:image/gif', 'data:image/svg+xml', 'gravatar', 'wp-emoji',
    'spinner', 'loading.gif', 'captcha', 'cloudflare',
  ];
  if (hardReject.some((entry) => lower.includes(entry))) return false;

  const placeholders = [
    'placeholder.com', 'via.placeholder.com', 'placeimg.com', 'placekitten.com',
    'dummyimage.com', 'loremflickr.com', 'lorempixel.com', 'picsum.photos',
  ];
  if (placeholders.some((entry) => lower.includes(entry))) return false;

  if (lower.endsWith('.ico')) return false;
  if (/\/(favicon|sprite)\b/i.test(lower)) return false;
  if (/\/(icon|arrow|chevron|check|star|dot|close|menu|hamburger|button|btn)\//i.test(lower)) return false;

  const dimMatch = src.match(/[_\-x](\d+)x(\d+)/i);
  if (dimMatch) {
    const width = Number(dimMatch[1]);
    const height = Number(dimMatch[2]);
    if (width < 50 && height < 50) return false;
  }

  const widthQuery = src.match(/[?&](?:w|width)=(\d+)/i);
  if (widthQuery && Number(widthQuery[1]) < 50) return false;

  return /\.(jpg|jpeg|png|webp|avif|gif|svg)(\?|$)/i.test(lower) || lower.startsWith('http');
}

function normalizeImageUrl(src: string) {
  try {
    const url = new URL(src);
    ['w', 'h', 'width', 'height', 'size', 'q', 'quality', 'fit', 'resize', 'scale', 'format', 'auto', 'fm', 'crop', 'dpr'].forEach((param) => {
      url.searchParams.delete(param);
    });
    url.pathname = url.pathname
      .replace(/-\d+x\d+(\.[a-zA-Z]+)$/, '$1')
      .replace(/_\d+x\d+(\.[a-zA-Z]+)$/, '$1')
      .replace(/@[0-9.]+x(\.[a-zA-Z]+)$/, '$1')
      .replace(/-(scaled|large|medium|small|thumbnail|full|crop|original)(\.[a-zA-Z]+)$/, '$2')
      .replace(/\/(w_\d+|h_\d+|c_\w+|f_\w+|q_\w+|ar_\w+),?/g, '/')
      .replace(/\/\/+/g, '/');
    return `${url.origin}${url.pathname}`;
  } catch {
    return src;
  }
}

function scoreImage(url: string) {
  const lower = url.toLowerCase();
  let score = 0;

  const dimMatch = url.match(/[_\-](\d{3,4})x(\d{3,4})/i);
  if (dimMatch) {
    const width = Number(dimMatch[1]);
    const height = Number(dimMatch[2]);
    if (width >= 1600 || height >= 1600) score += 40;
    else if (width >= 1200 || height >= 1200) score += 30;
    else if (width >= 800 || height >= 800) score += 20;
    else if (width >= 400 || height >= 400) score += 8;
    else score -= 15;
  }

  const widthQuery = url.match(/[?&](?:w|width|imwidth|imageWidth)=(\d+)/i);
  if (widthQuery) {
    const width = Number(widthQuery[1]);
    if (width >= 1600) score += 35;
    else if (width >= 1200) score += 25;
    else if (width >= 800) score += 15;
    else if (width >= 400) score += 5;
    else if (width < 200) score -= 25;
  }

  if (/\.(webp|avif)(\?|$)/i.test(url)) score += 5;
  if (/\/(product|hero|banner|feature|gallery|portfolio|campaign|lifestyle|collection|look|editorial|showcase|flagship)/i.test(lower)) score += 20;
  if (/\/(about|brand|identity|team|story|culture|history)/i.test(lower)) score += 12;
  if (/\/(images?|img|media|photos?|assets?|uploads?|static|content)\//i.test(lower)) score += 5;
  if (/zoom|retina|highres|fullsize|full[_\-]?size|hi[_\-]?res|@2x|@3x|original/i.test(lower)) score += 18;
  if (/og[_\-]?image|social[_\-]?share|opengraph/i.test(lower)) score += 25;
  if (/thumbnail|thumb|\bsmall\b|\bmini\b|[_\-]sm[_\-]|[_\-]xs[_\-]|\bpreview\b/i.test(lower)) score -= 25;
  if (/[_\-](50|75|80|100|120|150)x/i.test(url)) score -= 20;
  if (/icon|sprite|arrow|check|star|dot|close|menu|placeholder/i.test(lower)) score -= 30;

  return score;
}

function extractAttrValues(tag: string, attrs: string[]) {
  return attrs
    .map((attr) => {
      const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
      return match?.[1] ?? '';
    })
    .filter(Boolean);
}

function addImageCandidate(results: Set<string>, candidate: string, baseUrl: string) {
  if (!candidate) return;
  const decodedCandidate = decodeHtmlEntities(candidate);
  const entries = decodedCandidate.includes(',') && /\s+\d+(\.\d+)?[wx]/.test(decodedCandidate)
    ? decodedCandidate.split(',').map((entry) => entry.trim().split(/\s+/)[0] ?? '')
    : [decodedCandidate];

  for (const entry of entries) {
    const absolute = toAbsoluteUrl(baseUrl, entry);
    if (!absolute || !isUsefulImage(absolute)) continue;
    results.add(absolute);
  }
}

function parseJsonLdImages(html: string, baseUrl: string) {
  const results = new Set<string>();
  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (typeof nested === 'string' && ['image', 'url', 'contentUrl', 'thumbnailUrl', 'photo', 'logo'].includes(key)) {
        addImageCandidate(results, nested, baseUrl);
      } else if (nested && typeof nested === 'object') {
        walk(nested);
      }
    }
  };

  for (const match of scriptMatches) {
    try {
      walk(JSON.parse(match[1]));
    } catch {
      continue;
    }
  }

  return Array.from(results);
}

function collectImagesFromHtml(html: string, baseUrl: string) {
  const results = new Set<string>();

  for (const pattern of [
    /<meta[^>]+property=["']og:image(?::(?:secure_url|url))?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/gi,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi,
    /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+)["']/gi,
    /<video[^>]+poster=["']([^"']+)["']/gi,
    /<a[^>]+href=["']([^"']+\.(?:png|jpe?g|webp|avif|gif|svg)(?:\?[^"']*)?)["']/gi,
    /url\(["']?(https?:\/\/[^"')]+)["']?\)/gi,
  ]) {
    for (const match of html.matchAll(pattern)) {
      addImageCandidate(results, match[1] ?? '', baseUrl);
    }
  }

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    for (const value of extractAttrValues(tag, [
      'src', 'data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-image', 'data-bg',
      'data-full', 'data-hi-res', 'loading-src', 'data-src-lg', 'data-src-large', 'data-lazy-load',
      'data-url', 'data-img-src', 'data-imgurl', 'data-thumb', 'data-large-file', 'data-orig-file',
      'data-medium-file', 'data-full-url', 'data-natural-src', 'data-zoom-src', 'data-big',
      'data-highres', 'data-retina', 'data-normal', 'data-2x', 'data-hi', 'data-full-size',
      'srcset', 'data-srcset',
    ])) {
      addImageCandidate(results, value, baseUrl);
    }
  }

  for (const tag of html.match(/<source\b[^>]*>/gi) ?? []) {
    for (const value of extractAttrValues(tag, ['srcset', 'data-srcset'])) {
      addImageCandidate(results, value, baseUrl);
    }
  }

  for (const styleMatch of html.matchAll(/style=["'][^"']*url\(([^)]+)\)[^"']*["']/gi)) {
    addImageCandidate(results, styleMatch[1]?.replace(/["']/g, '') ?? '', baseUrl);
  }

  for (const noscript of html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/gi)) {
    const content = noscript[1] ?? '';
    for (const match of content.matchAll(/(?:src|data-src|data-lazy-src|srcset)=["']([^"']+)["']/gi)) {
      addImageCandidate(results, match[1] ?? '', baseUrl);
    }
  }

  for (const image of parseJsonLdImages(html, baseUrl)) {
    results.add(image);
  }

  return Array.from(results);
}

function extractLogoUrl(html: string, baseUrl: string) {
  const candidates = [
    pickFirstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    pickFirstMatch(html, /<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/i),
    pickFirstMatch(html, /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i),
    pickFirstMatch(html, /<img[^>]*(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i),
    pickFirstMatch(html, /<img[^>]*src=["']([^"']*logo[^"']*)["']/i),
  ];

  for (const candidate of candidates) {
    const absolute = toAbsoluteUrl(baseUrl, candidate);
    if (absolute) return absolute;
  }

  try {
    const hostname = new URL(baseUrl).hostname.replace(/^www\./, '');
    return `https://logo.clearbit.com/${hostname}`;
  } catch {
    return '';
  }
}

function extractInternalLinks(html: string, pageUrl: string) {
  const results = new Set<string>();
  const origin = new URL(pageUrl).origin;
  const skipPatterns = ['login', 'signin', 'signup', 'register', 'cart', 'checkout', 'account', 'privacy', 'terms', 'cookie', 'legal', 'mailto:', 'tel:', 'javascript:', '#'];

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const href = match[1]?.trim();
    if (!href) continue;
    const absolute = toAbsoluteUrl(pageUrl, href);
    if (!absolute || !absolute.startsWith(origin)) continue;
    if (skipPatterns.some((pattern) => absolute.toLowerCase().includes(pattern))) continue;
    results.add(absolute);
    if (results.size >= 12) break;
  }

  return Array.from(results);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; LoraloopLocalBrandBot/2.0)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function scrapePage(url: string) {
  try {
    const html = await fetchText(url);
    return {
      url,
      html,
      title: cleanText(pickFirstMatch(html, /<title>([^<]+)<\/title>/i)),
      description: cleanText(extractMetaContent(html, 'description') || extractMetaContent(html, 'og:description')),
      siteName: cleanText(extractMetaContent(html, 'og:site_name')),
      logoUrl: extractLogoUrl(html, url),
      images: collectImagesFromHtml(html, url),
      internalLinks: extractInternalLinks(html, url),
    };
  } catch {
    return {
      url,
      html: '',
      title: '',
      description: '',
      siteName: '',
      logoUrl: '',
      images: [] as string[],
      internalLinks: [] as string[],
    };
  }
}

async function scrapeEcommerceApis(origin: string) {
  const images: string[] = [];
  const headers = { 'user-agent': 'Mozilla/5.0 (compatible; LoraloopLocalBrandBot/2.0)' };

  const pushImage = (value?: string | null) => {
    if (!value || !isUsefulImage(value)) return;
    images.push(value);
  };

  try {
    const response = await fetch(`${origin}/products.json?limit=100`, { headers, signal: AbortSignal.timeout(5_000) });
    if (response.ok) {
      const data = await response.json();
      for (const product of (data.products ?? []).slice(0, 60)) {
        for (const image of product.images ?? []) pushImage(image.src);
        for (const variant of product.variants ?? []) pushImage(variant.featured_image?.src);
      }
    }
  } catch {}

  try {
    const response = await fetch(`${origin}/wp-json/wp/v2/media?per_page=60&media_type=image&_fields=source_url,media_details`, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) {
      const media = await response.json();
      for (const item of media ?? []) {
        pushImage(item.source_url);
        for (const size of Object.values(item.media_details?.sizes ?? {}) as Array<{ source_url?: string }>) {
          pushImage(size.source_url);
        }
      }
    }
  } catch {}

  return images;
}

function finalizeReferenceImages(logoUrl: string, images: string[]) {
  const scored = new Map<string, { url: string; score: number }>();

  for (const image of images) {
    const normalized = normalizeImageUrl(image);
    if (!isUsefulImage(image)) continue;
    if (logoUrl && normalizeImageUrl(logoUrl) === normalized) continue;

    const score = scoreImage(image);
    const existing = scored.get(normalized);
    if (!existing || existing.score < score) {
      scored.set(normalized, { url: image, score });
    }
  }

  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_REFERENCE_IMAGES)
    .map((entry) => entry.url);
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
  logoUrl?: string;
  referenceImages: string[];
  pagesScraped: string[];
}) {
  const referenceImageLines = profile.referenceImages.length
    ? profile.referenceImages.map((image, index) => `${index + 1}. ${image}`).join('\n')
    : 'No reusable brand images were captured.';

  return {
    business_profile: `# Business Profile\n\n## Brand\n- Name: ${profile.brandName}\n- Website: ${profile.websiteUrl}\n- Industry: ${profile.industry}\n\n## Offer\n${profile.productDescription}\n\n## Value Proposition\n${profile.valueProposition}\n\n## Audience\n${profile.targetAudience}\n`,
    market_research: `# Market Research\n\n## Category\n${profile.industry}\n\n## Audience Signals\n${profile.targetAudience}\n\n## Observed Positioning\n${profile.valueProposition}\n`,
    social_strategy: `# Social Strategy\n\n## Tone\n${profile.tone}\n\n## Voice Traits\n${profile.voiceCharacteristics.join(', ')}\n\n## Content Pillars\n${profile.contentPillars.map((pillar) => `- ${pillar}`).join('\n')}\n`,
    brand_guidelines: `# Brand Guidelines\n\n## Tone of Voice\n${profile.tone}\n\n## Voice Characteristics\n${profile.voiceCharacteristics.map((item) => `- ${item}`).join('\n')}\n\n## Colors\n- Primary: ${profile.brandColors.primary ?? 'N/A'}\n- Secondary: ${profile.brandColors.secondary.join(', ') || 'N/A'}\n- Accent: ${profile.brandColors.accent ?? 'N/A'}\n\n## Logo\n${profile.logoUrl || 'No logo detected'}\n`,
    visual_intelligence: `# Visual Intelligence\n\n## Primary Color\n${profile.brandColors.primary ?? 'N/A'}\n\n## Accent Color\n${profile.brandColors.accent ?? 'N/A'}\n\n## Pages Scraped\n${profile.pagesScraped.map((page) => `- ${page}`).join('\n') || '- No pages scraped'}\n\n## Logo\n${profile.logoUrl || 'No logo detected'}\n\n## Reference Images\n${referenceImageLines}\n\n## Suggested Visual Direction\nClean, modern, and consistent with the site’s current brand presentation.\n`,
  };
}

export async function analyzeWebsite(websiteUrl: string) {
  const normalizedUrl = normalizeUrl(websiteUrl);
  const current = readBrandProfile();
  const homepage = await scrapePage(normalizedUrl);

  const queuedPages = homepage.internalLinks
    .filter((link) => link !== normalizedUrl)
    .slice(0, MAX_INTERNAL_PAGES);

  const additionalPages = await Promise.all(queuedPages.map((link) => scrapePage(link)));
  const pages = [homepage, ...additionalPages.filter((page) => page.html)];

  const pageTitles = pages.map((page) => page.title).filter(Boolean);
  const pageDescriptions = pages.map((page) => page.description).filter(Boolean);
  const combinedDescription = cleanText(pageDescriptions.join(' '));
  const primaryHtml = homepage.html || pages[0]?.html || '';
  const siteName = homepage.siteName;
  const host = new URL(normalizedUrl).hostname.replace(/^www\./, '');
  const brandName = siteName || pageTitles[0]?.split('|')[0]?.split('-')[0]?.trim() || host;
  const industry = inferIndustry(combinedDescription, pageTitles.join(' '));
  const tone = inferTone(combinedDescription);
  const voiceCharacteristics = inferVoiceCharacteristics(tone, combinedDescription);
  const contentPillars = inferContentPillars(industry, combinedDescription);
  const brandColors = pickBrandColors(primaryHtml);
  const valueProposition = combinedDescription || `Helping customers through ${industry.toLowerCase()} solutions.`;
  const productDescription = combinedDescription || `${brandName} offers services and products related to ${industry.toLowerCase()}.`;
  const targetAudience = `Prospects looking for ${industry.toLowerCase()} solutions from ${brandName}.`;

  const ecommerceImages = await scrapeEcommerceApis(new URL(normalizedUrl).origin);
  const allImages = pages.flatMap((page) => page.images).concat(ecommerceImages);
  const logoUrl = homepage.logoUrl || pages.map((page) => page.logoUrl).find(Boolean) || '';
  const referenceImages = finalizeReferenceImages(logoUrl, allImages);
  const scrapedPages = Array.from(new Set(pages.map((page) => page.url).filter(Boolean)));
  const now = nowIso();

  const nextProfile: BrandProfileRecord = {
    ...current,
    brandName,
    industry,
    websiteUrl: normalizedUrl,
    targetAudience,
    tone,
    voiceCharacteristics,
    brandColors,
    logoUrl,
    referenceImages,
    productDescription,
    valueProposition,
    contentPillars,
    pagesScraped: scrapedPages,
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
      logoUrl,
      referenceImages,
      pagesScraped: scrapedPages,
    }),
    validationHistory: [
      {
        id: crypto.randomUUID(),
        validatedAt: now,
        overallScore: referenceImages.length >= 6 ? 0.9 : referenceImages.length >= 3 ? 0.82 : 0.74,
        pagesScraped: scrapedPages.length,
        imagesFound: referenceImages.length + (logoUrl ? 1 : 0),
      },
      ...current.validationHistory,
    ].slice(0, 10),
    memory: [
      {
        id: crypto.randomUUID(),
        detectedAt: now,
        changeType: 'website_analysis',
        field: 'websiteUrl',
        previousValue: current.websiteUrl || null,
        currentValue: normalizedUrl,
      },
      {
        id: crypto.randomUUID(),
        detectedAt: now,
        changeType: 'image_scrape',
        field: 'referenceImages',
        previousValue: current.referenceImages?.length ? `${current.referenceImages.length} images` : null,
        currentValue: `${referenceImages.length} images`,
      },
      ...current.memory,
    ].slice(0, 20),
    dna: {
      archetype: inferArchetype(industry, tone),
      persuasionStyle: tone === 'bold' ? 'assertive' : 'evidence-led',
      emotionalEnergy: tone === 'friendly' ? 'warm' : tone === 'bold' ? 'high-energy' : 'steady',
      brandPromise: valueProposition,
      coreValues: inferCoreValues(combinedDescription),
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

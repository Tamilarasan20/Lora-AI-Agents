export interface CompetitorRecord {
  id: string;
  platform: string;
  handle: string;
  addedAt: string;
}

export interface BrandDocumentSet {
  business_profile: string;
  market_research: string;
  social_strategy: string;
  brand_guidelines: string;
  visual_intelligence: string;
}

export interface BrandValidationRecord {
  id: string;
  validatedAt: string;
  overallScore: number;
  pagesScraped: number;
  imagesFound: number;
}

export interface BrandMemoryRecord {
  id: string;
  detectedAt: string;
  changeType: string;
  field: string;
  previousValue: string | null;
  currentValue: string | null;
}

export interface BrandDnaRecord {
  archetype?: string;
  persuasionStyle?: string;
  emotionalEnergy?: string;
  brandPromise?: string;
  coreValues: string[];
  extractedAt?: string;
}

export interface BrandProfileRecord {
  brandName: string;
  industry: string;
  websiteUrl: string;
  targetAudience: string;
  founderStory?: string | null;
  products?: string[];
  keySellingPoints?: string[];
  retailPresence?: string[];
  marketingGoals?: string[];
  seoKeywords?: string[];
  tone: string;
  voiceCharacteristics: string[];
  prohibitedWords: string[];
  preferredHashtags: string[];
  brandColors: {
    primary?: string;
    secondary: string[];
    accent?: string;
  };
  competitors: CompetitorRecord[];
  logoUrl?: string;
  referenceImages?: string[];
  productDescription: string;
  valueProposition: string;
  contentPillars: string[];
  autoReplyEnabled: boolean;
  sentimentThreshold: number;
  pagesScraped: string[];
  lastValidatedAt?: string;
  createdAt: string;
  updatedAt: string;
  documents: BrandDocumentSet;
  validationHistory: BrandValidationRecord[];
  memory: BrandMemoryRecord[];
  dna: BrandDnaRecord;
}

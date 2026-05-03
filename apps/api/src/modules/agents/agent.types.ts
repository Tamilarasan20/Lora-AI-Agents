export type AgentName = 'Lora' | 'Sam' | 'Clara' | 'Steve' | 'Sarah';

export type MarketingGoalType =
  | 'brand_awareness'
  | 'sales_growth'
  | 'lead_generation'
  | 'product_launch'
  | 'social_growth'
  | 'content_marketing'
  | 'email_marketing'
  | 'community_engagement'
  | 'market_research'
  | 'competitor_analysis'
  | 'campaign_planning'
  | 'content_calendar'
  | 'visual_content'
  | 'brand_positioning';

export const PHASE_1_AGENT_CREDIT_COSTS: Record<string, number> = {
  loraQuickPlan: 1,
  loraFullStrategy: 5,
  loraTaskBreakdown: 2,
  samTrendResearch: 4,
  claraContentGeneration: 3,
  steveVisualConcept: 3,
  sarahSchedulePlan: 2,
  loraReview: 1,
};

export function assignAgent(taskDescription: string): AgentName {
  const text = taskDescription.toLowerCase();

  if (
    text.includes('trend') ||
    text.includes('competitor') ||
    text.includes('market') ||
    text.includes('research') ||
    text.includes('industry') ||
    text.includes('opportunity') ||
    text.includes('audience behavior')
  ) return 'Sam';

  if (
    text.includes('caption') ||
    text.includes('copy') ||
    text.includes('email') ||
    text.includes('newsletter') ||
    text.includes('blog') ||
    text.includes('thread') ||
    text.includes('hook') ||
    text.includes('cta') ||
    text.includes('script') ||
    text.includes('product description')
  ) return 'Clara';

  if (
    text.includes('visual') ||
    text.includes('carousel') ||
    text.includes('carousel image') ||
    text.includes('design') ||
    text.includes('image') ||
    text.includes('generate image') ||
    text.includes('creative') ||
    text.includes('ad creative') ||
    text.includes('product visual') ||
    text.includes('post graphic') ||
    text.includes('layout') ||
    text.includes('thumbnail')
  ) return 'Steve';

  if (
    text.includes('schedule') ||
    text.includes('publish') ||
    text.includes('calendar') ||
    text.includes('posting') ||
    text.includes('engagement') ||
    text.includes('reply') ||
    text.includes('comments') ||
    text.includes('dm')
  ) return 'Sarah';

  return 'Lora';
}

export function classifyGoal(goal: string): MarketingGoalType {
  const text = goal.toLowerCase();
  if (text.includes('sales') || text.includes('revenue') || text.includes('convert')) return 'sales_growth';
  if (text.includes('launch') || text.includes('new product')) return 'product_launch';
  if (text.includes('lead') || text.includes('generate')) return 'lead_generation';
  if (text.includes('brand awareness') || text.includes('visibility')) return 'brand_awareness';
  if (text.includes('social') || text.includes('followers') || text.includes('grow')) return 'social_growth';
  if (text.includes('email')) return 'email_marketing';
  if (text.includes('community') || text.includes('engagement')) return 'community_engagement';
  if (text.includes('competitor') || text.includes('research')) return 'competitor_analysis';
  if (text.includes('content calendar') || text.includes('content plan')) return 'content_calendar';
  if (text.includes('visual') || text.includes('carousel')) return 'visual_content';
  if (text.includes('position') || text.includes('brand strategy')) return 'brand_positioning';
  if (text.includes('campaign')) return 'campaign_planning';
  if (text.includes('market') || text.includes('trend')) return 'market_research';
  return 'content_marketing';
}

// Agent output interfaces

export interface LoraStrategyOutput {
  strategySummary: string;
  businessGoal: string;
  goalType: MarketingGoalType;
  targetAudience: string;
  brandVoiceDirection: string;
  positioning: string;
  recommendedChannels: string[];
  campaignIdeas: string[];
  contentPillars: string[];
  executionPlan: ExecutionWeek[];
  teamAssignments: TeamAssignment[];
  calendarItems: CalendarItemDraft[];
  approvalItems: string[];
  risks: string[];
  nextBestActions: string[];
}

export interface ExecutionWeek {
  week: number;
  focus: string;
  tasks: TaskDraft[];
}

export interface TaskDraft {
  title: string;
  assignedTo: AgentName;
  priority: 'high' | 'medium' | 'low';
  description?: string;
}

export interface TeamAssignment {
  agent: AgentName;
  responsibility: string;
}

export interface CalendarItemDraft {
  title: string;
  platform: string;
  contentType: string;
  assignedTo: AgentName;
  status: string;
  scheduledAt?: string;
}

export interface LoraReviewOutput {
  approved: boolean;
  brandFitScore: number;
  qualityScore: number;
  goalAlignmentScore: number;
  notes: string;
  requiredChanges: string[];
  nextStep: string;
}

export interface SamOutput {
  trendSummary: string;
  competitorInsights: string[];
  contentOpportunities: string[];
  recommendedAngles: string[];
  platformSuggestions: string[];
  risks: string[];
  nextActionsForLora: string[];
}

export interface ClaraOutput {
  contentType: string;
  platform: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  brandVoiceNotes: string;
  variants: string[];
}

export interface SteveOutput {
  creativeType: 'single_image' | 'carousel_images' | 'ad_creative' | 'product_visual' | 'campaign_visual';
  platform: string;
  visualConcept: string;
  carouselSlides: CarouselSlide[];
  imagePrompts: string[];
  generatedAssets: GeneratedAsset[];
  layoutDirection: string;
  brandStyleNotes: string;
  recommendedFormat: string;
  designChecklist: string[];
}

export interface CarouselSlide {
  slideNumber: number;
  slideGoal: string;
  headline: string;
  supportingText: string;
  imagePrompt: string;
  generatedImageUrl: string;
  designNotes: string;
}

export interface GeneratedAsset {
  assetType: 'image' | 'carousel_slide' | 'ad_image';
  assetUrl: string;
  platform: string;
  dimensions: string;
  status: 'draft' | 'approved' | 'rejected';
  promptUsed: string;
  brandStyleNotes: string;
}

export interface SarahOutput {
  calendarItems: CalendarItemDraft[];
  platformAdaptations: PlatformAdaptation[];
  postingSchedule: PostingSlot[];
  engagementReplies: EngagementReply[];
  publishingStatus: string;
  nextActions: string[];
}

export interface PlatformAdaptation {
  platform: string;
  adaptedContent: string;
  hashtags: string[];
  bestTime: string;
}

export interface PostingSlot {
  date: string;
  time: string;
  platform: string;
  contentTitle: string;
}

export interface EngagementReply {
  originalComment: string;
  suggestedReply: string;
  tone: string;
}

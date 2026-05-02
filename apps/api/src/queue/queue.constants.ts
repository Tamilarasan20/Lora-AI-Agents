export const QUEUE_NAMES = {
  PUBLISH_POST: 'publish-post',
  FETCH_ANALYTICS: 'fetch-analytics',
  PROCESS_ENGAGEMENT: 'process-engagement',
  AGENT_TASK: 'agent-task',
  MEDIA_PROCESS: 'media-process',
  REFRESH_TOKEN: 'refresh-token',
  SYNC_AUDIENCE_ANALYTICS: 'sync-audience-analytics',
  // AKE queues
  AKE_CRAWL: 'ake-crawl',
  AKE_EXTRACT: 'ake-extract',
  AKE_ENRICH: 'ake-enrich',
  AKE_VISUAL: 'ake-visual',
  AKE_CREATIVE: 'ake-creative',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  // publish-post queue
  PUBLISH_SCHEDULED_POST: 'publish-scheduled-post',
  // fetch-analytics queue
  FETCH_POST_ANALYTICS: 'fetch-post-analytics',
  FETCH_ACCOUNT_ANALYTICS: 'fetch-account-analytics',
  // process-engagement queue
  PROCESS_COMMENT: 'process-comment',
  PROCESS_MENTION: 'process-mention',
  PROCESS_DM: 'process-dm',
  // agent-task queue
  CLARA_GENERATE_CONTENT: 'clara-generate-content',
  CLARA_ADAPT_PLATFORM: 'clara-adapt-platform',
  SARAH_PROCESS_ENGAGEMENT: 'sarah-process-engagement',
  MARK_ANALYZE_TRENDS: 'mark-analyze-trends',
  MARK_GENERATE_REPORT: 'mark-generate-report',
  // media-process queue
  PROCESS_UPLOADED_MEDIA: 'process-uploaded-media',
  // refresh-token queue
  REFRESH_PLATFORM_TOKEN: 'refresh-platform-token',
  // sync-audience-analytics queue
  SYNC_PLATFORM_INSIGHTS: 'sync-platform-insights',
  // AKE job names
  AKE_CRAWL_PAGE: 'ake-crawl-page',
  AKE_EXTRACT_PAGE: 'ake-extract-page',
  AKE_ENRICH_PROJECT: 'ake-enrich-project',
  AKE_ANALYZE_IMAGE: 'ake-analyze-image',
  AKE_GENERATE_CREATIVE: 'ake-generate-creative',
} as const;

export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
};

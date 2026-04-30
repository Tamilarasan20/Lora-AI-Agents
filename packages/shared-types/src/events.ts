// Re-export all event types and topic constants from the API events module.
// This allows frontend and worker packages to import without depending on NestJS.

export type {
  BaseEvent,
  KafkaTopic,
  LoraEvent,
  ContentCreatedEvent,
  ContentUpdatedEvent,
  PostScheduledEvent,
  PostPublishedEvent,
  PostFailedEvent,
  AnalyticsUpdatedEvent,
  TrendDetectedEvent,
  EngagementReceivedEvent,
  EngagementRepliedEvent,
  ConnectionRefreshedEvent,
  ConnectionRevokedEvent,
  AgentTaskCreatedEvent,
  AgentTaskCompletedEvent,
  BrandKnowledgeUpdatedEvent,
  MediaProcessedEvent,
} from '../../../apps/api/src/events/event.types';

export { KAFKA_TOPICS } from '../../../apps/api/src/events/event.types';

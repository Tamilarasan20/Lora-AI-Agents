// Shared API response envelope types used by both the API and frontend.

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  path: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type Platform =
  | 'instagram'
  | 'twitter'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'pinterest'
  | 'wordpress';

export type AgentType = 'CLARA' | 'SARAH' | 'MARK';

export type ContentStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

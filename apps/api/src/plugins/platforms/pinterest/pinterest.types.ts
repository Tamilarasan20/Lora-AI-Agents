export interface PinterestTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  scope: string;
}

export interface PinterestUserResponse {
  username: string;
  id: string;
  profile_image: string;
  website_url?: string;
  follower_count: number;
  following_count: number;
  monthly_views: number;
}

export interface PinterestPinResponse {
  id: string;
  link?: string;
  title?: string;
  description?: string;
  board_id: string;
  created_at: string;
}

export interface PinterestBoardResponse {
  id: string;
  name: string;
  description?: string;
  privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET';
  pin_count: number;
  follower_count: number;
}

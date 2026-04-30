export interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id?: string;
}

export interface InstagramMediaContainerResponse {
  id: string;
}

export interface InstagramPublishResponse {
  id: string;
}

export interface InstagramUserMeResponse {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  account_type?: string;
}

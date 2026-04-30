export interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface TwitterUserMeResponse {
  data: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
  };
}

export interface TwitterCreateTweetResponse {
  data: { id: string; text: string };
}

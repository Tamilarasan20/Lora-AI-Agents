export interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  token_type: string;
}

export interface TikTokVideoUploadResponse {
  data: {
    publish_id: string;
    upload_url?: string;
  };
}

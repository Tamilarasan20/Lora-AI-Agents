export interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface FacebookUserResponse {
  id: string;
  name: string;
  email?: string;
  picture?: { data: { url: string } };
}

export interface FacebookPageResponse {
  id: string;
  name: string;
  access_token: string;
  category: string;
}

export interface FacebookPostResponse {
  id: string;
  post_id?: string;
}

export interface FacebookMediaUploadResponse {
  id: string;
  uri?: string;
}

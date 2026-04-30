export interface YouTubeTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export interface YouTubeChannelResponse {
  kind: string;
  etag: string;
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      customUrl?: string;
      thumbnails: { default: { url: string } };
    };
    statistics: {
      subscriberCount: string;
      videoCount: string;
      viewCount: string;
    };
  }[];
}

export interface YouTubeVideoInsertResponse {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
  };
  status: {
    uploadStatus: string;
    privacyStatus: string;
  };
}

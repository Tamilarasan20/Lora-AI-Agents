export interface WordPressAuthConfig {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressPostResponse {
  id: number;
  date: string;
  status: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  slug: string;
  author: number;
  categories: number[];
  tags: number[];
}

export interface WordPressMediaResponse {
  id: number;
  date: string;
  link: string;
  source_url: string;
  media_type: string;
  mime_type: string;
  title: { rendered: string };
}

export interface WordPressUserResponse {
  id: number;
  name: string;
  url: string;
  slug: string;
  avatar_urls: Record<string, string>;
}

export interface WordPressTagResponse {
  id: number;
  name: string;
  slug: string;
  count: number;
}

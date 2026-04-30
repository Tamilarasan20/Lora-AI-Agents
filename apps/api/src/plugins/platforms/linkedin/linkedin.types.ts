export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface LinkedInProfileResponse {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
  profilePicture?: { displayImage: string };
}

export interface LinkedInUgcPostResponse {
  id: string;
}

export interface AuthResponse {
  user: {
    id: any;
    email: string;
    name: string | null;
    phone: string | null;
    avatar: string | null;
    role: string;
    isEmailVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: any;
  email: string;
  role: string;
}

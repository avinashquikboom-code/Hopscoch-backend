export interface AuthResponse {
  user: {
    id: string;
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
  userId: string;
  email: string;
  role: string;
}

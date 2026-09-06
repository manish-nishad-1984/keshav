export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  isSuperAdmin: boolean;
  tv: number;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  fam: string;
  tv: number;
  iat?: number;
  exp?: number;
}

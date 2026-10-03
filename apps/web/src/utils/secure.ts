import { jwtDecode, type JwtPayload } from 'jwt-decode';

/** True when the JWT is malformed or its `exp` is in the past. */
export const isTokenExpired = (token: string): boolean => {
  try {
    const { exp } = jwtDecode<JwtPayload>(token);
    return !!exp && exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

/**
 * 인증 엔드포인트 wrapper.
 *
 * login/signup 은 공개 /api/auth/**(인터셉터가 Bearer skip).
 * fetchMe 는 보호 /api/users/me.
 */
import { api } from '@/api/client';
import type {
  IdResponse,
  LoginRequest,
  MyProfileResponse,
  SignupRequest,
  TokenResponse,
} from '@/api/types';

/** 로그인 → 토큰 쌍. 401 INVALID_CREDENTIALS 가능. */
export async function loginRequest(body: LoginRequest): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/api/auth/login', body);
  return data;
}

/** 회원가입 → 생성된 id. 409 DUPLICATE_EMAIL/NICKNAME, 400 INVALID_INPUT 가능. */
export async function signupRequest(body: SignupRequest): Promise<IdResponse> {
  const { data } = await api.post<IdResponse>('/api/auth/signup', body);
  return data;
}

/** 내 프로필(보호). 콜드스타트 부트스트랩에서 토큰 유효성 확인 겸용. */
export async function fetchMe(): Promise<MyProfileResponse> {
  const { data } = await api.get<MyProfileResponse>('/api/users/me');
  return data;
}

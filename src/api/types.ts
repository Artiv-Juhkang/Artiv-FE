/**
 * API DTO 타입 — 코드젠 schema.d.ts를 좁힌 ergonomic 별칭 + enum 문자열 유니온.
 *
 * 정본 이름은 *Response(코드젠 schema.d.ts). 여기 별칭(SeriesSummary 등)은 호출부 편의용.
 *
 * schema.d.ts 는 `npx openapi-typescript ... -o src/api/schema.d.ts` 로 생성된다.
 * 아직 생성되지 않았다면 아래 fallback 미러(SchemaComponents)가 컴파일을 막지 않게 한다 —
 * schema.d.ts 가 생기면 그 `components` 가 우선한다(동일 이름 import).
 */

// 코드젠 산출물. 생성 전이면 빌드 시 모듈 미존재 → 아래 ambient 선언으로 보강.
// schema.d.ts 가 존재하면 그 export 가 이 import 를 만족시킨다.
import type { components as GenComponents } from './schema';

// schema.d.ts 가 아직 없을 때를 대비한 최소 수기 미러.
// (codegen 으로 schema.d.ts 가 생성되면 import 가 그쪽을 가리키므로 이 미러는 무시됨)
export type components = GenComponents;

type Schemas = components['schemas'];

/* -------------------------------------------------------------------------- */
/*  Enum 문자열 유니온 (백엔드 enum 을 문자열 그대로)                              */
/* -------------------------------------------------------------------------- */

export type Role = 'READER' | 'CREATOR' | 'ADMIN';

export type ConsentType =
  | 'TERMS_OF_SERVICE'
  | 'PRIVACY_POLICY'
  | 'MARKETING_EMAIL'
  | 'ADULT_CONTENT_19';

export type AgeRating = 'ALL' | 'AGE_12' | 'AGE_15' | 'AGE_19';

export type SeriesStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS';

export type EpisodeStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED';

export type Genre =
  | 'ROMANCE'
  | 'FANTASY'
  | 'ACTION'
  | 'DRAMA'
  | 'DAILY'
  | 'COMEDY'
  | 'THRILLER'
  | 'SPORTS'
  | 'HORROR'
  | 'ETC';

export type SeriesSort = 'LATEST' | 'UPDATED' | 'ADULT_FIRST';

export type PostCategory = 'RECOMMEND' | 'FREE' | 'FANART' | 'QUESTION';

export type PostSort = 'LATEST' | 'BEST';

export type NotificationType =
  | 'EPISODE_PUBLISHED'
  | 'INQUIRY_ANSWERED'
  | 'POST_COMMENT'
  | 'COMMENT_REPLY'
  | 'FOLLOWED'
  | 'POST_MENTIONED';

export type NotificationTargetType =
  | 'SERIES'
  | 'EPISODE'
  | 'INQUIRY'
  | 'POST'
  | 'COMMENT'
  | 'USER';

export type ReleasePolicy = 'FREE_ALL' | 'WAIT_FREE';

export type InquiryType =
  | 'ACCOUNT'
  | 'PAYMENT'
  | 'CONTENT'
  | 'CREATOR'
  | 'BUG'
  | 'ETC';

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type LockReason = 'NONE' | 'WAIT';

/* -------------------------------------------------------------------------- */
/*  DTO 별칭 (ergonomic). 정본은 *Response 코드젠 이름.                          */
/* -------------------------------------------------------------------------- */

// 인증/계정
export type TokenResponse = Schemas['TokenResponse'];
export type SignupRequest = Schemas['SignupRequest'];
export type LoginRequest = Schemas['LoginRequest'];
export type RefreshRequest = Schemas['RefreshRequest'];
export type IdResponse = Schemas['IdResponse'];
export type MyProfileResponse = Schemas['MyProfileResponse'];

// 시리즈
export type SeriesSummary = Schemas['SeriesSummaryResponse'];
export type SeriesDetail = Schemas['SeriesDetailResponse'];
export type SeriesResponse = Schemas['SeriesResponse'];

// 에피소드
export type EpisodeDetail = Schemas['EpisodeDetailResponse'];
export type EpisodeSummary = Schemas['EpisodeSummaryResponse'];
export type EpisodeImage = Schemas['EpisodeImageResponse'];
export type EpisodeNoResponse = Schemas['EpisodeNoResponse'];

// 회차 댓글 (대댓글 replies 중첩 + likeCount/liked)
export type EpisodeComment = Schemas['CommentResponse'];

// 커뮤니티
export type PostResponse = Schemas['PostResponse'];
export type PostDetail = Schemas['PostDetailResponse'];
export type PostImage = Schemas['PostImageResponse'];

// 개인화 / 서재
export type SubscriptionResponse = Schemas['SubscriptionResponse'];
export type BookmarkResponse = Schemas['BookmarkResponse'];
export type ReadHistoryResponse = Schemas['ReadHistoryResponse'];

// 알림
export type NotificationResponse = Schemas['NotificationResponse'];
export type UnreadCountResponse = Schemas['UnreadCountResponse'];
export type UnreadSummaryResponse = Schemas['UnreadSummaryResponse'];

// 사용자 / 팔로우
export type UserResponse = Schemas['UserResponse'];
export type FollowStatsResponse = Schemas['FollowStatsResponse'];
export type FollowUserResponse = Schemas['FollowUserResponse'];

// 동의
export type ConsentResponse = Schemas['ConsentResponse'];

/**
 * SeriesActionBar — the series-level support row under the hero.
 * ------------------------------------------------------------------
 * 관심 = the ONLY series-level personalization the backend exposes
 * (POST/DELETE /api/series/{id}/subscription). It lives in the screen HEADER as
 * the heart toggle (BookmarkAction — frontend-screenlayout §8); 공유·더보기 are
 * header actions too. They are NOT duplicated here. The word "구독" is gone —
 * series interest is simply "관심" (작품 단위 관심 표시). Author-level following
 * (작가 소식) is a SEPARATE "팔로우" feature (POST /api/users/{id}/follow), not
 * this control.
 *
 * This row therefore carries only the FUTURE monetization seam:
 *   정기 후원 / 멤버십 — backend stage 0 has NO payment, so <SupportButton> opens a
 *   calm 준비 중 explainer sheet. Reader→author 후원(정기/단건) + 미리보기 유료회차
 *   결제는 결제 백엔드가 생기면 이 시드(sponsorship.ts)에 연결된다.
 */
import { SupportButton } from '@/features/series/components/SupportButton';

export type SeriesActionBarProps = {
  seriesId: number;
};

export function SeriesActionBar({ seriesId }: SeriesActionBarProps) {
  // Full-width 정기 후원 CTA. 관심/공유/더보기 are the header actions (no dup here).
  return <SupportButton seriesId={seriesId} variant="cta" />;
}

/**
 * My Page (내 정보) — profile summary + theme selection + logout.
 *
 * - Reads useAuth().user (MyProfileResponse) for the header. logout() clears
 *   the tokens + React Query cache and flips auth status to 'unauthenticated',
 *   so the root Stack.Protected guard redirects to (auth)/sign-in on its own —
 *   we NEVER hand-navigate (avoids the expo #30700 race), same rule as login.
 * - Surfaces the 시스템/라이트/다크 ThemeModeToggle built in the system framework,
 *   so this screen is also where the user controls light/dark.
 * - Logout is confirmed via a native Alert so a stray tap can't sign the user
 *   out. The Button itself is double-tap-safe (useAsyncPress), so the Alert can
 *   only open once per cooldown.
 */
import { useRouter, type Href } from 'expo-router';
import { Alert, Platform, Switch, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { setProfileVisibility } from '@/api/endpoints/users';
import { resolveImageUrl } from '@/api/image';
import type { Role } from '@/api/types';
import { useAuth, isCreator } from '@/features/auth';
import { ThemeModeToggle } from '@/features/settings/ThemeModeToggle';
import { Avatar, Button, Card, Divider, Screen, Text, useTheme, useToast } from '@/ui';

const ROLE_LABEL: Record<Role, string> = {
  READER: '독자',
  CREATOR: '작가',
  ADMIN: '관리자',
};

export default function MyPageScreen() {
  const t = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { user, role, logout, refreshUser } = useAuth();

  // 프로필 공개 토글(CH1) — 서버 반영 후 AuthContext 프로필 재조회로 스위치 상태 동기.
  const visibilityMut = useMutation<unknown, Error, boolean>({
    mutationFn: (next) => setProfileVisibility(next),
    onSuccess: () => void refreshUser(),
    onError: () => toast.show({ tone: 'danger', message: '설정 변경에 실패했어요. 잠시 후 다시 시도해 주세요.' }),
  });
  const profilePublic = user?.profilePublic !== false; // 하이드레이션 전엔 공개(디폴트)로 표시

  // user is set for any authenticated session (this tab lives under the (app)
  // protected group), but stay defensive in case the profile is still hydrating.
  const nickname = user?.nickname ?? '사용자';
  const email = user?.email;
  const roleLabel = role ? ROLE_LABEL[role] : null;

  const confirmLogout = () => {
    // react-native-web 에서 Alert.alert 은 no-op → 웹에선 window.confirm 으로 확인받는다.
    if (Platform.OS === 'web') {
      if (window.confirm('로그아웃하면 다시 로그인해야 해요. 로그아웃할까요?')) {
        void logout();
      }
      return;
    }
    Alert.alert('로그아웃', '로그아웃하면 다시 로그인해야 해요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        // logout() flips auth status → the protected stack redirects to sign-in.
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  return (
    // 내정보 ROOT 헤더: ambient(투명 밴드+헤어라인), back 없음. 헤더가 top inset을
    // 소유 → scroll content는 헤더 밴드 바로 아래에서 flush로 시작한다(body 미변경).
    <Screen scroll surface="ambient" header={{ variant: 'ambient', back: false, title: '내 정보' }}>
      <View style={{ gap: t.space.xl, paddingVertical: t.space.lg }}>
        {/* Profile header */}
        <Card padding="xl">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.lg }}>
            <Avatar uri={resolveImageUrl(user?.avatarUrl)} nickname={nickname} size="lg" />
            <View style={{ flex: 1, gap: t.space.xs }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.space.sm,
                  flexWrap: 'wrap',
                }}
              >
                <Text
                  variant="headline"
                  weight="semibold"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {nickname}
                </Text>
                {roleLabel ? (
                  <View
                    style={{
                      backgroundColor: t.color.accentSubtle,
                      borderRadius: t.radius.pill,
                      paddingHorizontal: t.space.sm,
                      paddingVertical: 2,
                    }}
                  >
                    <Text variant="micro" weight="semibold" style={{ color: t.color.accent }}>
                      {roleLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
              {email ? (
                <Text variant="caption" color="onSurfaceSecondary" numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Theme selection (system framework feature) */}
        <View style={{ gap: t.space.sm }}>
          <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
            화면 테마
          </Text>
          <ThemeModeToggle />
          <Text variant="caption" color="onSurfaceMuted">
            시스템 설정을 따르거나 라이트·다크를 직접 선택할 수 있어요.
          </Text>
        </View>

        <Divider />

        {/* 창작 — 작가는 스튜디오, 독자는 작가 전환 신청으로. */}
        <View style={{ gap: t.space.sm }}>
          <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
            창작
          </Text>
          {isCreator(role) ? (
            <Button
              label="작가 스튜디오"
              fullWidth
              onPress={() => router.push('/studio' as Href)}
            />
          ) : (
            <Button
              label="작가 되기"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/creator-request' as Href)}
            />
          )}
        </View>

        <Divider />

        {/* 고객센터 — 문의 목록/작성/상세 (M2). */}
        <View style={{ gap: t.space.sm }}>
          <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
            고객센터
          </Text>
          <Button
            label="문의 내역"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/inquiries' as Href)}
          />
          <Button
            label="자주 묻는 질문"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/faq' as Href)}
          />
        </View>

        <Divider />

        {/* Account */}
        <View style={{ gap: t.space.sm }}>
          <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
            계정
          </Text>
          {/* 프로필 공개 — 내장 햅틱이 있는 RN Switch(디폴트 공개, D-확3). */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: t.layout.minHitTarget,
            }}
          >
            <View style={{ flex: 1, paddingRight: t.space.md }}>
              <Text variant="body">프로필 공개</Text>
              <Text variant="caption" color="onSurfaceMuted">
                끄면 다른 사용자에게 소개와 가입일이 보이지 않아요.
              </Text>
            </View>
            <Switch
              value={profilePublic}
              disabled={visibilityMut.isPending}
              onValueChange={(next) => visibilityMut.mutate(next)}
              accessibilityLabel="프로필 공개"
            />
          </View>
          <Button
            label="차단 목록"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/blocked-users' as Href)}
          />
          <Button label="로그아웃" variant="secondary" fullWidth onPress={confirmLogout} />
          <Button
            label="회원 탈퇴"
            variant="ghost"
            fullWidth
            onPress={() => router.push('/withdraw' as Href)}
          />
        </View>
      </View>
    </Screen>
  );
}

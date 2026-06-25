/**
 * Avatar — user/author image. Renders ${BASE_URL}${image.url} via
 * expo-image (frontend-guide §3.4); falls back to the user's nickname
 * initial on a tinted ink chip when no avatar. expo-image handles
 * caching + the fade-in transition.
 */
import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from '../use-theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  /** Already-absolute URI (caller prefixes BASE_URL), or null for fallback. */
  uri?: string | null;
  nickname: string; // for fallback initial + a11y label
  size?: AvatarSize; // default 'md'
};

const DIM: Record<AvatarSize, number> = { sm: 28, md: 40, lg: 64 };

export function Avatar({ uri, nickname, size = 'md' }: AvatarProps) {
  const t = useTheme();
  const dim = DIM[size];
  const initial = nickname?.trim()?.[0]?.toUpperCase() ?? '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel={`${nickname} 프로필 이미지`}
        contentFit="cover"
        transition={t.motion.duration.base}
        style={{ width: dim, height: dim, borderRadius: t.radius.pill }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`${nickname} 프로필`}
      style={{
        width: dim,
        height: dim,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant={size === 'lg' ? 'headline' : 'label'} weight="bold" color="onSurfaceSecondary">
        {initial}
      </Text>
    </View>
  );
}

/**
 * (tabs) layout — WEB override. On the web the bottom tab bar is wrong: the
 * LeftRail (owned by WebShell one level up) is the primary nav. So this renders
 * a bare <Slot/> — the tab routes (창작물/커뮤니티/채팅/서재/내정보) mount as plain
 * children with no tab bar. The native (tabs)/_layout.tsx keeps its <Tabs>.
 */
import { Slot } from 'expo-router';

export default function TabsLayoutWeb() {
  return <Slot />;
}

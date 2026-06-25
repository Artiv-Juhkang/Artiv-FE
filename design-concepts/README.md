# AppToon — 로그인 디자인 컨셉 보관함

브라우저에서 `.html`을 열면 폰 목업으로 비교할 수 있습니다 (정지 이미지는 동명 `.png`).

| 파일 | 내용 |
|---|---|
| `login-concepts.html` | 1차 5종 (Panel Break · Night Reader · 두근/Vivid · **Glass Stack** · Screentone) — 단일 모드 |
| `login-concepts-v2.html` | 2차 8종 (1차 5종 + Impact 효과선 · Sketchbook 작가의 책상 · Monoline 미니멀) — 각 컨셉 **라이트/다크 한 쌍** |
| `naming-concepts.md` | 앱 이름(브랜드) 후보 17종 보관 — 잠정 채택 **Artiv**, 언제든 변경 가능 |

## ✅ 채택: 4 · Glass Stack  (2026-06-24)
흐르는 표지 아트 위에 떠 있는 프로스티드 글래스 폼. 보유한 `expo-glass-effect` + `expo-image`로 네이티브 직결. 표지(콘텐츠)가 주인공.
- accent = 인디고 (light `#3D5BFF` / dark `#9AA6FF`~`#6C7CFF`)
- primary CTA = 고대비 뉴트럴 (다크=흰색 / 라이트=잉크), accent-fill 아님
- 라이트/다크: 시스템 추종 + 사용자 수동 선택. accent는 두 모드에서 고정, 캔버스만 전환.
- 소셜 로그인(구글/카카오/애플)은 추후 — 로그인 UI 슬롯과 auth seam은 지금 설계.

이후 전체 디자인 시스템(`src/ui`)을 "Inkwell & Ember" → **Glass Stack**으로 전환. 설계는 `docs/frontend-system-framework.md` 참고.

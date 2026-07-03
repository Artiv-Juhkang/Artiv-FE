# 웹 배포 가이드 (Expo Web · 정적 export)

Artiv 앱은 그대로 정적 웹으로 export 된다(`app.json` → `web.output: "static"`). 별도 웹 프론트를 만들지 않고 같은 코드베이스를 브라우저에 올린다.

## 1. 로컬에서 보기

```bash
npm run web                              # 개발 서버(핫리로드) — 화면 확인용
# 또는 프로덕션 정적 빌드를 그대로 확인:
npm run build:web                        # dist/ 생성 (= expo export --platform web)
python -m http.server 8091 --directory dist   # http://localhost:8091
```

> 실기기가 아니라 브라우저이므로 `localhost` 그대로 붙는다. 백엔드는 아래 `EXPO_PUBLIC_API_URL` 참고.

## 2. 백엔드 주소 주입 (빌드 타임)

프론트는 `EXPO_PUBLIC_API_URL` 을 빌드 시점에 인라인한다(`src/api/config.ts`).

```bash
EXPO_PUBLIC_API_URL="https://api.example.com" npm run build:web
```

- 미설정 시 기본값 `http://localhost:8080`.
- **배포된 웹이 동작하려면 백엔드가 공개 URL 로 떠 있어야 한다**(로컬 8080 은 방문자 브라우저에서 접근 불가). CORS 는 그 웹 오리진을 허용해야 한다.
- `/files/**`(이미지) 도 같은 백엔드에서 공개 서빙되므로 함께 접근 가능해야 한다.

## 3. 정적 호스트에 올리기

산출물은 `dist/`. 아무 정적 호스트(Vercel · Netlify · S3+CloudFront · GitHub Pages 등)에 올린다.

**SPA rewrite 필수.** `/series/[id]/[episodeNo]` 같은 동적 라우트는 실제 파일이 없으므로, 매칭 안 되는 경로를 `index.html` 로 rewrite 해야 한다(그러지 않으면 새로고침/딥링크가 404).

- **Netlify** — `dist/_redirects` 에: `/*  /index.html  200`
- **Vercel** — `vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- **Nginx** — `try_files $uri $uri.html /index.html;`

## 4. 체크리스트

- [ ] `EXPO_PUBLIC_API_URL` 을 실제 백엔드 공개 URL 로 설정해 `npm run build:web`
- [ ] 백엔드가 공개 URL 로 떠 있고, 웹 오리진에 대해 CORS 허용
- [ ] 정적 호스트에 `dist/` 업로드 + SPA rewrite 규칙 설정
- [ ] 업로드가 큰 회차(수십 장)면 백엔드 멀티파트 상한 확인
      (`spring.servlet.multipart.max-file-size` / `max-request-size` — 기본값이 낮으면 상향)

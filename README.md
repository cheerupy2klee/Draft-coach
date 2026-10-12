# Draft Coach ✍️ — 스스로 고치는 영어 글쓰기 피드백

중3 "School Life in 30 Years" 쓰기 활동용. 학생이 초안을 쓰면 AI가 **완성본 없이**
① 잘한 점 ② 문법 힌트 ③ 내용 확장 질문으로 피드백하고, 학생은 고쳐서 최대 3번까지 다시 받습니다.

## 1. 내 컴퓨터에서 실행하기
1. [Node.js](https://nodejs.org) LTS 설치
2. 이 폴더를 VS Code로 열고 터미널에서:
   ```
   npm install
   ```
3. `.env.example`을 복사해 `.env.local` 파일을 만들고 **셋 중 하나**의 키 입력
   - Claude: `ANTHROPIC_API_KEY=sk-ant-...` (발급: https://console.anthropic.com, 크레딧 충전 필요)
   - ChatGPT: `OPENAI_API_KEY=sk-...` (발급: https://platform.openai.com/api-keys, 크레딧 충전 필요)
   - Gemini: `GEMINI_API_KEY=...` (발급: https://aistudio.google.com/apikey)
   - 여러 개 있으면 Claude → ChatGPT → Gemini 순으로 사용. 직접 고르려면 `AI_PROVIDER=claude` / `openai` / `gemini`
   - 키 없이 화면만 보고 싶으면 키 자리에 `demo`
4. `npm run dev` → 브라우저에서 http://localhost:3000

## 2. 학생에게 배포하기 (Vercel, 무료)
1. 이 폴더를 GitHub 저장소에 올리기
2. https://vercel.com 에서 GitHub로 로그인 → Add New Project → 저장소 선택
3. Environment Variables에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` 중 하나 입력 → Deploy
   (나중에 바꾸려면 Vercel → Settings → Environment Variables에서 수정 후 Redeploy)
4. 나온 주소를 구글 클래스룸에 공유

## 3. 고치고 싶을 때
| 바꾸고 싶은 것 | 파일 |
|---|---|
| 주제, 필수 요소, 핵심 구문, 피드백 횟수 | `lib/assignment.ts` |
| AI에게 주는 피드백 규칙(프롬프트) | `lib/prompt.ts` |
| 화면 구성 | `app/page.tsx` |
| 색·글꼴 | `app/globals.css` |
| "완성 문장 금지" 검사 | `lib/guard.ts` |
| Claude/ChatGPT/Gemini 호출, 모델 이름 | `lib/ai.ts` (또는 `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL` 환경변수) |

## 동작 방식
- 학번만 입력(이름 X). 글과 피드백은 **그 기기 브라우저에만** 자동 저장 → 같은 크롬북에서 이어서 작성 가능
- AI에는 학번 없이 글만 전송
- AI 응답은 JSON 형식으로 강제 → 카드로 표시
- 힌트에 학생 문장을 고쳐 쓴 문장이 섞이면 자동 재요청, 그래도 남으면 가림 처리
- 2차부터는 이전 초안과 비교해 "나아진 점"을 먼저 알려 줌
- 핵심 구문 4개는 쓰는 즉시 칩에 불이 켜짐

## 다음 단계(2단계) 아이디어
Supabase로 제출물 저장 + 교사 대시보드(학번별 초안→수정본 변화, 필수요소 충족 현황)

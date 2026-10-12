import type { Feedback } from "./assignment";

// AI가 "고쳐 쓴 완성 문장"을 몰래 넣었는지 검사합니다.
// 아이디어: 힌트 속 영어 구절(5단어 이상)이 학생 문장과 단어가 많이 겹치는데
// 학생 원문 그대로는 아니라면 → 고쳐 쓴 문장일 가능성이 높다.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => norm(s).split(" ").filter(Boolean);

function englishRuns(text: string): string[] {
  // 연속된 영어 단어 덩어리 추출 (한국어, 따옴표, 화살표 등에서 끊김)
  const runs = text.match(/[A-Za-z][A-Za-z' ,.-]*[A-Za-z.]/g) ?? [];
  return runs.map((r) => r.trim()).filter((r) => words(r).length >= 5);
}

function sentences(draft: string): string[] {
  return draft.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => words(s).length >= 4);
}

function looksLikeRewrite(run: string, draft: string): boolean {
  const r = words(run);
  const normDraft = norm(draft);
  if (normDraft.includes(r.join(" "))) return false; // 학생 원문을 인용한 것 → 괜찮음
  // 학생 문장 속 비슷한 길이의 구간과 비교 (절 하나만 고쳐 쓴 경우도 잡기 위해)
  for (const sent of sentences(draft)) {
    const s = words(sent);
    for (let len = r.length - 1; len <= r.length + 1; len++) {
      if (len < 4 || len > s.length) continue;
      for (let i = 0; i + len <= s.length; i++) {
        const win = new Set(s.slice(i, i + len));
        const overlap = r.filter((w) => win.has(w)).length / r.length;
        if (overlap >= 0.7) return true;
      }
    }
  }
  return false;
}

export function findLeaks(fb: Feedback, draft: string): string[] {
  const texts = [...fb.hints.map((h) => h.hint), ...fb.questions];
  const leaks: string[] = [];
  for (const t of texts) for (const run of englishRuns(t)) if (looksLikeRewrite(run, draft)) leaks.push(run);
  return leaks;
}

// 재요청 후에도 남아 있으면 해당 구절을 가립니다.
export function redact(fb: Feedback, leaks: string[]): Feedback {
  const hide = (t: string) => leaks.reduce((acc, l) => acc.split(l).join("(…스스로 고쳐 보세요…)"), t);
  return {
    ...fb,
    hints: fb.hints.map((h) => ({ ...h, hint: hide(h.hint) })),
    questions: fb.questions.map(hide),
  };
}

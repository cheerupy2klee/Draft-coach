import { NextResponse } from "next/server";
import { ASSIGNMENT, type Feedback } from "@/lib/assignment";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { callAI } from "@/lib/ai";
import { findLeaks, redact } from "@/lib/guard";

export const runtime = "nodejs";

async function getFeedback(userText: string, extraRule = ""): Promise<Feedback> {
  const out = await callAI(buildSystemPrompt() + extraRule, userText);
  return out === "DEMO" ? DEMO : out; // 키 자리에 demo를 넣으면 화면만 미리 보기
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const draft = String(body?.draft ?? "").trim();
    const previous = body?.previous;
    const round = Number(body?.round ?? 1);

    if (draft.length < ASSIGNMENT.minChars)
      return NextResponse.json({ error: `조금 더 써 볼까요? (최소 ${ASSIGNMENT.minChars}자)` }, { status: 400 });
    if (draft.length > ASSIGNMENT.maxChars)
      return NextResponse.json({ error: `글이 너무 길어요. (최대 ${ASSIGNMENT.maxChars}자)` }, { status: 400 });
    if (round > ASSIGNMENT.maxRounds)
      return NextResponse.json({ error: "피드백은 여기까지예요. 이제 스스로 최종안을 완성해 봐요!" }, { status: 400 });

    // 학번·이름은 AI에 보내지 않습니다. 글만 보냅니다.
    const userText = buildUserPrompt(draft, previous?.draft ? previous : undefined);

    let fb = await getFeedback(userText);
    let leaks = findLeaks(fb, draft);
    if (leaks.length) {
      fb = await getFeedback(
        userText,
        `\n\n[주의] 이전 응답에 학생 문장을 고쳐 쓴 완성 문장이 들어 있었습니다: ${leaks.map((l) => `"${l}"`).join(", ")}. 고쳐 쓴 문장 없이 규칙과 질문만으로 다시 작성하세요.`
      );
      leaks = findLeaks(fb, draft);
      if (leaks.length) fb = redact(fb, leaks);
    }
    return NextResponse.json({ feedback: fb });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const text =
      msg === "NO_KEY" ? "선생님: AI 키(ANTHROPIC / OPENAI / GEMINI)가 설정되지 않았어요."
      : msg === "NO_CREDIT" ? "선생님: AI 크레딧이 부족해요. 충전이 필요해요."
      : msg === "BUSY" ? "지금 사용하는 친구들이 많아요. 30초 뒤에 다시 눌러 주세요."
      : "피드백을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ error: text }, { status: 500 });
  }
}

// 데모용 고정 피드백 (GEMINI_API_KEY=demo 일 때만)
const DEMO: Feedback = {
  improvements: [],
  praise: [
    "'It is likely that~' 구문으로 미래를 예측하며 글을 시작한 점이 아주 좋아요!",
    "VR로 집에서 공부한다는 아이디어가 구체적이고 창의적이에요.",
  ],
  hints: [
    { quote: "won't have to going", hint: "'have to' 뒤에는 동사원형이 나와야 해요. going을 어떻게 바꿔야 할까요?" },
    { quote: "can sleeping", hint: "조동사 can 뒤의 동사 모양을 확인해 보세요. sleeping이 맞을까요?" },
  ],
  questions: [
    "학교에 가지 않으면 좋은 점을 썼네요! 그렇다면 친구를 직접 만나지 못해서 생길 수 있는 걱정(negative effect)은 무엇일까요?",
    "'wouldn't be able to~'를 써서 그 걱정을 한 문장으로 표현해 볼까요?",
  ],
  checklist: { changes: true, positive: true, negative: false, structures: ["It is likely that ~", "won't have to ~", "One positive effect would be that ~"] },
  cheer: "생각이 아주 좋아요! 힌트를 보며 내 글을 한 번 더 읽어 보면 훨씬 멋진 최종안이 될 거예요. 💪",
};

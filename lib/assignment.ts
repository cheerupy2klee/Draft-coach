// ✏️ 과제를 바꾸고 싶으면 이 파일만 고치면 됩니다.
export const ASSIGNMENT = {
  title: "School Life in 30 Years",
  titleKo: "30년 후의 학교생활",
  elements: [
    { key: "changes", label: "미래 학교생활의 변화", desc: "Location, Subjects, Field trips 등" },
    { key: "positive", label: "긍정적 영향", desc: "Positive effects" },
    { key: "negative", label: "부정적 영향 / 우려점", desc: "Negative effects" },
  ] as const,
  structures: [
    "It is likely that ~",
    "won't have to ~",
    "One positive effect would be that ~",
    "wouldn't be able to ~",
  ],
  maxRounds: 3, // 한 학생이 받을 수 있는 피드백 횟수
  minChars: 20,
  maxChars: 1500,
};

export type ElementKey = (typeof ASSIGNMENT.elements)[number]["key"];

export type Feedback = {
  improvements: string[];
  praise: string[];
  hints: { quote: string; hint: string }[];
  questions: string[];
  checklist: { changes: boolean; positive: boolean; negative: boolean; structures: string[] };
  cheer: string;
};

export type Round = { draft: string; feedback: Feedback; at: number };

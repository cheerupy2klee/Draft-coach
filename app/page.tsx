"use client";

import { useEffect, useMemo, useState } from "react";
import { ASSIGNMENT, type Feedback, type Round } from "@/lib/assignment";

type Saved = { draft: string; rounds: Round[]; done: boolean };
const EMPTY: Saved = { draft: "", rounds: [], done: false };

// 브라우저 저장 (실패해도 앱은 동작)
const load = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

// 핵심 구문 실시간 감지
const STRUCTURE_PATTERNS: RegExp[] = [
  /\bit\s+is\s+likely\s+that\b/i,
  /\b(won['’]?t|will\s+not)\s+have\s+to\b/i,
  /\bone\s+positive\s+effect\s+would\s+be\s+that\b/i,
  /\b(wouldn['’]?t|would\s+not)\s+be\s+able\s+to\b/i,
];

export default function Home() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [idInput, setIdInput] = useState("");
  const [state, setState] = useState<Saved>(EMPTY);
  const [view, setView] = useState(0); // 보고 있는 피드백 회차 (0-based)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // 처음 열 때 학번 불러오기
  useEffect(() => {
    const id = load<string | null>("draftcoach:id", null);
    if (id) {
      setStudentId(id);
      const s = load<Saved>(`draftcoach:${id}`, EMPTY);
      setState(s);
      setView(Math.max(0, s.rounds.length - 1));
    }
  }, []);

  // 자동 저장
  useEffect(() => {
    if (studentId) save(`draftcoach:${studentId}`, state);
  }, [state, studentId]);

  const usedStructures = useMemo(
    () => STRUCTURE_PATTERNS.map((p) => p.test(state.draft)),
    [state.draft]
  );

  function login() {
    const id = idInput.trim();
    if (!/^\d{4,6}$/.test(id)) {
      setError("학번 숫자 4~6자리를 입력해 주세요. (예: 30512)");
      return;
    }
    setError("");
    save("draftcoach:id", id);
    setStudentId(id);
    const s = load<Saved>(`draftcoach:${id}`, EMPTY);
    setState(s);
    setView(Math.max(0, s.rounds.length - 1));
  }

  function logout() {
    try {
      localStorage.removeItem("draftcoach:id");
    } catch {}
    setStudentId(null);
    setIdInput("");
    setState(EMPTY);
  }

  async function getFeedback() {
    setError("");
    setLoading(true);
    const prev = state.rounds[state.rounds.length - 1];
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: state.draft,
          round: state.rounds.length + 1,
          previous: prev ? { draft: prev.draft, feedback: prev.feedback } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류가 생겼어요.");
      const round: Round = { draft: state.draft, feedback: data.feedback as Feedback, at: Date.now() };
      setState((s) => ({ ...s, rounds: [...s.rounds, round] }));
      setView(state.rounds.length);
      setTimeout(() => document.getElementById("feedback")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 생겼어요.");
    } finally {
      setLoading(false);
    }
  }

  async function copyFinal() {
    try {
      await navigator.clipboard.writeText(state.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("복사가 안 됐어요. 글을 길게 눌러 직접 복사해 주세요.");
    }
  }

  // ───────── 로그인 화면 ─────────
  if (!studentId) {
    return (
      <main className="wrap narrow">
        <header className="brand">
          <span className="logo">✍️</span>
          <h1>Draft Coach</h1>
          <p className="sub">스스로 고치는 영어 글쓰기</p>
        </header>
        <section className="card">
          <label className="label" htmlFor="sid">학번을 입력하세요</label>
          <input
            id="sid"
            className="input"
            inputMode="numeric"
            placeholder="예: 30512"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn primary full" onClick={login}>시작하기</button>
          <p className="note">글은 이 기기에만 저장돼요. 이름은 입력하지 않아요.</p>
        </section>
      </main>
    );
  }

  const roundsLeft = ASSIGNMENT.maxRounds - state.rounds.length;
  const current = state.rounds[view];
  const unchanged = state.rounds.length > 0 && state.rounds[state.rounds.length - 1].draft === state.draft;

  // ───────── 메인 화면 ─────────
  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand-inline">
          <span className="logo sm">✍️</span>
          <strong>Draft Coach</strong>
        </div>
        <div className="who">
          <span>{studentId}</span>
          <button className="link" onClick={logout}>나가기</button>
        </div>
      </header>

      {/* 과제 안내 */}
      <section className="card task">
        <p className="eyebrow">오늘의 글쓰기</p>
        <h2>{ASSIGNMENT.title}</h2>
        <p className="muted">{ASSIGNMENT.titleKo}</p>
        <div className="grid2">
          <div>
            <p className="label">꼭 들어갈 내용</p>
            <ul className="checks">
              {ASSIGNMENT.elements.map((e) => {
                const ok = current?.feedback.checklist[e.key];
                return (
                  <li key={e.key} className={ok ? "ok" : ""}>
                    <span className="tick">{ok ? "✓" : "○"}</span>
                    {e.label} <span className="muted">· {e.desc}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="label">핵심 구문 (쓰면 불이 켜져요)</p>
            <div className="chips">
              {ASSIGNMENT.structures.map((s, i) => (
                <span key={s} className={`chip ${usedStructures[i] ? "on" : ""}`}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 글쓰기 */}
      <section className="card">
        <div className="row-between">
          <p className="label">{state.rounds.length === 0 ? "내 초안" : `수정본 ${state.rounds.length}`}</p>
          <span className={`count ${state.draft.length > ASSIGNMENT.maxChars ? "over" : ""}`}>
            {state.draft.length} / {ASSIGNMENT.maxChars}
          </span>
        </div>
        <textarea
          className="textarea"
          placeholder="In 30 years, it is likely that..."
          value={state.draft}
          disabled={state.done}
          onChange={(e) => setState((s) => ({ ...s, draft: e.target.value }))}
          spellCheck={false}
        />
        {error && <p className="error">{error}</p>}

        {!state.done && (
          <div className="actions">
            <button
              className="btn primary"
              onClick={getFeedback}
              disabled={loading || roundsLeft <= 0 || unchanged || state.draft.trim().length < ASSIGNMENT.minChars}
            >
              {loading ? "선생님이 읽는 중…" : state.rounds.length === 0 ? "피드백 받기" : "수정본으로 다시 피드백"}
            </button>
            <span className="muted small">
              {roundsLeft > 0 ? `남은 피드백 ${roundsLeft}번` : "피드백을 모두 사용했어요"}
              {unchanged && roundsLeft > 0 ? " · 글을 고친 뒤 다시 받을 수 있어요" : ""}
            </span>
            {state.rounds.length > 0 && (
              <button className="btn ghost" onClick={() => setState((s) => ({ ...s, done: true }))}>
                최종안 완성!
              </button>
            )}
          </div>
        )}

        {state.done && (
          <div className="done">
            <p>🎉 최종안을 완성했어요! 복사해서 클래스룸에 제출하세요.</p>
            <div className="actions">
              <button className="btn primary" onClick={copyFinal}>{copied ? "복사됨 ✓" : "최종안 복사"}</button>
              <button className="btn ghost" onClick={() => setState((s) => ({ ...s, done: false }))}>다시 고치기</button>
            </div>
          </div>
        )}
      </section>

      {/* 피드백 */}
      {current && (
        <section id="feedback" className="feedback">
          {state.rounds.length > 1 && (
            <div className="tabs">
              {state.rounds.map((_, i) => (
                <button key={i} className={`tab ${i === view ? "active" : ""}`} onClick={() => setView(i)}>
                  {i + 1}차 피드백
                </button>
              ))}
            </div>
          )}
          <FeedbackView round={current} />
        </section>
      )}
    </main>
  );
}

function Highlighted({ text, quotes }: { text: string; quotes: string[] }) {
  // 힌트가 가리키는 원문 부분에 형광펜 표시
  const parts: { t: string; mark: number }[] = [{ t: text, mark: -1 }];
  quotes.forEach((q, qi) => {
    if (!q) return;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.mark !== -1) continue;
      const idx = p.t.indexOf(q);
      if (idx === -1) continue;
      parts.splice(i, 1,
        { t: p.t.slice(0, idx), mark: -1 },
        { t: q, mark: qi },
        { t: p.t.slice(idx + q.length), mark: -1 });
      break;
    }
  });
  return (
    <p className="draft-view">
      {parts.map((p, i) =>
        p.mark === -1 ? <span key={i}>{p.t}</span> : <mark key={i}>{p.t}<sup>{p.mark + 1}</sup></mark>
      )}
    </p>
  );
}

function FeedbackView({ round }: { round: Round }) {
  const fb = round.feedback;
  return (
    <>
      <div className="card">
        <p className="label">이 피드백을 받은 글</p>
        <Highlighted text={round.draft} quotes={fb.hints.map((h) => h.quote)} />
      </div>

      {fb.improvements?.length > 0 && (
        <div className="card fb up">
          <h3>📈 지난번보다 나아진 점</h3>
          <ul>{fb.improvements.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      <div className="card fb praise">
        <h3>① 잘한 점</h3>
        <ul>{fb.praise.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>

      <div className="card fb hint">
        <h3>② 문법 및 표현 힌트</h3>
        {fb.hints.length === 0 ? (
          <p>큰 문법 오류가 없어요! 👏 내용을 더 풍부하게 만드는 데 집중해 볼까요?</p>
        ) : (
          <ol className="hints">
            {fb.hints.map((h, i) => (
              <li key={i}>
                <q className="quote">{h.quote}</q>
                <p>{h.hint}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="card fb question">
        <h3>③ 내용을 키우는 질문</h3>
        <ul>{fb.questions.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>

      <div className="cheer">💬 {fb.cheer}</div>
    </>
  );
}

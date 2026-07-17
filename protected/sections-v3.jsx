// ============================================================
// Section v3 — The Vibe Coder Mindset (10 disciplines)
// + 30-day learning track
// ============================================================

const MINDSET = [
  {
    n: "01",
    name: "Plan before you code",
    rule: "Spec-Driven Development. Decide WHAT, then ask for HOW.",
    do_: [
      "Write a 1-page PRD: problem, user, jobs, data model, metric",
      "Sketch the 3 main flows on paper or Excalidraw",
      "Define your data schema BEFORE any UI generation",
      "Plan MVP phases — don't try to build everything at once",
    ],
    dont: [
      "Open Lovable and prompt 'build me a CRM' on vibes alone",
      "Skip the data model — AI will invent one badly",
      "Cram 5 features into one prompt",
    ],
    quote: '"AI tools can help with planning. Use Claude to refine the idea, establish phases, and document everything in a doc you can refer back to."',
  },
  {
    n: "02",
    name: "Pick a popular tech stack",
    rule: "Boring tech wins. The AI knows Next.js + Supabase 1000× better than your novel framework.",
    do_: [
      "Next.js 15 + Supabase + Vercel — the 2026 vibe-coded default",
      "shadcn/ui + Tailwind for components — what v0 outputs natively",
      "Pick frameworks with rich training data (React > Solid; Postgres > SurrealDB)",
      "Use what every AI tool has built-in integrations for",
    ],
    dont: [
      "Pick an obscure stack to feel sophisticated — the AI will hallucinate APIs",
      "Use Flutter expecting parity with Expo for AI support",
      "Mix 4 unrelated services when one platform covers it",
    ],
    quote: '"A tool built for a senior engineer working on complex projects might not be the best fit for a student working on their first project."',
  },
  {
    n: "03",
    name: "Document standards in CLAUDE.md",
    rule: "A persistent context doc is the single biggest output-quality multiplier.",
    do_: [
      "Drop a CLAUDE.md at repo root with: stack, conventions, file structure, do's/don'ts",
      "Update it after every session — add the lessons the AI just learned",
      "Document style preferences: 'we use Drizzle, not Prisma. Server actions, not API routes.'",
      "Add a 'never do this' list — past bugs, anti-patterns, deprecated APIs",
    ],
    dont: [
      "Re-explain your conventions in every prompt",
      "Let the AI cargo-cult patterns from its training data",
      "Tolerate inconsistent code — review and fold the fix into CLAUDE.md",
    ],
    quote: '"If you don\'t catch bad habits early, the AI will reinforce them every iteration, and they\'ll compound fast."',
  },
  {
    n: "04",
    name: "One task at a time",
    rule: "AI does 1 thing well. It does 5 things poorly. Decompose.",
    do_: [
      "Make the prompt about ONE behavior change",
      "Use 'act as' framing: 'Act as a security auditor and review this auth flow'",
      "Tell the AI what NOT to touch explicitly",
      "Sub-tasks → sub-agents (Claude Code launches them automatically)",
    ],
    dont: [
      "'Fix the bug, refactor the styles, and add tests' — three prompts, not one",
      "Vague high-level prompts: 'make it better'",
      "Let the AI helpfully edit 8 unrelated files in one go",
    ],
    quote: '"Be specific about what you want, rather than high-level vague instructions."',
  },
  {
    n: "05",
    name: "Force refactor sessions",
    rule: "AI takes the path of least resistance. It appends. It never removes.",
    do_: [
      "Schedule a 'refactor day' every 1–2 weeks",
      "Ask: 'find dead code, duplicate logic, and files >300 lines. List them.'",
      "Break monoliths into modules — proactively, not reactively",
      "Re-run the audit prompts; entropy is constant",
    ],
    dont: [
      "Ship a feature when there's a TODO from 3 weeks ago",
      "Let files grow past 500 lines — the AI can't reason about them well",
      "Refactor and add a feature in the same PR",
    ],
    quote: '"AI will take the path of least resistance — appending code, growing files, skipping cleanup. Periodically ask it to step back and refactor."',
  },
  {
    n: "06",
    name: "Master git discipline",
    rule: "Commit after every working feature. Git revert > AI revert.",
    do_: [
      "Commit after every successful AI task — meaningful messages",
      "Start each new feature on a clean slate (new branch or fresh chat)",
      "Use git revert when things break, not 'AI please undo'",
      "Ask the AI to write the commit message — it knows what changed",
    ],
    dont: [
      "Commit 4 hours of mixed changes as 'updates'",
      "Trust 'AI native revert' for anything important",
      "Push directly to main — even solo, use PR previews",
    ],
    quote: '"Use git commit regularly. This gives you a safe checkpoint to roll back to if something goes wrong later."',
  },
  {
    n: "07",
    name: "Test by default",
    rule: "AI ships happy-path code. Force it to write tests as a default behavior.",
    do_: [
      "Add to CLAUDE.md: 'every new function gets a Vitest unit test'",
      "Test-driven prompting — failing test first, then implementation",
      "E2E with Playwright for critical user flows (signup, checkout)",
      "Refactor only when tests are green",
    ],
    dont: [
      "Accept 'I'll add tests later' (you won't)",
      "Skip tests on auth / payments / data deletion (these MUST have tests)",
      "Trust that 'the AI tested it' — it usually didn't",
    ],
    quote: '"Force AI to test by default. Whenever AI builds a feature, force it to write basic tests right away to ensure bugs get caught early."',
  },
  {
    n: "08",
    name: "Debug with the AI, not for it",
    rule: "Paste the error, but understand the fix before you commit it.",
    do_: [
      "Paste the full error message, stack trace, and relevant file",
      "Ask: 'list 3 possible causes ranked by likelihood'",
      "Add logging when the bug is non-obvious — AI is great at instrumenting",
      "Use MCP servers (Playwright for browser, fs for filesystem) so the AI can inspect, not guess",
    ],
    dont: [
      "Accept a fix you don't understand — ask for an explanation in simple terms",
      "Keep prompting after 3 failures — stop, start a fresh chat with full context",
      "Let the AI 'fix' by deleting the broken feature",
    ],
    quote: '"Don\'t just accept the fix — make sure you understand it. If you don\'t, ask AI to explain in simple terms."',
  },
  {
    n: "09",
    name: "Manage context aggressively",
    rule: "Context is a resource. Spend it on the right thing.",
    do_: [
      "Long context for one big task; fresh chat for unrelated next task",
      "Clear context after each finished task to save tokens AND quality",
      "Use subagents for sub-tasks (Claude Code spawns them automatically)",
      "Leverage 200k+ context windows when actually needed — paste full files",
    ],
    dont: [
      "Run a 6-hour conversation across 12 different features",
      "Tile every file into every prompt 'just in case'",
      "Reuse the same chat for prototyping AND debugging — quality degrades",
    ],
    quote: '"For unrelated tasks, proactively clean and start new sessions. Clear context for better results and to save token costs."',
  },
  {
    n: "10",
    name: "Never hardcode secrets",
    rule: "Day-zero discipline. Once a secret hits git, it's compromised forever.",
    do_: [
      "Every secret in .env from day one — commit .env.example, never .env",
      "Use NEXT_PUBLIC_ / VITE_ prefixes ONLY for non-secret config",
      "Rotate immediately if a key was ever in code (truffleHog finds them)",
      "Server-side keys in deployment env vars (Vercel, Cloudflare)",
    ],
    dont: [
      "Paste API keys into AI prompts (they may end up in code)",
      "Let the AI generate code with placeholder 'sk-...' that you forget to replace",
      "Assume 'just remove and recommit' is safe — git history keeps it forever",
    ],
    quote: '"Never let the AI put passwords, API keys, or tokens directly in the code. If you see it doing this, stop it and ask it to use environment variables instead."',
  },
];

// 30-day learning track
const TRACK = [
  {
    week: "Week 1",
    title: "Get a thing on screen",
    days: "Days 1–7",
    color: "ice",
    goals: [
      "Pick ONE vibe tool (Lovable if non-tech, Cursor if dev)",
      "Build the smallest possible thing — a todo app or your idea's MVP screen",
      "Get it deployed to a real URL by Day 3",
      "Read the auto-generated code, even if you don't understand it all",
    ],
    output: "A live URL. A GitHub repo. Confidence that AI can ship.",
  },
  {
    week: "Week 2",
    title: "Develop the prompting muscle",
    days: "Days 8–14",
    color: "lime",
    goals: [
      "Practice the 8 prompts from § 06 daily — start, scope, test, review",
      "Set up CLAUDE.md with your project's conventions",
      "Try voice input (Voibe / Wispr Flow) for one day — note the speed change",
      "Build a SECOND project from scratch in 1/3 the time",
    ],
    output: "A prompting style. A CLAUDE.md template. Faster iteration.",
  },
  {
    week: "Week 3",
    title: "Cross the water line",
    days: "Days 15–21",
    color: "orange",
    goals: [
      "Run the 27-item production checklist on your Week-1 project",
      "Fix every CRITICAL finding — don't move on until they're done",
      "Wire real auth (Clerk or Supabase) and real payments (Stripe)",
      "Add Sentry + PostHog. See real users break things.",
    ],
    output: "A project you'd be comfortable showing investors / customers.",
  },
  {
    week: "Week 4",
    title: "Operate like a real founder",
    days: "Days 22–30",
    color: "plum",
    goals: [
      "Talk to 5 real users. Note what's confusing.",
      "Set up CI/CD with GitHub Actions — typecheck, test, deploy on merge",
      "Refactor once. Force a session per § 04 Mindset rule #5.",
      "Decide: stay solo, or start hiring per § 11 Handoff.",
    ],
    output: "Either: launch, hire, or pivot — with evidence to back the call.",
  },
];

function Mindset() {
  const [open, setOpen] = useState(null);
  return (
    <section className="section" id="mindset" data-screen-label="04 Mindset">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">04 · The mindset</div>
          <h2 className="display">Ten disciplines that separate<br/>hobbyists from shippers.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            The tools change every quarter. The mindset doesn't. These ten practices —
            from spec-driven planning to never hardcoding secrets — appear in every successful
            vibe-coded shipping story and nowhere in the failed ones.
          </p>
        </div>
        <div className="section-num">§ 04 / 15</div>
      </div>

      <div className="mindset-grid">
        {MINDSET.map(m => (
          <div
            key={m.n}
            className={"mindset-card" + (open === m.n ? " open" : "")}
            role="button"
            tabIndex={0}
            aria-expanded={open === m.n}
            onClick={() => setOpen(open === m.n ? null : m.n)}
            onKeyDown={keyActivate(() => setOpen(open === m.n ? null : m.n))}
          >
            <div className="m-head">
              <div className="m-num">{m.n}</div>
              <div className="m-body">
                <div className="m-name">{m.name}</div>
                <div className="m-rule">{m.rule}</div>
              </div>
            </div>
            {open === m.n && (
              <div className="m-detail">
                <div className="m-cols">
                  <div className="m-col do">
                    <div className="m-col-label">✓ DO</div>
                    <ul>{m.do_.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                  <div className="m-col dont">
                    <div className="m-col-label">✗ DON'T</div>
                    <ul>{m.dont.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                </div>
                <div className="m-quote">{m.quote}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mindset-foot">
        Click any card to expand. Add to <span className="mono accent">CLAUDE.md</span> the
        rules you keep forgetting — that's how the discipline compounds.
      </div>
    </section>
  );
}

function Track() {
  return (
    <section className="section" id="track" data-screen-label="13 30-Day Track">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">13 · The 30-day track</div>
          <h2 className="display">Four weeks, four shifts.<br/>The vibe-coder learning curve.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            If you're starting from zero, here's the calendar. Each week locks in a different
            muscle — building, prompting, hardening, operating. Most founders need 30 days to go
            from first prompt to first paying user.
          </p>
        </div>
        <div className="section-num">§ 13 / 15</div>
      </div>

      <div className="track-grid">
        {TRACK.map((t, i) => (
          <div key={i} className={"track-card " + t.color}>
            <div className="t-week">{t.week}</div>
            <div className="t-days">{t.days}</div>
            <div className="t-title">{t.title}</div>
            <ul className="t-goals">
              {t.goals.map((g, j) => <li key={j}>{g}</li>)}
            </ul>
            <div className="t-output">
              <div className="t-output-label">Output</div>
              <div className="t-output-text">{t.output}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

Object.assign(window, { Mindset, Track });

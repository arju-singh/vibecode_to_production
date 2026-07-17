// ============================================================
// Extension sections v2 — Picker, Prompting, Credits, Handoff, Glossary
// ============================================================

// ---- DATA --------------------------------------------------------

const PICKER_QUESTIONS = [
  {
    id: "skill",
    q: "How comfortable are you with code?",
    opts: [
      { v: "none", l: "Never written code", note: "I'm a founder, PM, designer, or curious." },
      { v: "some", l: "I can read it, barely", note: "Bootcamp / tutorials / copied a Stripe snippet once." },
      { v: "dev", l: "I'm a developer", note: "I live in an editor every day." },
    ],
  },
  {
    id: "goal",
    q: "What are you actually trying to do?",
    opts: [
      { v: "validate", l: "Validate an idea", note: "A clickable prototype I can show 5 people." },
      { v: "ship", l: "Ship to real users", note: "MVP for paying customers in 30 days." },
      { v: "scale", l: "Scale what already works", note: "I have users; I need to not crash at 5,000." },
    ],
  },
  {
    id: "shape",
    q: "What's the shape of the product?",
    opts: [
      { v: "web", l: "Web app or SaaS", note: "Dashboard, CRUD, auth, payments." },
      { v: "mobile", l: "Mobile app", note: "iOS / Android, App Store distribution." },
      { v: "site", l: "Marketing site", note: "Landing page, blog, lead capture." },
    ],
  },
];

// Recommendations keyed by triple
function recommend({ skill, goal, shape }) {
  // Marketing sites
  if (shape === "site") {
    return {
      tool: "v0 by Vercel + Framer",
      stack: "v0 → Vercel → Resend (email) → Plausible (analytics)",
      why: "Landing pages don't need a backend. v0 outputs production React; Framer if you want zero code at all. Ship in an afternoon.",
      next: "Skip to Stage 04 (Deploy). You don't need most of the roadmap.",
      time: "1 afternoon",
    };
  }
  // Mobile
  if (shape === "mobile") {
    if (skill === "none") return {
      tool: "Rork",
      stack: "Rork → Supabase → EAS (Expo) → OneSignal",
      why: "Mobile-first vibe platform. Outputs real Expo apps you can submit to stores. Native components, not webviews.",
      next: "Build in Rork → audit (Stage 03) → submit via EAS.",
      time: "1–2 weeks to TestFlight",
    };
    return {
      tool: "Cursor + Expo",
      stack: "Cursor → Expo + React Native → Supabase → EAS → OneSignal + PostHog",
      why: "Expo is what every AI tool knows best for mobile. EAS handles builds & OTA updates. Don't pick Flutter unless you have a reason — less AI support.",
      next: "Roadmap Stages 02 → 06.",
      time: "4–8 weeks to App Store",
    };
  }
  // Web app
  if (skill === "none" && goal === "validate") return {
    tool: "Lovable",
    stack: "Lovable → Supabase → Stripe → Vercel",
    why: "Highest UI polish, easiest learning curve, native Supabase. Ship a credible demo in a weekend.",
    next: "Stay in Lovable through Stage 02. Pay for an audit before Stage 04.",
    time: "2–7 days",
  };
  if (skill === "none" && goal === "ship") return {
    tool: "Lovable → developer handoff",
    stack: "Lovable (prototype) → audit ($500–1.5k) → hire dev → Cursor + Supabase + Vercel + Stripe",
    why: "Lovable to validate. Then bring in a developer for Stages 03–04 — most non-tech founders shouldn't try to harden auth/payments alone.",
    next: "Sections: Roadmap → Hiring & Handoff.",
    time: "4–8 weeks",
  };
  if (skill === "some" && goal === "validate") return {
    tool: "Bolt.new or Lovable",
    stack: "Bolt (fast prototype) → Cursor (own the code) → Supabase → Vercel",
    why: "Bolt for speed, Lovable for polish. Export to GitHub the moment something works, then move down to Cursor.",
    next: "Roadmap Stages 01 → 02.",
    time: "1–2 weeks",
  };
  if (skill === "dev" && goal === "validate") return {
    tool: "v0 + Cursor",
    stack: "v0 (UI gen) → Cursor → Supabase or Neon → Vercel",
    why: "You don't need a vibe platform. v0 generates clean shadcn components, Cursor handles the rest. You'll own everything from day one.",
    next: "Skip to Roadmap Stage 02.",
    time: "1 week",
  };
  if (skill === "dev" && goal === "ship") return {
    tool: "Cursor + Claude Code",
    stack: "Cursor (interactive) + Claude Code (async) → Next.js → Supabase → Vercel → Stripe + Clerk → Sentry + PostHog",
    why: "The 2026 indie default. Cursor for steering, Claude Code for long refactors. Everything else is the proven Supabase / Vercel / Stripe spine.",
    next: "Roadmap Stages 02 → 04. Don't skip 03.",
    time: "4–8 weeks",
  };
  if (skill === "dev" && goal === "scale") return {
    tool: "Claude Code + Datadog",
    stack: "Cursor + Claude Code → Neon/Supavisor → Inngest → Cloudflare Workers → Datadog APM",
    why: "At scale, Claude Code's multi-file refactor power earns its keep. Add a connection pooler, queue, and APM before you hit the 5,000-user cliff.",
    next: "Roadmap Stages 06 → 07.",
    time: "Ongoing",
  };
  // some + ship
  if (skill === "some" && goal === "ship") return {
    tool: "Cursor + a senior friend",
    stack: "Cursor → Next.js → Supabase → Vercel → Stripe → Sentry",
    why: "You can read code, so own it. Pair with someone senior on PRs for the first 4 weeks — especially auth, payments, and the database schema.",
    next: "Roadmap Stages 02 → 05.",
    time: "6–10 weeks",
  };
  // some + scale
  if (goal === "scale") return {
    tool: "Hire someone",
    stack: "Bring in a contractor or engineer first. Then the indie stack.",
    why: "Scaling vibe-coded apps requires reading the AI's code carefully. If you can't, hire someone who can — it's cheaper than the breach.",
    next: "Sections: Hiring & Handoff.",
    time: "Ongoing",
  };
  return {
    tool: "Cursor + Supabase + Vercel",
    stack: "The 2026 default indie stack.",
    why: "Safe default. Read the Roadmap for stage-specific moves.",
    next: "Roadmap Stage 02.",
    time: "—",
  };
}

// ---- PROMPTING PLAYBOOK ----------------------------------------------
const PROMPTS = [
  {
    n: "01",
    name: "The Brief Prompt",
    when: "First message in a new project",
    what: "Drop your 1-page PRD verbatim — problem, user, jobs, data model, success metric. Don't ask for code yet.",
    template: `You are building [PRODUCT].

PROBLEM: [one sentence]
USER: [one persona]
CORE JOB: [the one thing they do daily]

DATA MODEL:
- users (id, email, plan)
- [table] ([fields])

SUCCESS METRIC: [one number]

Don't write code yet. Ask me 5 questions about anything ambiguous.`,
    why: "Every vibe tool produces dramatically better output when it has the full picture upfront. The 5-questions trick surfaces gaps in YOUR thinking, not the AI's.",
  },
  {
    n: "02",
    name: "Context Curation",
    when: "Cursor / Claude Code — multi-file work",
    what: "Manually @mention the 3–5 files that matter. Don't trust the AI's auto-context for anything important.",
    template: `@auth/login.ts @auth/session.ts @lib/supabase.ts

The session is dropping after 30min instead of 7 days.
The session config should be in supabase.ts. Check that file FIRST,
then trace through login.ts. Don't touch anything else.`,
    why: "Indexed codebase context is best-effort. Explicit @mentions are deterministic. This single discipline change cuts hallucinated edits ~70%.",
  },
  {
    n: "03",
    name: "Test-Driven Prompts",
    when: "Adding a feature or fixing a bug",
    what: "Ask for the test first, then the implementation. The AI commits to a behavior contract.",
    template: `Before writing code, write a failing test that describes the bug:

GIVEN a user with role=viewer
WHEN they POST /api/admin/delete-user
THEN they should get 403, not 200

Show me the test. After I approve, write the fix.`,
    why: "AI-generated 'fixes' often paper over symptoms. A failing test pins down what 'fixed' means and gives you a regression guard.",
  },
  {
    n: "04",
    name: "Security Lens",
    when: "Anywhere user data, auth, or money is involved",
    what: "Make the AI list the attack surface before writing the feature.",
    template: `Before implementing /api/billing/cancel, list:
1. Who can call this endpoint?
2. What inputs need validation?
3. What auth checks are required?
4. What happens if it's called twice (idempotency)?
5. What does the audit log entry look like?

Then implement.`,
    why: "Veracode: 45% of AI code has OWASP vulns because no one prompts for security. This prompt makes it free.",
  },
  {
    n: "05",
    name: "Schema-First",
    when: "Lovable / Bolt / Replit — before ANY UI",
    what: "Define the database schema in plain SQL before letting the tool generate a single screen.",
    template: `Don't generate UI yet. Write Supabase migrations for:

CREATE TABLE workspaces (id uuid PK, owner_id uuid FK users, name text);
CREATE TABLE memberships (workspace_id uuid FK, user_id uuid FK, role text);

-- RLS: users can only see workspaces they're a member of
-- RLS: only owners can update workspace.name

Apply migrations, then show me the SQL.`,
    why: "AI tools cargo-cult schema design from training data. If you don't pin it down first, you'll get a 'users' table with 47 nullable columns and no foreign keys.",
  },
  {
    n: "06",
    name: "The Scope Lock",
    when: "Iterating on a working feature",
    what: "Explicitly forbid the AI from touching unrelated files.",
    template: `Change ONLY the login form copy.

Do not touch:
- The auth logic
- The session config
- Any other file
- The styles file

If you think another file needs to change, STOP and tell me why.`,
    why: "Agentic tools love to 'helpfully' refactor adjacent files. Scope locks save your weekend.",
  },
  {
    n: "07",
    name: "The Voice Loop",
    when: "Any long session",
    what: "Use voice input (Voibe, Wispr Flow). You'll talk in full sentences with full context instead of typing terse prompts.",
    template: `[Speaking out loud, recorded by Voibe]

"The signup flow is broken. After clicking submit, the user lands on
the dashboard but their session isn't actually authenticated, so
all the API calls 401. I think it's a race between the redirect
and the session cookie write. Look at signup.ts and the
middleware..."`,
    why: "Karpathy's own setup is voice-first. Indie hackers shipping fastest in 2026 are voice-first. You speak 150 wpm and type 60.",
  },
  {
    n: "08",
    name: "The Review Prompt",
    when: "Before merging anything risky",
    what: "Ask a SECOND model to review the first model's code.",
    template: `[Paste diff into Claude after Cursor wrote it, or vice versa]

Review this diff as a senior engineer. Flag:
1. Security issues (auth bypass, injection, secret leaks)
2. Race conditions
3. Missing error handling
4. Anything that violates the existing patterns in the codebase

Be ruthless. Don't compliment. List problems only.`,
    why: "Cross-model review catches confident hallucinations. It's the cheapest 'second engineer' you'll ever hire.",
  },
];

// ---- CREDIT TRAP -----------------------------------------------------
const CREDIT_DATA = [
  { tool: "Cursor Pro", model: "$20 flat + usage", trap: "Composer + Claude Opus on a big repo can burn $5–10/day in fast requests.", tip: "Stay on the included slow pool for routine work; reserve fast requests for hard refactors." },
  { tool: "Claude Code", model: "Bundled in Claude Pro/Max", trap: "Free with $20–200 subscription you might already have. But long sessions can hit token caps fast.", tip: "If you're paying for Claude, you're paying for Claude Code. Use both." },
  { tool: "Lovable", model: "Credit-based, $25–100/mo tiers", trap: "Complex prompts cost 10–50 credits each. A frustrated iteration session can exhaust a month's worth in a day.", tip: "Plan in chat first, prompt for code second. Every retry is paid." },
  { tool: "Bolt.new", model: "Token-based, 150k free daily / 10M on Pro", trap: "Eats tokens 'like a parking meter' per real testers. Long projects in one chat compound costs.", tip: "Start new chats per feature. Past context costs forever in a long thread." },
  { tool: "v0", model: "Credit-based, $20 Pro / $50 Team", trap: "Each generation costs ~1 credit. Iterating designs eats credits 5–10× faster than you'd guess.", tip: "Use v0 for the first cut, then refine in Cursor where iteration is cheaper." },
  { tool: "Replit", model: "Checkpoint-based + AI usage", trap: "Agent calls + idle Replit instances. Auto-billing can surprise non-technical users.", tip: "Set hard usage caps in account settings before you start." },
  { tool: "Devin", model: "$20/mo (was $500)", trap: "Pricing crash makes it tempting. But long-horizon tasks still spiral if poorly specified.", tip: "Spec tasks like JIRA tickets, not Slack messages. Devin is a contractor, not a friend." },
  { tool: "Copilot", model: "$10/mo flat — unlimited", trap: "The ONE no-spiral option. Trade-off: weaker than Cursor for big multi-file work.", tip: "If predictability matters more than power, this is the safe choice." },
];

// ---- HIRING & HANDOFF ------------------------------------------------
const HANDOFF_STAGES = [
  {
    when: "Day 0 — Before you start",
    who: "Maybe a part-time technical advisor ($100–500/mo)",
    why: "A 1-hour weekly call with someone senior catches architecture mistakes before they're load-bearing. Cheapest insurance you'll buy.",
    where: "Lenny's job board · MicroAcquire · IndieHackers · X DMs to people whose threads you've read for a year.",
  },
  {
    when: "Stage 02 — When you can't fix the bug",
    who: "Fractional engineer ($75–150/hr, 5–10 hrs/wk)",
    why: "You've been stuck for 3 days on an auth flow. The right pair-programming session unblocks you in 2 hours and teaches you the pattern.",
    where: "Toptal · Codementor · GitHub Sponsors of OSS authors you use.",
  },
  {
    when: "Stage 03 — Before you launch",
    who: "Audit firm ($500–3,000 one-time)",
    why: "Most vibe-coded apps ship with 8–14 findings. A pro audit catches them before your users do — or before Wiz Research writes a blog about you.",
    where: "Beesoul · Escape.tech · independent senior engineers on X. Look for ones who specifically audit Lovable/Bolt/Cursor output.",
  },
  {
    when: "Stage 04 — At first paying customer",
    who: "Full-time contractor (3–6 month engagement, $8–15k/mo)",
    why: "Someone to own the codebase while you sell. They rewrite the fragile parts, document the system, and prepare for the handoff to a hire.",
    where: "WorkOS Connect · Y Combinator co-founder matching · referrals from your investor's portfolio.",
  },
  {
    when: "Stage 06 — At $20k+ MRR",
    who: "First full-time engineer ($120–250k + equity)",
    why: "The product is real. The codebase is yours. You need someone who can read AI code AND write production code AND be on-call AND mentor the next two hires.",
    where: "Vouch (referrals) · OTTA · YC Work at a Startup · personal network. Skip Indeed.",
  },
];

const HANDOFF_PACKAGE = [
  { t: "GitHub repo, properly", d: "Not the auto-export. A real repo with branch protection, meaningful commits, and a README that says 'how to run this in 60 seconds'." },
  { t: "The brief + decisions log", d: "Why is auth Clerk and not Supabase Auth? Why Stripe Checkout and not Elements? Future-you and the new hire both need the why." },
  { t: "Env vars schema", d: "A .env.example committed, every variable documented. Where to get each key. Which are server-only." },
  { t: "Runbook for top 5 ops", d: "Deploy, rollback, restore DB backup, rotate a leaked secret, escalate a Stripe dispute. Plain English, screenshots OK." },
  { t: "List of every vendor + cost", d: "Vercel, Supabase, Stripe, OpenAI, Sentry, PostHog… The new person needs to know what you're paying for and why." },
  { t: "Architecture sketch", d: "One whiteboard photo. Boxes for services, arrows for data flow. Better than 20 pages of docs." },
  { t: "Outstanding known issues", d: "The bugs you know about, the ones you've been ignoring, the 'we'll fix it later' debts. Honesty saves trust." },
  { t: "Access list", d: "Who has admin on Vercel, Supabase, GitHub, Stripe, the domain registrar. With a plan to rotate or revoke." },
];

// ---- GLOSSARY --------------------------------------------------------
const GLOSSARY = [
  { t: "Vibe Coding", d: "Coined by Karpathy in Feb 2025: writing software by describing it in natural language and letting AI generate code. Collins Word of the Year 2025." },
  { t: "Prompt", d: "The instructions you give an AI. Better prompts = better output. The single biggest skill multiplier in the AI era." },
  { t: "Token", d: "Roughly ¾ of an English word. Every word in/out of an AI counts as tokens. Pricing is per-token; long chats cost more." },
  { t: "Context Window", d: "How much text an AI can 'see' at once. Claude has 200k tokens; Gemini up to 2M. Bigger window = more code you can paste in." },
  { t: "Agent", d: "An AI that doesn't just answer — it can run tools, edit files, run shell commands. Cursor's Composer, Claude Code, Devin are agents." },
  { t: "Subagent", d: "A child agent spawned by a parent to handle a sub-task with its own context. Claude Code launches them automatically; saves the main thread from clutter." },
  { t: "CLAUDE.md / AGENTS.md", d: "A markdown file at your repo root that AI tools auto-read on every session. Your project's conventions, stack, do's and don'ts, lessons. Compounds quality." },
  { t: "MCP (Model Context Protocol)", d: "Anthropic's open spec for connecting AI to tools/data. Playwright MCP lets Claude inspect a real browser; filesystem MCP lets it read files; etc." },
  { t: "SDD (Spec-Driven Development)", d: "Define the behavior (spec) before the code. Newer vibe-coding tools (Spec Kit, etc.) make the spec a first-class artifact the AI re-reads." },
  { t: "RLS (Row-Level Security)", d: "Postgres/Supabase feature: rules on which database rows a user can read/write. If broken, your whole database leaks." },
  { t: "Auth / AuthN / AuthZ", d: "AuthN = authentication (are you who you say). AuthZ = authorization (are you allowed). Most vibe-app bugs are AuthZ failures." },
  { t: "Webhook", d: "A URL Stripe (or any service) POSTs to when something happens. If you don't verify signatures, anyone can fake them." },
  { t: "Edge Function", d: "Code that runs in 100+ data centers globally, close to your user. Vercel/Cloudflare Workers/Supabase Edge Functions." },
  { t: "CI / CD", d: "Continuous Integration / Deployment. Automated typecheck + test + deploy on every git push. Stops you from shipping broken code at 11pm." },
  { t: "Idempotency", d: "Calling something twice = same result as once. Crucial for payments — your retry shouldn't double-charge." },
  { t: "N+1 Query", d: "Listing N items but making N+1 database calls (one for the list, one per item). The #1 perf killer in vibe-coded apps." },
  { t: "SOC 2", d: "A security audit enterprise customers ask for. Takes 3–6 months with Vanta/Drata to get. Unlocks 10× ACVs." },
  { t: "MoR (Merchant of Record)", d: "A payment processor that takes legal responsibility for tax/VAT (Lemon Squeezy, Paddle, Polar). Stripe is NOT an MoR — you handle tax." },
  { t: "Shadcn/ui", d: "Copy-paste React component library on Tailwind + Radix. The default UI vocabulary v0 outputs." },
  { t: "BaaS / PaaS", d: "Backend-as-a-Service (Supabase, Firebase) vs Platform-as-a-Service (Vercel, Render). BaaS = data; PaaS = hosting." },
];

const RESOURCES = [
  { cat: "Communities", items: [
    { nm: "r/vibecoding · r/cursor · r/ClaudeAI", d: "Active Reddit communities, real builders" },
    { nm: "IndieHackers", d: "Solo & small team SaaS founders" },
    { nm: "Lovable Discord", d: "Official, very active" },
    { nm: "Cursor Forum", d: "Tips, prompts, and bugs" },
    { nm: "Hacker News", d: "Weekly 'Show HN' = where vibe-coded products debut" },
  ]},
  { cat: "Reading", items: [
    { nm: "roadmap.sh/vibe-coding", d: "Curated learning path" },
    { nm: "Supabase Master Checklist", d: "The production-readiness gold standard" },
    { nm: "Aikido CISO Vibe Checklist", d: "Security framework with input from Lovable & Supabase CISOs" },
    { nm: "Vibe Coder Blog", d: "Honest tool comparisons" },
    { nm: "Karpathy on X", d: "Source of the term, ongoing taste" },
  ]},
  { cat: "Courses", items: [
    { nm: "Build Your Own X (GitHub)", d: "From-scratch tutorials in every stack" },
    { nm: "Frontend Masters AI track", d: "Paid but deep on prompting + agents" },
    { nm: "Vercel Learn", d: "Free, official, Next.js focused" },
    { nm: "Anthropic Cookbook", d: "Official Claude patterns" },
    { nm: "Cursor docs + Cursor TikTok", d: "Underrated, real workflows" },
  ]},
  { cat: "Templates", items: [
    { nm: "create-t3-app", d: "Next.js + Prisma + tRPC + Tailwind starter" },
    { nm: "Vercel templates gallery", d: "100+ deploy-ready Next.js apps" },
    { nm: "Supabase starters", d: "Auth + multi-tenant + SaaS templates" },
    { nm: "shadcn/ui examples", d: "Real dashboards, auth pages, settings" },
    { nm: "Cobalt / Indie Boilerplate", d: "Paid full-SaaS starters ($150–400)" },
  ]},
];

// ---- COMPONENTS --------------------------------------------------

function ToolPicker() {
  const [answers, setAnswers] = useState({});
  const allAnswered = PICKER_QUESTIONS.every(q => answers[q.id]);
  const rec = allAnswered ? recommend(answers) : null;

  return (
    <section className="section" id="picker" data-screen-label="03 Tool Picker">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">03 · Tool picker</div>
          <h2 className="display">Answer three questions.<br/>Get your starting stack.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            Skip the comparison-paralysis. Three honest answers below produce a real recommendation — not "it depends."
          </p>
        </div>
        <div className="section-num">§ 03 / 15</div>
      </div>

      <div className="picker-grid">
        {PICKER_QUESTIONS.map((q, qi) => (
          <div key={q.id} className="picker-card">
            <div className="picker-q"><span className="picker-num">Q{qi+1}</span> {q.q}</div>
            <div className="picker-opts">
              {q.opts.map(o => (
                <div
                  key={o.v}
                  className={"picker-opt" + (answers[q.id] === o.v ? " active" : "")}
                  role="button"
                  tabIndex={0}
                  aria-pressed={answers[q.id] === o.v}
                  onClick={() => setAnswers(a => ({...a, [q.id]: o.v}))}
                  onKeyDown={keyActivate(() => setAnswers(a => ({...a, [q.id]: o.v})))}
                >
                  <div className="opt-label">{o.l}</div>
                  <div className="opt-note">{o.note}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {allAnswered && (
        <div className="picker-result">
          <div className="picker-result-kicker">Your starting stack</div>
          <div className="picker-result-tool">{rec.tool}</div>
          <div className="picker-result-stack mono">{rec.stack}</div>
          <div className="picker-result-row">
            <div>
              <div className="prr-k">Why</div>
              <div className="prr-v">{rec.why}</div>
            </div>
            <div>
              <div className="prr-k">Next step</div>
              <div className="prr-v">{rec.next}</div>
            </div>
            <div>
              <div className="prr-k">Time to first ship</div>
              <div className="prr-v">{rec.time}</div>
            </div>
          </div>
        </div>
      )}
      {!allAnswered && (
        <div className="picker-pending">
          {Object.keys(answers).length} of 3 answered. Pick one option from each card.
        </div>
      )}
    </section>
  );
}

function Prompting() {
  const [open, setOpen] = useState("01");
  return (
    <section className="section" id="prompting" data-screen-label="06 Prompting Playbook">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">06 · Prompting playbook</div>
          <h2 className="display">Eight prompts that separate<br/>vibe coders from prompt jockeys.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            The hidden skill behind every shipped vibe-coded product: you're not "talking to an AI",
            you're writing specs. These eight patterns turn AI output from mid → ship-worthy.
          </p>
        </div>
        <div className="section-num">§ 06 / 15</div>
      </div>

      <div className="prompt-list">
        {PROMPTS.map(p => (
          <div
            key={p.n}
            className={"prompt-card" + (open === p.n ? " open" : "")}
            role="button"
            tabIndex={0}
            aria-expanded={open === p.n}
            onClick={() => setOpen(open === p.n ? null : p.n)}
            onKeyDown={keyActivate(() => setOpen(open === p.n ? null : p.n))}
          >
            <div className="prompt-head">
              <div className="prompt-n">{p.n}</div>
              <div className="prompt-meta">
                <div className="prompt-name">{p.name}</div>
                <div className="prompt-when">{p.when}</div>
              </div>
              <div className="prompt-toggle">{open === p.n ? "−" : "+"}</div>
            </div>
            {open === p.n && (
              <div className="prompt-body">
                <div className="prompt-what">{p.what}</div>
                <pre className="prompt-template">{p.template}</pre>
                <div className="prompt-why"><strong>Why:</strong> {p.why}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CreditTrap() {
  return (
    <section className="section" id="credits" data-screen-label="07 The Credit Trap">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">08 · The credit trap</div>
          <h2 className="display">$20/month is the sticker.<br/>$400 is the bill.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            Every major vibe tool except GitHub Copilot uses credit or token pricing. A frustrating
            debug session that should cost $1 routinely costs $50. Here's the honest table — and
            how to keep your card unscorched.
          </p>
        </div>
        <div className="section-num">§ 08 / 15</div>
      </div>

      <div className="credit-table">
        <div className="credit-row credit-header">
          <div>Tool</div>
          <div>Pricing model</div>
          <div>Where it bites</div>
          <div>Survival tip</div>
        </div>
        {CREDIT_DATA.map((c, i) => (
          <div key={i} className="credit-row">
            <div className="credit-tool">{c.tool}</div>
            <div className="credit-model mono">{c.model}</div>
            <div className="credit-trap">{c.trap}</div>
            <div className="credit-tip">{c.tip}</div>
          </div>
        ))}
      </div>

      <div className="credit-rules">
        <div className="cr-title">Six universal rules to keep credits in check</div>
        <ol>
          <li><strong>Plan in chat, prompt for code.</strong> Brainstorming with an AI is cheap; iterating on code is expensive. Decide WHAT before asking for HOW.</li>
          <li><strong>Start fresh chats per feature.</strong> Long threads carry expensive context. Every reply re-bills the whole conversation.</li>
          <li><strong>Set hard caps.</strong> Every platform has a billing limit. Set it to 2× your monthly budget on day one.</li>
          <li><strong>Use the slow pool for routine work.</strong> Cursor & others have free "slow" requests. Reserve fast/premium for hard problems.</li>
          <li><strong>Don't retry frustrated.</strong> If a prompt fails twice, change it instead of re-running. Three failed attempts cost as much as one careful one.</li>
          <li><strong>Watch the agentic loops.</strong> Autonomous agents (Devin, Claude Code) can loop on a bug for hours. Set time/turn budgets in the prompt.</li>
        </ol>
      </div>
    </section>
  );
}

function Handoff() {
  return (
    <section className="section" id="handoff" data-screen-label="10 Hiring &amp; Handoff">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">11 · Hiring &amp; handoff</div>
          <h2 className="display">When to stop vibing alone.<br/>And what to give the developer.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            Every vibe-coded startup that survives crosses the same threshold: the founder stops
            being the only one in the codebase. The trick is doing it before the technical debt
            buries you, with a clean handoff that respects the next person's time.
          </p>
        </div>
        <div className="section-num">§ 11 / 15</div>
      </div>

      <h3 style={{fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 24}}>The hiring timeline</h3>
      <div className="handoff-timeline">
        {HANDOFF_STAGES.map((h, i) => (
          <div key={i} className="handoff-step">
            <div className="hs-when">{h.when}</div>
            <div className="hs-who">{h.who}</div>
            <div className="hs-why">{h.why}</div>
            <div className="hs-where"><strong>Where to look:</strong> {h.where}</div>
          </div>
        ))}
      </div>

      <h3 style={{fontFamily: 'var(--font-display)', fontSize: 32, margin: '64px 0 24px'}}>The handoff package</h3>
      <p style={{maxWidth: 640, marginBottom: 24}}>
        Eight things to assemble before the new person starts. Together they save 2–3 weeks of
        onboarding and double the chance they stay.
      </p>
      <div className="handoff-package">
        {HANDOFF_PACKAGE.map((h, i) => (
          <div key={i} className="hp-item">
            <div className="hp-num mono">{String(i+1).padStart(2, '0')}</div>
            <div>
              <div className="hp-t">{h.t}</div>
              <div className="hp-d">{h.d}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Glossary() {
  return (
    <section className="section" id="further" data-screen-label="11 Glossary &amp; Resources">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">14 · Going further</div>
          <h2 className="display">Glossary &amp; where to go next.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            Sixteen terms every non-tech founder eventually has to know — plus the communities,
            reading, courses, and templates worth your time.
          </p>
        </div>
        <div className="section-num">§ 14 / 15</div>
      </div>

      <h3 style={{fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 24}}>Glossary</h3>
      <div className="glossary">
        {GLOSSARY.map((g, i) => (
          <div key={i} className="gl-item">
            <div className="gl-t mono">{g.t}</div>
            <div className="gl-d">{g.d}</div>
          </div>
        ))}
      </div>

      <h3 style={{fontFamily: 'var(--font-display)', fontSize: 32, margin: '72px 0 24px'}}>Resources</h3>
      <div className="resources">
        {RESOURCES.map(r => (
          <div key={r.cat} className="res-col">
            <div className="res-cat">{r.cat}</div>
            <div className="res-items">
              {r.items.map((it, i) => (
                <div key={i} className="res-item">
                  <div className="res-nm">{it.nm}</div>
                  <div className="res-d">{it.d}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

Object.assign(window, { ToolPicker, Prompting, CreditTrap, Handoff, Glossary });

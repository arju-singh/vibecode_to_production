// ============================================================
// UI primitives + all sections
// ============================================================

const { useState, useEffect, useMemo, useRef } = React;

// ---------- HERO ----------
function Hero() {
  return (
    <section className="hero" id="hero" data-screen-label="01 Hero">
      <div className="hero-meta">
        <span>Field Guide · v1.0</span>
        <span>26 May 2026</span>
        <span>Built for indie founders, agencies & PMs</span>
      </div>
      <h1>
        The Vibe Coding<br/>
        Roadmap: from prompt<br/>
        to <em>production-ready</em>.
      </h1>
      <p className="hero-sub">
        Every tool, framework, and service you need to take an idea from a 4&nbsp;PM Lovable prompt
        to a SOC&nbsp;2-audited product real customers pay for. The full journey, the iceberg under it,
        and the order of operations that keeps you out of the 2,000+ critical-vulnerability dataset.
      </p>
      <div className="hero-stats">
        {STATS.map((s, i) => (
          <div key={i} className="stat">
            <div className="stat-val">{s.v}<span className="unit">{s.u}</span></div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- ICEBERG ----------
function Iceberg() {
  return (
    <section className="section" id="iceberg" data-screen-label="02 The Iceberg">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">01 · The reality gap</div>
          <h2 className="display">What you see vs. what you ship.</h2>
          <p style={{maxWidth: 620, marginTop: 16}}>
            The vibe-coding stack you brag about on X is the tip. Everything that decides whether
            your app survives 5,000 users sits under the waterline. The roadmap below is, in order,
            how you get from one side to the other.
          </p>
        </div>
        <div className="section-num">§ 01 / 15</div>
      </div>

      <div className="iceberg-wrap">
        <div className="iceberg-col vibe">
          <div className="iceberg-head">
            <div className="iceberg-label">Above the water</div>
            <div className="iceberg-title">Vibe Coding</div>
          </div>
          <div className="iceberg-body">
            <div className="muted" style={{fontSize: 13, marginBottom: 16}}>
              What every demo, screenshot, and Twitter thread shows.
            </div>
            <div className="tip-list">
              {ICEBERG_VIBE.above.map(t => (
                <span key={t} className="tip-chip lg">{t}</span>
              ))}
            </div>
            <div className="iceberg-water"></div>
            <div style={{fontSize: 13, color: 'var(--ink-mute)', marginTop: 24, lineHeight: 1.5}}>
              <strong style={{color: 'var(--ice)'}}>The myth:</strong> "anyone can build an app."<br/>
              <strong style={{color: 'var(--ice)'}}>The truth:</strong> anyone can <em>start</em> one.
            </div>
          </div>
        </div>

        <div className="iceberg-col prod">
          <div className="iceberg-head">
            <div className="iceberg-label">Below the water</div>
            <div className="iceberg-title">Production Reality</div>
          </div>
          <div className="iceberg-body">
            <div className="muted" style={{fontSize: 13, marginBottom: 16}}>
              What decides if you get to 10k users — or get on Wiz Research.
            </div>
            <div className="berg-list">
              {ICEBERG_PROD.huge.map(t => <span key={t} className="b huge">{t}</span>)}
              {ICEBERG_PROD.lg.map(t => <span key={t} className="b lg">{t}</span>)}
              {ICEBERG_PROD.md.map(t => <span key={t} className="b">{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- PYRAMID (Tiers) ----------
function Pyramid() {
  const [active, setActive] = useState(3);
  return (
    <section className="section" id="tiers" data-screen-label="03 Tool Tiers">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">02 · The tool stack</div>
          <h2 className="display">Five tiers of AI tooling.<br/>Use them in the right order.</h2>
          <p style={{maxWidth: 620, marginTop: 16}}>
            The mistake isn't picking the wrong tool. It's using a tier-5 autonomous agent for a
            tier-1 problem, or a tier-2 vibe platform for tier-4 work. Click any tier to see
            when it fits — and when it bites.
          </p>
        </div>
        <div className="section-num">§ 02 / 15</div>
      </div>

      <div className="pyramid">
        {TIERS.map(t => (
          <div
            key={t.n}
            className={"tier" + (active === t.n ? " active" : "")}
            data-t={t.n}
            onClick={() => setActive(active === t.n ? null : t.n)}
          >
            <div className="tier-num">T{t.n}</div>
            <div className="tier-meta">
              <div className="tier-name">{t.name}</div>
              <div className="tier-tag">{t.tag}</div>
            </div>
            <div className="tier-tools">
              {t.tools.map(tool => (
                <span key={tool} className="tool-pill"><span className="dot"></span>{tool}</span>
              ))}
            </div>
            {active === t.n && (
              <div className="tier-detail">
                <div>
                  <h5>What it's for</h5>
                  <p>{t.use}</p>
                </div>
                <div>
                  <h5>When to use it</h5>
                  <p>{t.when}</p>
                </div>
                <div>
                  <h5>What bites you</h5>
                  <p>{t.risks}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- ROADMAP ----------
function Roadmap() {
  const [active, setActive] = useState("ideate");
  const stage = STAGES.find(s => s.id === active);

  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vibe-roadmap-done") || "{}"); }
    catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem("vibe-roadmap-done", JSON.stringify(done));
  }, [done]);

  function toggle(key) {
    setDone(d => ({ ...d, [key]: !d[key] }));
  }

  return (
    <section className="section" id="roadmap" data-screen-label="04 The Roadmap">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">05 · The journey</div>
          <h2 className="display">Eight stages from idea to enterprise.</h2>
          <p style={{maxWidth: 620, marginTop: 16}}>
            Click any stage to see goals, tools, do-this-now actions, deliverables, and the one
            pitfall that will eat your week if you skip it.
          </p>
        </div>
        <div className="section-num">§ 05 / 15</div>
      </div>

      <div className="roadmap-shell">
        <div className="timeline">
          {STAGES.map(s => (
            <div
              key={s.id}
              className={"tl-step" + (active === s.id ? " active" : "")}
              onClick={() => setActive(s.id)}
            >
              <div className="tl-stage">Stage {s.stage}</div>
              <div className="tl-name">{s.name}</div>
              <div className="tl-time">{s.time}</div>
            </div>
          ))}
        </div>

        <div className="stage-panel">
          <div className="stage-hd">
            <div className="left">
              <div className="stage-stage">Stage {stage.stage} — {stage.persona}</div>
              <div className="stage-name display">{stage.name}.</div>
              <div className="stage-goal">{stage.goal}</div>
            </div>
            <div className="stage-meta">
              <div className="meta-row"><div className="k">Time</div><div className="v">{stage.time}</div></div>
              <div className="meta-row"><div className="k">Cost</div><div className="v">{stage.cost}</div></div>
              <div className="meta-row"><div className="k">Stage</div><div className="v">{stage.stage} / 07</div></div>
            </div>
          </div>

          <div className="stage-grid">
            <div className="stage-card">
              <div className="card-hd">
                <div className="card-icon">D</div>
                <div className="card-title">What to do now</div>
              </div>
              <ul className="todo-list">
                {stage.do.map((d, i) => {
                  const key = `${stage.id}-do-${i}`;
                  const isDone = !!done[key];
                  return (
                    <li
                      key={i}
                      className={"todo-item" + (isDone ? " done" : "")}
                      onClick={() => toggle(key)}
                    >
                      <span className="todo-box">{isDone && <span style={{fontSize: 11, lineHeight: 1}}>✓</span>}</span>
                      <span className="todo-text"><strong>{d.t}.</strong> {d.d}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="stage-card">
              <div className="card-hd">
                <div className="card-icon ice">✓</div>
                <div className="card-title">Deliverables</div>
              </div>
              <ul className="todo-list">
                {stage.deliver.map((d, i) => {
                  const key = `${stage.id}-deliver-${i}`;
                  const isDone = !!done[key];
                  return (
                    <li
                      key={i}
                      className={"todo-item" + (isDone ? " done" : "")}
                      onClick={() => toggle(key)}
                    >
                      <span className="todo-box">{isDone && <span style={{fontSize: 11, lineHeight: 1}}>✓</span>}</span>
                      <span className="todo-text">{d}</span>
                    </li>
                  );
                })}
              </ul>
              {stage.framework && (
                <>
                  <div className="divider"></div>
                  <h5 style={{fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ink-mute)', margin: '0 0 8px'}}>Frameworks</h5>
                  <div className="tip-list">
                    {stage.framework.map(f => <span key={f} className="tip-chip">{f}</span>)}
                  </div>
                </>
              )}
            </div>

            <div className="stage-card full">
              <div className="card-hd">
                <div className="card-icon lime">⚒</div>
                <div className="card-title">Tools for this stage</div>
              </div>
              <div className="tool-grid">
                {stage.tools.map((t, i) => (
                  <div key={i} className="tool-card">
                    <div className="nm">{t.nm}</div>
                    <div className="ds">{t.ds}</div>
                    <div className="px">{t.px}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="stage-card full">
              <div className="card-hd">
                <div className="card-icon rose">!</div>
                <div className="card-title">The pitfall</div>
              </div>
              <div className="pitfall"><strong>Watch out:</strong> {stage.pitfall}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- STACK BUILDER ----------
function Stacks() {
  const [active, setActive] = useState("indie");
  const stack = STACKS.find(s => s.id === active);

  return (
    <section className="section" id="stacks" data-screen-label="05 Recommended Stacks">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">07 · Pick a stack</div>
          <h2 className="display">Five proven stacks. Pick one. Don't over-tool.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            New vibe coders over-subscribe. The two costliest mistakes: paying for two AI editors,
            and stitching a backend out of four services. Each stack below is what real builders ship with.
          </p>
        </div>
        <div className="section-num">§ 07 / 15</div>
      </div>

      <div className="stack-tabs">
        {STACKS.map(s => (
          <div
            key={s.id}
            className={"stack-tab" + (active === s.id ? " active" : "")}
            onClick={() => setActive(s.id)}
          >
            {s.persona}
          </div>
        ))}
      </div>

      <div style={{marginBottom: 24, color: 'var(--ink-dim)', fontSize: 14, maxWidth: 720}}>
        <strong style={{color: 'var(--ink)'}}>{stack.persona}</strong> — {stack.sub}
      </div>

      <div className="stack-grid">
        {stack.layers.map((l, i) => (
          <div key={i} className="stack-layer">
            <div className="layer-num">{String(i+1).padStart(2,'0')}</div>
            <div className="layer-name">{l.layer}</div>
            <div className="layer-pick">{l.pick}</div>
            <div className="layer-why">{l.why}</div>
            <div className="layer-alt">{l.alt}</div>
          </div>
        ))}
      </div>

      <div className="stack-total">
        <div className="label">Estimated runtime cost</div>
        <div className="price">{stack.total}</div>
      </div>
    </section>
  );
}

// ---------- CHECKLIST ----------
function Checklist() {
  const [cat, setCat] = useState("all");
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vibe-checklist") || "{}"); }
    catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem("vibe-checklist", JSON.stringify(done));
  }, [done]);

  const items = CHECKLIST.filter(c => cat === "all" || c.cat === cat);
  const counts = useMemo(() => {
    const out = {all: CHECKLIST.length};
    CHECK_CATS.forEach(c => {
      if (c.id !== "all") out[c.id] = CHECKLIST.filter(x => x.cat === c.id).length;
    });
    return out;
  }, []);

  const doneCount = Object.keys(done).filter(k => done[k]).length;
  const pct = Math.round((doneCount / CHECKLIST.length) * 100);

  function toggle(idx) {
    setDone(d => ({ ...d, [idx]: !d[idx] }));
  }

  return (
    <section className="section" id="checklist" data-screen-label="06 Production Checklist">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">09 · Pre-launch audit</div>
          <h2 className="display">The production checklist.<br/>27 things vibe tools will skip.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            Run this before you put your app in front of paying users. Each item maps to a specific
            failure mode found across the 5,600 vibe-coded apps Escape.tech audited in early 2026.
            Your progress saves locally.
          </p>
        </div>
        <div className="section-num">§ 09 / 15</div>
      </div>

      <div className="check-progress">
        <div className="check-num">{doneCount} / {CHECKLIST.length}</div>
        <div className="check-bar"><div style={{width: pct + "%"}}></div></div>
        <div className="check-num">{pct}%</div>
      </div>

      <div className="check-cats">
        {CHECK_CATS.map(c => (
          <div
            key={c.id}
            className={"check-cat" + (cat === c.id ? " active" : "")}
            onClick={() => setCat(c.id)}
          >
            {c.name}<span className="cnt">{counts[c.id]}</span>
          </div>
        ))}
      </div>

      <div className="checklist">
        {items.map((c, i) => {
          const key = CHECKLIST.indexOf(c);
          const isDone = !!done[key];
          return (
            <div key={key} className={"check-item" + (isDone ? " done" : "")} onClick={() => toggle(key)}>
              <div className="check-box">{isDone && <span style={{fontSize: 14, lineHeight: 1}}>✓</span>}</div>
              <div className="check-body">
                <div className="check-title">{c.t}</div>
                <div className="check-desc">{c.d}</div>
                <div className="check-tools">{c.tools}</div>
                <div className={"check-sev " + c.sev}>
                  {c.sev === "crit" ? "● Critical" : c.sev === "high" ? "● High" : "● Medium"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- INCIDENTS ----------
function Incidents() {
  return (
    <section className="section" id="incidents" data-screen-label="07 Cautionary Tales">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">10 · Cautionary tales</div>
          <h2 className="display">When vibe code meets real users.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            Every item on the checklist above maps to a real incident. These are six the security
            community documented in early 2026 — and the one-line lesson from each.
          </p>
        </div>
        <div className="section-num">§ 10 / 15</div>
      </div>

      <div className="incidents-grid">
        {INCIDENTS.map((inc, i) => (
          <div key={i} className="incident">
            <div className="tag">{inc.tag}</div>
            <h4>{inc.name}</h4>
            <div className="sub">{inc.sub}</div>
            <p>{inc.body}</p>
            <div className="impact"><strong>→</strong> {inc.impact}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- TOOL INDEX ----------
function ToolIndex() {
  const cats = useMemo(() => {
    const set = new Set(TOOL_INDEX.map(t => t.cat));
    return ["All", ...Array.from(set)];
  }, []);
  const [filter, setFilter] = useState("All");
  const tools = TOOL_INDEX.filter(t => filter === "All" || t.cat === filter);

  return (
    <section className="section" id="tools" data-screen-label="08 Tool Index">
      <div className="section-head">
        <div className="section-title">
          <div className="kicker">12 · The full index</div>
          <h2 className="display">Every tool, one screen.</h2>
          <p style={{maxWidth: 640, marginTop: 16}}>
            {TOOL_INDEX.length} tools across the journey — AI editors, vibe platforms, backends,
            auth, payments, hosting, observability, security, compliance. Filter by category.
          </p>
        </div>
        <div className="section-num">§ 12 / 15</div>
      </div>

      <div className="tool-filters">
        {cats.map(c => (
          <div
            key={c}
            className={"check-cat" + (filter === c ? " active" : "")}
            onClick={() => setFilter(c)}
          >
            {c}
          </div>
        ))}
      </div>

      <div className="tool-index">
        {tools.map((t, i) => (
          <div key={i} className="ti-card">
            <div className="ti-name">
              <span>{t.nm}</span>
              <span className="ti-cat">{t.cat}</span>
            </div>
            <div className="ti-desc">{t.ds}</div>
            <div className="ti-foot">
              <span className="ti-price">{t.px}</span>
              <span className="ti-tier">{t.tier}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- OUTRO ----------
function Outro() {
  return (
    <section className="outro" id="outro" data-screen-label="09 Outro">
      <div className="kicker" style={{marginBottom: 24}}>§ 15 / 15 · End of the map</div>
      <h2 className="display">
        Vibe coding got you to <em style={{color: 'var(--orange)', fontStyle: 'italic'}}>started</em>.<br/>
        The roadmap gets you to <em style={{color: 'var(--orange)', fontStyle: 'italic'}}>shipped</em>.
      </h2>
      <p>
        Every successful vibe-coded product in 2026 followed the same arc: prompt-built prototype,
        owned the code by week two, hardened before the first paying user, and quietly rewrote
        the fragile core somewhere between 1k and 10k MAU. Use this as your checklist — not the
        screenshots.
      </p>
      <div className="foot-mark">The Vibe Coding Roadmap · v1.0 · May 2026</div>
    </section>
  );
}

// ---------- FOOTER ----------
function Footer() {
  const subject = encodeURIComponent("Bug report — Vibe Coding Roadmap");
  const body = encodeURIComponent(
    "What happened:\n\n\nWhat I expected:\n\n\nBrowser / device:\n\n"
  );
  return (
    <footer className="site-footer" id="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="footer-name display">The Vibe Coding Roadmap</div>
          <p className="footer-tag">From a 4&nbsp;PM prompt to production-ready. One-time payment, lifetime access.</p>
        </div>
        <div className="footer-col">
          <div className="footer-h">Legal</div>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms &amp; Conditions</a>
          <a href="/refund">Refund &amp; Cancellation</a>
        </div>
        <div className="footer-col">
          <div className="footer-h">Support</div>
          <a href="mailto:connect@arjusingh.com">Contact support</a>
          <a href={`mailto:connect@arjusingh.com?subject=${subject}&body=${body}`}>Report a bug</a>
        </div>
      </div>
      <div className="footer-base">
        <span>© 2026 Arju Singh · The Vibe Coding Roadmap</span>
        <span>Payments secured by Razorpay</span>
      </div>
    </footer>
  );
}

// ---------- COOKIE CONSENT ----------
function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("vibe-cookie-consent")) setShow(true);
    } catch { setShow(true); }
  }, []);

  function decide(choice) {
    try { localStorage.setItem("vibe-cookie-consent", choice); } catch {}
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie notice">
      <div className="cookie-text">
        We use only essential browser storage to remember your progress and process payments —
        no advertising or cross-site tracking. See our <a href="/privacy">Privacy Policy</a>.
      </div>
      <div className="cookie-actions">
        <button className="cookie-btn ghost" onClick={() => decide("essential")}>Decline non-essential</button>
        <button className="cookie-btn" onClick={() => decide("all")}>Got it</button>
      </div>
    </div>
  );
}

// ---------- SIDE NAV ----------
const NAV = [
  { id: "hero", num: "00", label: "Intro" },
  { id: "iceberg", num: "01", label: "The Iceberg" },
  { id: "tiers", num: "02", label: "Tool Tiers" },
  { id: "picker", num: "03", label: "Tool Picker" },
  { id: "mindset", num: "04", label: "The Mindset" },
  { id: "roadmap", num: "05", label: "The Roadmap" },
  { id: "prompting", num: "06", label: "Prompting" },
  { id: "stacks", num: "07", label: "Stack Picker" },
  { id: "credits", num: "08", label: "Credit Trap" },
  { id: "checklist", num: "09", label: "Checklist" },
  { id: "incidents", num: "10", label: "Incidents" },
  { id: "handoff", num: "11", label: "Hiring & Handoff" },
  { id: "tools", num: "12", label: "Tool Index" },
  { id: "track", num: "13", label: "30-Day Track" },
  { id: "further", num: "14", label: "Glossary" },
  { id: "outro", num: "15", label: "End" },
];

function SideNav() {
  const [active, setActive] = useState("hero");

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setActive(e.target.id);
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    NAV.forEach(n => {
      const el = document.getElementById(n.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  function go(id) {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 20, behavior: "smooth" });
  }

  return (
    <aside className="sidenav">
      <div className="brand">
        <div className="brand-mark"></div>
        <div>
          <div className="brand-name">Vibe → Production</div>
          <div className="brand-sub">Roadmap · v1.0</div>
        </div>
      </div>
      <div className="nav-list">
        {NAV.map(n => (
          <div
            key={n.id}
            className={"nav-item" + (active === n.id ? " active" : "")}
            onClick={() => go(n.id)}
          >
            <span className="nav-num">{n.num}</span>
            <span>{n.label}</span>
          </div>
        ))}
      </div>
      <div className="nav-spacer"></div>
      <div className="nav-foot">
        © 2026 · Field guide for<br/>builders past the demo.
      </div>
    </aside>
  );
}

// ---------- APP ----------
function App() {
  return (
    <div className="app">
      <SideNav />
      <main className="main">
        <Hero />
        <Iceberg />
        <Pyramid />
        <ToolPicker />
        <Mindset />
        <Roadmap />
        <Prompting />
        <Stacks />
        <CreditTrap />
        <Checklist />
        <Incidents />
        <Handoff />
        <ToolIndex />
        <Track />
        <Glossary />
        <Outro />
        <Footer />
      </main>
      <CookieConsent />
    </div>
  );
}

// Render is driven by the public boot loader (boot.jsx) once the protected
// bundle has been authenticated and injected. mount.jsx wires the render hook.
window.__RoadmapApp = App;

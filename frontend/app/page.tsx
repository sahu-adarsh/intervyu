import Link from "next/link";
import {
  Mic, Code2, FileText, BarChart3, ArrowUpRight,
  Bot, Layers, AudioLines,
  BriefcaseBusiness,
} from "lucide-react";
import AuthRedirect from "@/components/AuthRedirect";

export const metadata = {
  title: "intervyu | AI mock interviewer",
  description:
    "intervyu gives candidates a full voice interview experience — live code evaluation, CV analysis, and a performance report. Practice the real thing.",
};

const FEATURES = [
  {
    icon: Mic,
    title: "AI runs the voice interview",
    description:
      "Neerja, our AI interviewer, conducts a fully conversational voice interview. She listens, follows up, and adapts to your answers in real time.",
  },
  {
    icon: Code2,
    title: "Live code evaluation",
    description:
      "Coding questions open an inline Monaco editor. Your code runs against real test cases and the results flow back to Neerja instantly.",
  },
  {
    icon: FileText,
    title: "CV and ATS analysis",
    description:
      "Upload your resume and get an ATS compatibility breakdown, skill gaps, and targeted questions based on exactly what you wrote.",
  },
  {
    icon: BarChart3,
    title: "Performance report",
    description:
      "Every session ends with a 5-dimension scored report — communication, technical depth, problem solving, behavioral fit, and a HIRE verdict.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Pick the interview type",
    description:
      "Choose from 8 interview tracks — SDE roles at Google, Amazon, and Microsoft, cloud architect interviews, CV grilling, or pure coding rounds.",
  },
  {
    number: "02",
    title: "Do a real voice interview",
    description:
      "Speak naturally. Neerja listens, follows up, and challenges your answers through every phase — just like the real thing.",
  },
  {
    number: "03",
    title: "Write and run code live",
    description:
      "When a coding question comes up, your editor opens inline. Submit, watch the tests run, and keep the conversation going.",
  },
  {
    number: "04",
    title: "Review your performance report",
    description:
      "Get dimension scores, strengths, areas to improve, and a final HIRE / NO HIRE verdict with supporting reasoning.",
  },
];

const PROOF = [
  {
    icon: Bot,
    stat: "8",
    desc: "Interview tracks covering engineering, cloud, behavioral, and coding roles.",
  },
  {
    icon: AudioLines,
    stat: "5",
    desc: "Scored dimensions in every performance report — not just a single number.",
  },
  {
    icon: BriefcaseBusiness,
    stat: "Real prep",
    desc: "Voice interview, live code editor, and CV analysis all in one session.",
  },
];

const INTERVIEW_TYPES = [
  { name: "Google SDE", tag: "Engineering" },
  { name: "Amazon SDE", tag: "Engineering" },
  { name: "Microsoft SDE", tag: "Engineering" },
  { name: "AWS Architect", tag: "Cloud" },
  { name: "Azure Architect", tag: "Cloud" },
  { name: "GCP Architect", tag: "Cloud" },
  { name: "CV Grilling", tag: "Behavioral" },
  { name: "Coding Round", tag: "Coding" },
];

export default function HomePage() {
  return (
    <>
      {/* Silently redirect logged-in users to /dashboard */}
      <AuthRedirect />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..800;1,6..72,300..800&family=Manrope:wght@400;500;600;700;800&display=swap');

        :root { --canvas: #ffffff; }

        body {
          font-family: 'Manrope', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .font-display {
          font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up {
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* wave bars animation */
        @keyframes wave {
          0%,100% { transform: scaleY(1); }
          50%      { transform: scaleY(1.8); }
        }
        .bar { animation: wave 1.2s ease-in-out infinite; transform-origin: bottom; }
        .bar:nth-child(2) { animation-delay:.1s; }
        .bar:nth-child(3) { animation-delay:.2s; }
        .bar:nth-child(4) { animation-delay:.15s; }
        .bar:nth-child(5) { animation-delay:.05s; }
        .bar:nth-child(6) { animation-delay:.25s; }
      `}</style>

      <main className="relative min-h-screen overflow-hidden bg-[var(--canvas)] text-slate-950">

        {/* Background — radial glow + grid */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_32%),linear-gradient(to_right,_rgba(99,102,241,0.06)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(99,102,241,0.06)_1px,_transparent_1px)] [background-size:auto,32px_32px,32px_32px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/80 to-transparent" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 pt-6 sm:px-8 lg:px-10">

          {/* ── NAV ─────────────────────────────────────────────────────────── */}
          <header className="fade-in-up flex items-center justify-between rounded-full border border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
                <img src="/logo-icon.svg" alt="Intervyu" className="h-6 w-6 brightness-0 invert" />
              </div>
              <span className="font-display text-xl font-semibold tracking-tight text-slate-950">
                inter<span className="text-indigo-600">vyu</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
              <a href="#features" className="transition hover:text-slate-950">Features</a>
              <a href="#story" className="transition hover:text-slate-950">Story</a>
              <a href="#proof" className="transition hover:text-slate-950">Proof</a>
              <Link href="/login" className="rounded-full bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-500">
                Try free
              </Link>
            </nav>
          </header>


          {/* ── HERO ────────────────────────────────────────────────────────── */}
          <section className="grid gap-14 pb-16 pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pt-20">

            {/* Left */}
            <div className="fade-in-up max-w-2xl space-y-8" style={{ animationDelay: "120ms" }}>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-indigo-200/80 bg-white/90 px-3 py-1 text-sm text-slate-700 shadow-[0_10px_30px_rgba(79,70,229,0.08)]">
                  <span className="inline-flex items-center gap-2">
                    <Bot className="h-4 w-4 text-indigo-600" aria-hidden />
                    AI voice interviewer
                  </span>
                </span>
                <span className="rounded-full border border-indigo-200/80 bg-white/90 px-3 py-1 text-sm text-slate-700 shadow-[0_10px_30px_rgba(79,70,229,0.08)]">
                  <span className="inline-flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-indigo-600" aria-hidden />
                    Live code evaluation
                  </span>
                </span>
                <span className="rounded-full border border-indigo-200/80 bg-white/90 px-3 py-1 text-sm text-slate-700 shadow-[0_10px_30px_rgba(79,70,229,0.08)]">
                  <span className="inline-flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" aria-hidden />
                    8 interview tracks
                  </span>
                </span>
                <span className="rounded-full border border-indigo-200/80 bg-white/90 px-3 py-1 text-sm text-slate-700 shadow-[0_10px_30px_rgba(79,70,229,0.08)]">
                  HIRE / NO HIRE verdict
                </span>
              </div>

              <div className="space-y-6">
                <h1 className="font-display max-w-3xl text-5xl leading-none tracking-[-0.04em] text-balance text-slate-950 sm:text-6xl lg:text-7xl">
                  The most realistic AI mock interviewer.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
                  intervyu gives candidates a full voice interview experience — with live code evaluation,
                  CV analysis, and a detailed performance report. Practice the real thing, not flashcards.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Start free <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-2 py-3 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
                >
                  See how it works <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>

            {/* Right — mock interview UI */}
            <div className="fade-in-up relative" style={{ animationDelay: "220ms" }}>
              <div className="absolute -left-10 top-8 h-36 w-36 rounded-full bg-indigo-200/80 blur-3xl" />
              <div className="absolute -right-4 bottom-10 h-44 w-44 rounded-full bg-indigo-100 blur-3xl" />
              <div className="relative rounded-[2rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_35px_90px_rgba(15,23,42,0.14)] backdrop-blur">
                <div className="mb-4 flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Interview session</p>
                    <p className="text-sm text-slate-500">Voice, code, and scoring in one loop.</p>
                  </div>
                  <div className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">Live</div>
                </div>

                <div className="space-y-4">
                  {/* AI interviewer panel */}
                  <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-900 px-5 py-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex items-end gap-[2px] h-4">
                        {[3,5,4,6,3,5,4].map((h, i) => (
                          <div key={i} className="bar w-[3px] rounded-sm bg-indigo-400" style={{ height: h * 3 }} />
                        ))}
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Neerja · AI Interviewer</span>
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                      &ldquo;Walk me through your approach to designing a rate limiter for a distributed system. What tradeoffs would you consider?&rdquo;
                    </p>
                    <p className="mt-3 text-xs text-slate-500">Listening…</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Performance report mock */}
                    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-3 rounded-[1.1rem] border border-slate-200 bg-slate-900 p-3">
                        <div className="flex items-end justify-between gap-1 mb-2">
                          {["Comm","Tech","PS","Beh","Code"].map((d, i) => (
                            <div key={d} className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-bold text-indigo-300">{[82,78,85,74,88][i]}</span>
                              <div className="w-5 h-12 rounded-sm bg-slate-800 flex items-end overflow-hidden">
                                <div
                                  className="w-full rounded-sm bg-indigo-600"
                                  style={{ height: `${[82,78,85,74,88][i]}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-slate-600">{d}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-700 pt-1.5">
                          <span className="text-[10px] text-slate-500">Overall · 81</span>
                          <span className="text-[10px] font-bold text-emerald-400">HIRE ✓</span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-950">Review candidate performance without bouncing between tools.</p>
                    </div>

                    {/* Code editor mock */}
                    <div className="rounded-[1.5rem] border border-slate-200 bg-indigo-50/70 p-4">
                      <div className="mb-4 rounded-[1.1rem] border border-indigo-200/70 bg-white p-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          <Code2 className="h-3 w-3 text-indigo-600" />
                          <span className="text-[10px] font-semibold text-slate-600">Python · Monaco</span>
                        </div>
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <div><span className="text-indigo-600">def</span> <span className="text-slate-800">rate_limit</span><span className="text-slate-500">(req):</span></div>
                          <div className="pl-3 text-slate-500">key = f<span className="text-emerald-700">&quot;rl:{"{"}req.ip{"}"}&quot;</span></div>
                          <div className="pl-3 text-slate-400">count = redis.incr(key)</div>
                          <div className="pl-3 text-slate-400">return count &lt;= limit</div>
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-emerald-600">3 / 3 tests passed</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-950">Code live, inside the interview itself.</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Async, high-signal prep</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>


          {/* ── FEATURES ────────────────────────────────────────────────────── */}
          <section id="features" className="grid gap-10 py-16 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">What It Does</p>
              <h2 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">
                Everything important happens before the first live interview.
              </h2>
              <p className="text-base leading-7 text-slate-600 sm:text-lg">
                The product stays focused: pick the interview, speak naturally, write code live, and review the output in one place.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                  <div className="mb-4 inline-flex rounded-2xl bg-indigo-100 p-3 text-indigo-700">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </section>


          {/* ── WORKFLOW ────────────────────────────────────────────────────── */}
          <section className="grid gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Workflow</p>
                <h2 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">
                  A complete interview loop in under an hour.
                </h2>
                <p className="text-base leading-7 text-slate-600 sm:text-lg">
                  The README is clear about the product shape, and the landing page should be too. This is the shortest useful explanation.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {["Next.js", "Supabase", "AWS Bedrock", "Deepgram", "Azure TTS", "FastAPI"].map((t) => (
                  <span key={t} className="rounded-full border border-indigo-200/80 bg-white/90 px-3 py-1 text-sm text-slate-700 shadow-[0_10px_30px_rgba(79,70,229,0.08)]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {STEPS.map(({ number, title, description }) => (
                <article key={number} className="flex gap-4 rounded-[1.6rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                    {number}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>


          {/* ── PROOF ───────────────────────────────────────────────────────── */}
          <section id="proof" className="grid gap-10 py-16 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Proof</p>
              <h2 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">
                The product already has the signals that matter.
              </h2>
              <p className="text-base leading-7 text-slate-600 sm:text-lg">
                A full voice interview, live code execution, and a HIRE verdict — not a quiz app. The depth shows up in the first session.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                {PROOF.map(({ icon: Icon, stat, desc }) => (
                  <article key={stat} className="rounded-[1.6rem] border border-slate-200/80 bg-white/90 p-5">
                    <div className="mb-4 inline-flex rounded-2xl bg-indigo-100 p-3 text-indigo-700">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{stat}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{desc}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Interview tracks</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {INTERVIEW_TYPES.map(({ name, tag }) => (
                    <span
                      key={name}
                      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                    >
                      {name}
                      <span className="ml-1.5 text-xs text-slate-400">· {tag}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>


          {/* ── STORY ───────────────────────────────────────────────────────── */}
          <section id="story" className="grid gap-8 py-16 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">Story</p>
              <h2 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">
                Why we built the most realistic interview simulator.
              </h2>
              <p className="text-base leading-7 text-slate-600 sm:text-lg">
                If you want the background behind the project, there is a short write-up that explains how it evolved from a simple idea to a full voice interview platform.
              </p>
            </div>
            <div className="rounded-[1.8rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <p className="font-display text-2xl leading-tight text-slate-950">
                From Leetcode grinders and text mock interviews to a full voice session with Neerja.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
                The story adds context around the product and the thinking behind intervyu, without needing to turn the landing page into a timeline.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 transition hover:text-indigo-600"
              >
                Try a free session <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>


          {/* ── CTA BAND ────────────────────────────────────────────────────── */}
          <section className="py-16">
            <div className="rounded-[2rem] border border-indigo-200/70 bg-indigo-600 px-6 py-8 text-white shadow-[0_28px_70px_rgba(79,70,229,0.32)] sm:px-8">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="max-w-2xl space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-100">Start practising</p>
                  <h2 className="font-display text-3xl leading-tight sm:text-4xl">
                    Try the interview yourself, or explore the app.
                  </h2>
                  <p className="text-base leading-7 text-indigo-50/90">
                    A session is enough to understand how intervyu works and whether it fits how you prepare for interviews.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    Start free session <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Sign in <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </section>


          {/* ── FOOTER ──────────────────────────────────────────────────────── */}
          <footer className="flex flex-col gap-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>intervyu is an AI-powered mock interviewer for job candidates.</p>
            <div className="flex items-center gap-4">
              <Link href="/login" className="transition hover:text-slate-950">App</Link>
              <a href="#features" className="transition hover:text-slate-950">Features</a>
              <a href="#story" className="transition hover:text-slate-950">Story</a>
              <a href="#proof" className="transition hover:text-slate-950">Proof</a>
            </div>
          </footer>

        </div>
      </main>
    </>
  );
}

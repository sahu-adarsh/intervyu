import Link from "next/link";
import {
  Mic,
  Code2,
  FileText,
  BarChart3,
  ArrowRight,
  Play,
  Check,
  Zap,
  Brain,
  Target,
  Star,
  ChevronRight,
} from "lucide-react";

export const metadata = {
  title: "intervyu.io — AI-Powered Interview Prep",
  description:
    "Practice real voice interviews with Neerja, get live code evaluation, CV analysis, and a detailed performance report. Land your dream job.",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Mic,
    label: "Voice AI Interview",
    title: "Speak with Neerja",
    description:
      "Have a fully conversational voice interview with our AI interviewer Neerja. Real-time speech recognition, natural turn-taking, and contextual follow-ups.",
    accent: "from-violet-500/10 to-indigo-500/10",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
  {
    icon: Code2,
    label: "Live Code Evaluation",
    title: "Code as you interview",
    description:
      "Solve coding challenges in a Monaco editor mid-interview. Your code gets executed, test cases run, and results fed back to Neerja in real time.",
    accent: "from-indigo-500/10 to-blue-500/10",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    icon: FileText,
    label: "CV / ATS Analysis",
    title: "Know your resume's score",
    description:
      "Upload your CV and get a breakdown of ATS compatibility, extracted skills, and gaps — so Neerja can grill you on exactly what matters.",
    accent: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    icon: BarChart3,
    label: "Performance Report",
    title: "A score you can act on",
    description:
      "Every session ends with a 5-dimension performance report — communication, problem solving, technical depth, behavioral fit, and overall recommendation.",
    accent: "from-purple-500/10 to-violet-500/10",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Create your session",
    description:
      "Pick an interview type, optionally upload your CV, and set your target role. Done in under 30 seconds.",
  },
  {
    number: "02",
    title: "Do a real voice interview",
    description:
      "Speak naturally — Neerja listens, follows up, challenges your answers, and guides you through every phase.",
  },
  {
    number: "03",
    title: "Write and run code live",
    description:
      "When a coding question comes up, your editor opens inline. Submit, watch tests pass, and keep the conversation going.",
  },
  {
    number: "04",
    title: "Receive your report",
    description:
      "Get a detailed PDF report with scores, strengths, weaknesses, and an overall HIRE / NO HIRE verdict.",
  },
];

const INTERVIEW_TYPES = [
  { name: "Google SDE", tag: "Algorithms + System Design", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { name: "Amazon SDE", tag: "Leadership Principles + Coding", color: "bg-orange-50 border-orange-200 text-orange-700" },
  { name: "Microsoft SDE", tag: "Problem Solving + Collaboration", color: "bg-teal-50 border-teal-200 text-teal-700" },
  { name: "AWS Architect", tag: "Cloud + Best Practices", color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
  { name: "Azure Architect", tag: "Enterprise Solutions", color: "bg-sky-50 border-sky-200 text-sky-700" },
  { name: "GCP Architect", tag: "Data Analytics + GCP", color: "bg-red-50 border-red-200 text-red-700" },
  { name: "CV Grilling", tag: "Resume Deep Dive + STAR", color: "bg-violet-50 border-violet-200 text-violet-700" },
  { name: "Coding Practice", tag: "Pure DSA + Optimization", color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
];

const COMPANIES = ["Google", "Amazon", "Microsoft", "Meta", "Apple", "Netflix", "Stripe", "Databricks"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* ── Global styles injected via <style> ──────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        :root {
          --font: 'Manrope', system-ui, sans-serif;
        }

        html { scroll-behavior: smooth; }

        body {
          font-family: var(--font);
          background: #ffffff;
          color: #0f172a;
          overflow-x: hidden;
        }

        /* ── Grid texture ──────────────────────────────────────────────────── */
        .grid-texture {
          background-image:
            linear-gradient(to right, #e2e8f0 1px, transparent 1px),
            linear-gradient(to bottom, #e2e8f0 1px, transparent 1px);
          background-size: 40px 40px;
        }

        /* ── Animations ────────────────────────────────────────────────────── */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes blobPulse {
          0%, 100% { transform: scale(1) translate(0, 0); }
          33%       { transform: scale(1.08) translate(20px, -15px); }
          66%       { transform: scale(0.95) translate(-15px, 20px); }
        }

        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        .animate-fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .animate-fade-in {
          opacity: 0;
          animation: fadeIn 0.5s ease forwards;
        }

        .delay-100 { animation-delay: 0.10s; }
        .delay-200 { animation-delay: 0.20s; }
        .delay-300 { animation-delay: 0.30s; }
        .delay-400 { animation-delay: 0.40s; }
        .delay-500 { animation-delay: 0.50s; }
        .delay-600 { animation-delay: 0.60s; }

        .blob {
          animation: blobPulse 9s ease-in-out infinite;
          filter: blur(80px);
          will-change: transform;
        }

        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker 28s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }

        /* ── Glassmorphism nav ─────────────────────────────────────────────── */
        .glass-nav {
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 4px 32px rgba(99, 102, 241, 0.06);
        }

        /* ── Feature cards ─────────────────────────────────────────────────── */
        .feature-card {
          transition: box-shadow 0.25s ease, transform 0.25s ease;
        }
        .feature-card:hover {
          box-shadow: 0 20px 48px rgba(99, 102, 241, 0.12);
          transform: translateY(-4px);
        }

        /* ── Reduced motion ────────────────────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up,
          .animate-fade-in {
            opacity: 1;
            animation: none;
          }
          .blob { animation: none; }
          .ticker-track { animation: none; }
        }
      `}</style>

      <div className="min-h-screen bg-white" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>

        {/* ══════════════════════════════════════════════════════════
            NAV — glassmorphism pill
        ══════════════════════════════════════════════════════════ */}
        <header className="fixed top-4 left-0 right-0 z-50 px-4">
          <nav className="glass-nav mx-auto max-w-5xl rounded-2xl px-5 py-3 flex items-center justify-between">
            {/* Logo */}
            <Link href="/landing" className="flex items-center gap-2 cursor-pointer">
              <span
                className="text-xl font-800 tracking-tight"
                style={{ fontWeight: 800 }}
              >
                <span className="text-violet-600">inter</span>
                <span className="text-slate-900">vyu</span>
                <span className="text-violet-500">.</span>
              </span>
            </Link>

            {/* Links */}
            <div className="hidden md:flex items-center gap-1">
              {["Features", "How it works", "Interview Types"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                  className="px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors duration-200 cursor-pointer"
                >
                  {item}
                </a>
              ))}
            </div>

            {/* CTA */}
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors duration-200 cursor-pointer"
            >
              Get Started
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </header>

        {/* ══════════════════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden grid-texture pt-20">
          {/* White fade over texture */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/50 to-white/80 pointer-events-none" />

          {/* Gradient blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="blob absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-25"
              style={{ background: "radial-gradient(circle, #8b5cf6, #6366f1)" }}
            />
            <div
              className="blob absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #6366f1, #3b82f6)", animationDelay: "3s" }}
            />
            <div
              className="blob absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-10"
              style={{ background: "radial-gradient(circle, #a78bfa, #818cf8)", animationDelay: "6s" }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
            {/* Pill badge */}
            <div className="animate-fade-in-up inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
              <Zap className="w-3 h-3" />
              AI-Powered Interview Practice
            </div>

            {/* Headline */}
            <h1
              className="animate-fade-in-up delay-100 text-5xl md:text-7xl font-800 leading-tight tracking-tight text-slate-900 mb-6"
              style={{ fontWeight: 800, lineHeight: 1.08 }}
            >
              Practice interviews
              <br />
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(135deg, #7c3aed, #6366f1, #3b82f6)" }}>
                like they&apos;re real.
              </span>
            </h1>

            {/* Sub */}
            <p className="animate-fade-in-up delay-200 text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10" style={{ lineHeight: 1.7 }}>
              Voice interviews with AI interviewer Neerja, live code evaluation,
              CV&nbsp;analysis, and a detailed performance report — all in one session.
            </p>

            {/* CTAs */}
            <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-base px-7 py-3.5 rounded-xl shadow-lg shadow-violet-200 hover:shadow-violet-300 transition-all duration-200 cursor-pointer"
              >
                Start for Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base px-7 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all duration-200 cursor-pointer"
              >
                <Play className="w-4 h-4 text-violet-500 fill-violet-500" />
                Watch Demo
              </Link>
            </div>

            {/* Mini social proof */}
            <div className="animate-fade-in-up delay-400 mt-12 flex items-center justify-center gap-3 text-sm text-slate-400">
              <div className="flex -space-x-2">
                {["V", "A", "R", "S", "M"].map((letter, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: ["#7c3aed", "#6366f1", "#3b82f6", "#8b5cf6", "#a78bfa"][i],
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <span>
                <strong className="text-slate-600 font-semibold">2,400+</strong> candidates practising this week
              </span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SOCIAL PROOF TICKER
        ══════════════════════════════════════════════════════════ */}
        <section className="py-12 border-y border-slate-100 bg-white overflow-hidden">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-8">
            Trusted by candidates interviewing at
          </p>
          <div className="ticker-track">
            {[...COMPANIES, ...COMPANIES].map((company, i) => (
              <div
                key={i}
                className="flex items-center gap-2 mx-10 text-slate-500 font-semibold text-base whitespace-nowrap"
              >
                <span className="w-2 h-2 rounded-full bg-violet-300 flex-shrink-0" />
                {company}
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            FEATURES GRID
        ══════════════════════════════════════════════════════════ */}
        <section id="features" className="py-28 px-4">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16 animate-fade-in-up">
              <span className="inline-block bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
                Everything you need
              </span>
              <h2 className="text-4xl md:text-5xl font-800 text-slate-900 mb-4" style={{ fontWeight: 800 }}>
                One platform,<br />
                <span className="text-violet-600">four superpowers</span>
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto" style={{ lineHeight: 1.7 }}>
                Every tool you need to go from nervous candidate to confident hire.
              </p>
            </div>

            {/* Cards — asymmetric 2-col layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {FEATURES.map((f, i) => (
                <div
                  key={f.label}
                  className={`feature-card animate-fade-in-up bg-gradient-to-br ${f.accent} border border-slate-100 rounded-2xl p-8 cursor-default delay-${(i + 1) * 100}`}
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${f.iconBg} mb-6`}>
                    <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                  </div>
                  <div className="inline-flex items-center gap-1.5 bg-white/70 border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                    {f.label}
                  </div>
                  <h3 className="text-xl font-700 text-slate-900 mb-3" style={{ fontWeight: 700 }}>
                    {f.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed" style={{ lineHeight: 1.75 }}>
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="py-28 px-4 bg-slate-50 grid-texture relative overflow-hidden">
          <div className="absolute inset-0 bg-slate-50/90 pointer-events-none" />

          <div className="relative max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-20 animate-fade-in-up">
              <span className="inline-block bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
                Simple process
              </span>
              <h2 className="text-4xl md:text-5xl font-800 text-slate-900 mb-4" style={{ fontWeight: 800 }}>
                From zero to offer-ready<br />
                <span className="text-violet-600">in four steps</span>
              </h2>
            </div>

            {/* Steps — offset layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {STEPS.map((step, i) => (
                <div
                  key={step.number}
                  className={`animate-fade-in-up bg-white rounded-2xl p-8 border border-slate-100 shadow-sm delay-${(i + 1) * 100} ${i % 2 === 1 ? "md:mt-10" : ""}`}
                >
                  <div
                    className="text-5xl font-800 mb-5"
                    style={{
                      fontWeight: 800,
                      backgroundImage: "linear-gradient(135deg, #c4b5fd, #e0e7ff)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {step.number}
                  </div>
                  <h3 className="text-lg font-700 text-slate-900 mb-3" style={{ fontWeight: 700 }}>
                    {step.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed" style={{ lineHeight: 1.75 }}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            INTERVIEW TYPES
        ══════════════════════════════════════════════════════════ */}
        <section id="interview-types" className="py-28 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16 animate-fade-in-up">
              <span className="inline-block bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
                8 interview types
              </span>
              <h2 className="text-4xl md:text-5xl font-800 text-slate-900 mb-4" style={{ fontWeight: 800 }}>
                Practice for the exact role<br />
                <span className="text-violet-600">you&apos;re going after</span>
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto" style={{ lineHeight: 1.7 }}>
                Neerja adapts her questions, depth, and evaluation criteria to each specific interview format.
              </p>
            </div>

            {/* Types grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {INTERVIEW_TYPES.map((type, i) => (
                <div
                  key={type.name}
                  className={`animate-fade-in-up border rounded-2xl p-5 cursor-default hover:shadow-md transition-shadow duration-200 delay-${Math.min((i + 1) * 100, 600)} ${type.color}`}
                >
                  <Target className="w-5 h-5 mb-3 opacity-60" />
                  <h3 className="font-700 text-sm mb-1.5" style={{ fontWeight: 700 }}>
                    {type.name}
                  </h3>
                  <p className="text-xs opacity-70 leading-relaxed">{type.tag}</p>
                </div>
              ))}
            </div>

            {/* Bottom stat row */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center animate-fade-in-up delay-400">
              {[
                { label: "Interview types", value: "8" },
                { label: "Avg. session duration", value: "45 min" },
                { label: "Questions per session", value: "12–20" },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-50 rounded-2xl py-8">
                  <div
                    className="text-4xl font-800 text-violet-600 mb-2"
                    style={{ fontWeight: 800 }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            TESTIMONIAL / TRUST STRIP
        ══════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
            <div className="flex items-center justify-center gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote
              className="text-2xl md:text-3xl font-700 text-slate-800 leading-snug mb-6"
              style={{ fontWeight: 700, lineHeight: 1.4 }}
            >
              &ldquo;I did 6 sessions before my Google onsite. Neerja asked
              harder questions than the actual interview. Got the offer.&rdquo;
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
              >
                R
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">Rohan M.</p>
                <p className="text-xs text-slate-500">SDE-2 @ Google · Delhi, India</p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            VALUE PROPS CHECKLIST
        ══════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-5 animate-fade-in-up">
              {[
                "Real-time voice conversation with AI interviewer",
                "No scheduling — start a session in under 60 seconds",
                "Code editor with test-case execution built in",
                "CV uploaded once, used across all sessions",
                "Detailed HIRE / NO HIRE performance report",
                "8 role-specific interview types",
                "Fully private — only you see your sessions",
                "Free to start, no credit card required",
              ].map((point, i) => (
                <div key={i} className={`flex items-start gap-3 animate-fade-in-up delay-${Math.min((i % 4 + 1) * 100, 400)}`}>
                  <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center">
                    <Check className="w-3 h-3 text-violet-600" strokeWidth={3} />
                  </div>
                  <span className="text-slate-600 text-sm font-medium leading-relaxed">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            CTA SECTION
        ══════════════════════════════════════════════════════════ */}
        <section className="py-28 px-4 relative overflow-hidden">
          {/* Gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, #4c1d95 0%, #4338ca 40%, #1d4ed8 100%)",
            }}
          />
          {/* Subtle grid over gradient */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          {/* Blobs */}
          <div
            className="blob absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }}
          />
          <div
            className="blob absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, #60a5fa, transparent)", animationDelay: "4s" }}
          />

          <div className="relative z-10 max-w-3xl mx-auto text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
              <Brain className="w-3 h-3" />
              AI Interview Coach
            </div>

            <h2
              className="text-4xl md:text-6xl font-800 text-white mb-6"
              style={{ fontWeight: 800, lineHeight: 1.1 }}
            >
              Your next offer starts<br />with one session.
            </h2>

            <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto" style={{ lineHeight: 1.7 }}>
              Stop reading guides. Start practising. Neerja is ready to interview you right now — no scheduling, no waiting.
            </p>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-violet-700 font-700 text-base px-8 py-4 rounded-xl shadow-xl shadow-black/20 transition-all duration-200 cursor-pointer"
              style={{ fontWeight: 700 }}
            >
              Start Practising Free
              <ArrowRight className="w-4 h-4" />
            </Link>

            <p className="mt-4 text-sm text-white/40">No credit card required</p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════════════════════ */}
        <footer className="bg-slate-900 text-slate-400 py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-12">
              {/* Brand */}
              <div className="max-w-xs">
                <div className="text-2xl font-800 mb-3" style={{ fontWeight: 800 }}>
                  <span className="text-violet-400">inter</span>
                  <span className="text-white">vyu</span>
                  <span className="text-violet-500">.</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-500">
                  AI-powered interview prep for software engineers and cloud architects.
                  Practice with Neerja. Land the offer.
                </p>
              </div>

              {/* Links */}
              <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
                {[
                  { label: "Home", href: "/landing" },
                  { label: "Features", href: "#features" },
                  { label: "How it works", href: "#how-it-works" },
                  { label: "Interview Types", href: "#interview-types" },
                  { label: "Start for Free", href: "/login" },
                  { label: "Sign in", href: "/login" },
                ].map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-slate-500 hover:text-white transition-colors duration-150 cursor-pointer"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600">
              <span>© 2026 intervyu.io — All rights reserved</span>
              <span>Built with AI, for engineers</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

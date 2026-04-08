# intervyu - Claude Code Context

## What This Project Is
**intervyu.io** is an AI-powered interview preparation platform. Candidates do real voice interviews with an AI interviewer (Neerja), get their code evaluated live, upload their CV, and receive a performance report at the end.

## Project Structure

```
intervyu/
├── frontend/                    # Next.js 15 (React 19, TypeScript, Tailwind CSS 4)
│   ├── app/
│   │   ├── page.tsx             # Home — interview type selection + dashboard
│   │   ├── layout.tsx           # Root layout (Geist fonts)
│   │   ├── login/               # OAuth login page (Google + GitHub)
│   │   ├── auth/callback/       # Supabase OAuth callback handler
│   │   ├── interview/new/       # Live interview session page
│   │   └── demo/                # Demo pages (code-editor, cv, performance)
│   ├── components/
│   │   ├── VoiceInterview.tsx   # Main voice interview + WebSocket logic
│   │   ├── Sidebar.tsx          # Nav sidebar with user avatar + sign-out
│   │   ├── home/
│   │   │   ├── InterviewCard.tsx
│   │   │   ├── StartInterviewModal.tsx
│   │   │   ├── PastInterviewsList.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   └── ScheduleModal.tsx
│   │   ├── code-editor/CodeEditor.tsx
│   │   ├── cv/CVUpload.tsx + CVAnalysisDisplay.tsx
│   │   ├── performance/PerformanceDashboard.tsx + InterviewHistory.tsx
│   │   └── common/PDFExport.tsx
│   └── lib/
│       ├── supabase/client.ts   # Supabase singleton client
│       ├── supabase/auth.ts     # useSupabaseSession, useRequireAuth, OAuth helpers
│       └── api.ts               # Centralised authFetch + all API helpers + buildWsUrl
│
├── backend/                     # FastAPI (Python 3.11)
│   └── app/
│       ├── main.py              # App init, CORS, router registration, DB pool lifespan
│       ├── routers/
│       │   ├── sessions.py      # POST /api/sessions, GET /api/sessions/{id}
│       │   ├── websocket.py     # WS /ws/interview/{session_id}?token=<jwt>
│       │   ├── interviews.py    # CV upload, transcript, end session, report
│       │   ├── code.py          # Code execution via Lambda
│       │   ├── analytics.py     # Aggregate stats, benchmarks, trends (PostgreSQL)
│       │   └── auth.py          # GET /api/auth/me
│       ├── services/
│       │   ├── bedrock_service.py   # Claude Haiku 4.5 via bedrock-runtime
│       │   ├── db_service.py        # asyncpg pool + all CRUD (replaces S3 JSON)
│       │   ├── auth_service.py      # Supabase JWT verification (PyJWT HS256)
│       │   ├── s3_service.py        # Binary files only: CVs, audio
│       │   ├── lambda_service.py    # Lambda invocation helper
│       │   └── textract_service.py  # CV text extraction + skill parsing
│       ├── dependencies/
│       │   └── auth.py              # CurrentUser dataclass + get_current_user Depends
│       ├── models/
│       │   ├── session.py           # Session Pydantic models
│       │   └── code_submission.py   # Code metrics & test result models
│       └── config/
│           ├── settings.py          # Env-var settings (incl. Supabase + DATABASE_URL)
│           ├── interview_types.py   # 8 interview configs + phases
│           └── agent_instruction.txt # Neerja persona system prompt
│
├── lambda-tools/                # AWS SAM — 3 Lambda functions
│   ├── code-executor/           # Sandboxed Python/JS execution
│   ├── cv-analyzer/             # Resume parsing + skill categorization
│   ├── performance-evaluator/   # Score calculation + report generation
│   └── template.yaml            # SAM CloudFormation template
│
├── database/                    # Supabase PostgreSQL (active)
│   ├── supabase_schema.sql      # Live schema (run in Supabase SQL Editor)
│   ├── schema.sql               # Original local schema (reference only)
│   ├── docker-compose.yml       # Local Postgres dev (optional)
│   ├── migrations/
│   │   └── 002_s3_to_postgres_migration.sql  # insert_session_from_json() for backfill
│   └── scripts/migrate_from_s3.py  # S3 → Supabase migration script
│
├── knowledge-base/              # RAG content for Bedrock Agent
├── deployment/                  # AWS deployment guides
├── scripts/                     # deploy-frontend.sh, deploy-backend.sh
└── docs/                        # Architecture, optimization notes
```

## Tech Stack

### Backend (FastAPI)
- **STT**: Deepgram Nova-2 API (cloud, persistent `httpx.AsyncClient` module-level singleton to `api.deepgram.com/v1/listen`)
- **TTS**: Azure Cognitive Services Speech SDK (`azure-cognitiveservices-speech`, `en-IN-NeerjaNeural` voice, MP3 output `Audio24Khz48KBitRateMonoMp3`, pool of 3 persistent `SpeechSynthesizer` instances, SSML `<prosody rate="+20%">`, MP3 chunks streamed via asyncio.Queue concurrent sender)
- **AI**: AWS bedrock-runtime `converse_stream` (Claude Haiku 4.5 — `us.anthropic.claude-haiku-4-5-20251001-v1:0`); conversation history managed manually in `_session_cache`
- **Auth**: Supabase JWT verification (`auth_service.py`, PyJWT HS256, `audience="authenticated"`); `get_current_user` FastAPI dependency on all endpoints; WebSocket auth via `?token=` query param
- **Storage**: Supabase PostgreSQL (structured data) + S3 `prepai-user-data-2026` (binary: CVs at `cvs/{session_id}/`, audio at `recordings/{session_id}/`)
- **DB Driver**: asyncpg pool (min=5, max=20) in `db_service.py`; transcript writes are asyncio background tasks (off WebSocket critical path)
- **CV Parsing**: AWS Textract + `prepai-cv-analyzer` Lambda
- **Real-time**: WebSocket at `/ws/interview/{session_id}?token=<supabase_jwt>`

### Frontend (Next.js 15)
- **Pages**: `/` (home/dashboard), `/login` (Google OAuth + email OTP), `/auth/callback` (OAuth handler), `/interview/new` (live session), `/demo/*` (feature demos)
- **Auth**: `@supabase/supabase-js` client-side only (static export); `useRequireAuth()` redirects to `/login`; JWT passed to backend via `Authorization: Bearer` header and `?token=` on WebSocket URL
- **Key libs**: Monaco Editor, Recharts, react-dropzone, html2canvas, jspdf, lucide-react, @supabase/supabase-js
- **WebSocket messages handled**: `transcript`, `llm_chunk`, `assistant_complete`, `coding_question`, `error`
- **Audio**: Silero VAD (`@ricky0123/vad-react`, ONNX model in Web Worker) → single WAV blob per utterance to backend; `onnxruntime-web` 1.17.3, `numThreads=1` (no SharedArrayBuffer/COOP/COEP required)

### AWS Lambda Functions (3)
1. `prepai-code-executor` — Python/JS sandboxed execution, test case runner
2. `prepai-cv-analyzer` — PDF/DOCX parsing, skills extraction by category
3. `prepai-performance-evaluator` — 5-dimension scoring, HIRE/NO_HIRE recommendation

## Deployment (Current — Production)

- **Frontend**: S3 (`prepai-frontend-1773670407`) + CloudFront (`EEQ8MGLCMSZXT`)
- **Custom Domain**: `https://intervyu.io` (Namecheap BasicDNS → CloudFront)
- **SSL**: ACM cert `b4030462-0a7e-4ede-a076-09da4f122dc2` attached to CloudFront
- **Backend**: EC2 `i-032c3535f7a8f1d89` (t3.small, Ubuntu), IP `44.200.25.1`, port 8000
- **EC2 SSH**: `ssh -i ~/.ssh/prepai-backend-key.pem ubuntu@44.200.25.1`
- **Restart backend**: `sudo systemctl restart intervyu-backend`
- **Redeploy frontend**: `cd intervyu && bash scripts/redeploy-frontend.sh` — do NOT use a bare `aws s3 sync` (see warning)
  ```bash
  cd frontend && npm run build
  # 1. Sync all static assets (hashed filenames — safe to cache)
  aws s3 sync out/ s3://prepai-frontend-1773670407/ --delete
  # 2. Force-upload HTML and RSC payload .txt files — sync skips these when file size
  #    is unchanged across builds (same-size files get identical ETags bypassed), which
  #    leaves stale RSC payloads pointing to deleted chunks → Link navigation silently
  #    breaks, buttons appear non-functional, SyntaxErrors on old chunks.
  find frontend/out -name "*.html" -o -name "*.txt" | while read f; do
    key="${f#frontend/out/}"
    aws s3 cp "$f" "s3://prepai-frontend-1773670407/$key" --cache-control "no-cache, no-store, must-revalidate"
  done
  aws cloudfront create-invalidation --distribution-id EEQ8MGLCMSZXT --paths "/*"
  ```
  **WARNING — `aws s3 sync` alone is not enough.** Next.js App Router generates `*.html` and
  `*.txt` (RSC payload) files alongside hashed JS chunks. When the JS chunk filenames change
  but the HTML/txt files happen to be the same byte-size, `sync` considers them unchanged and
  skips them. The stale files still reference the OLD chunk names, which get deleted by
  `--delete`. Result: CloudFront serves HTML/RSC payloads that load deleted chunks →
  `SyntaxError: Unexpected token '<'` (404 HTML served as JS) → entire page JS broken →
  buttons do nothing, PostHog never initialises. Always force-upload HTML + txt after build.
- **Lambda deploy**: `cd lambda-tools && sam build && sam deploy`

## Key APIs

All endpoints (except WS) require `Authorization: Bearer <supabase_access_token>`.

```
GET  /api/auth/me                         → returns {user_id, email, role}

POST /api/sessions                        → create session (returns session_id)
GET  /api/sessions/{session_id}           → get session

WS   /ws/interview/{session_id}?token=<jwt>  → voice interview (binary audio + JSON messages)

POST /api/interviews/{id}/upload-cv       → upload PDF/DOCX/TXT CV (S3 binary + DB analysis)
GET  /api/interviews/{id}/cv-analysis     → parsed CV data
GET  /api/interviews/{id}/transcript      → full conversation history
POST /api/interviews/{id}/end             → end session + generate performance report
GET  /api/interviews/{id}/performance-report

POST /api/code/execute                    → run code via Lambda
GET  /api/code/{session_id}/submissions   → all submissions
GET  /api/code/{session_id}/quality-summary

GET  /api/analytics/aggregate             → totals + completion rate + avg score (scoped to user)
GET  /api/analytics/benchmarks/{type}     → p25/p50/p75/p90 by interview type
GET  /api/analytics/trends?days=30        → daily score trends (scoped to user)
GET  /api/analytics/history               → full session history (scoped to user)
```

## WebSocket Protocol

**Client → Server (JSON):**
```
{ "type": "interview_ready" }
{ "type": "speech_start" }
{ "type": "speech_end" }
{ "type": "code_submission", "code": "...", "language": "python", "allTestsPassed": true, "testResults": [...] }
```
Binary frames = raw WebM/WAV audio chunks (sent between speech_start/speech_end)

**Server → Client (JSON):**
```
{ "type": "transcript", "text": "...", "role": "user", "is_final": true }
{ "type": "llm_chunk", "text": "..." }
{ "type": "assistant_complete", "text": "...", "role": "assistant" }
{ "type": "coding_question", "question": "...", "language": "python", "testCases": [...], "initialCode": "..." }
{ "type": "error", "message": "..." }
```
Binary frames = WAV TTS audio chunks

## Environment Variables

**Backend `backend/.env`:**
```
AWS_ACCESS_KEY=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_USER_DATA=prepai-user-data-2026
S3_BUCKET_KNOWLEDGE_BASE=prepai-knowledge-base-2026
BEDROCK_AGENT_ID=QWKJJLWIUO
BEDROCK_AGENT_ALIAS_ID=TSTALIASID
BEDROCK_KNOWLEDGE_BASE_ID=FGBOJOTC4C
DEEPGRAM_API_KEY=...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=eastus
LAMBDA_CODE_EXECUTOR=prepai-code-executor
LAMBDA_CV_ANALYZER=prepai-cv-analyzer
LAMBDA_PERFORMANCE_EVALUATOR=prepai-performance-evaluator
CORS_ORIGINS=http://localhost:3000,https://intervyu.io,https://www.intervyu.io
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
ENVIRONMENT=production
# Supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
```

**Frontend `frontend/.env.local`:**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Running Locally

```bash
# Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev

# Database (optional, local dev)
cd database && docker-compose up -d

# Lambda (deploy to AWS)
cd lambda-tools && sam build && sam deploy
```

## Database Schema (Supabase PostgreSQL — active)

Schema: `database/supabase_schema.sql` (run in Supabase SQL Editor)

Key tables: `interview_sessions`, `session_transcripts`, `code_submissions`, `performance_reports`, `cv_documents`, `cv_analysis`, `user_profiles`, `user_statistics`, `scheduled_interviews`, `interview_analytics`

All tables have RLS enabled. User data scoped via `auth.uid()`. `auth.users` managed by Supabase.

Storage split:
- **PostgreSQL**: all structured data (sessions, transcripts, code, reports, CV analysis)
- **S3**: binary files only — CVs at `cvs/{session_id}/`, audio at `recordings/{session_id}/`

## Current Phase

Phase 5 (Production) — live at `https://intervyu.io`:
- [x] Auth (Supabase JWT + Google OAuth + Email OTP)
- [x] Migrate storage from S3 JSON → Supabase PostgreSQL
- [x] Rate limiting (slowapi: 10/hr sessions, 5/hr CV upload, 30/hr code execution, 200/min global)
- [x] Report an Issue (Supabase `feedback` table, polished popover with success state)
- [ ] Redis caching (replace in-memory Bedrock session state cache — deferred; see Architecture Guide §5.8)

## Interview Types (8)

| Type | Key Focus |
|------|-----------|
| `google_sde` | Algorithms, data structures, system design |
| `amazon_sde` | Leadership principles, coding, behavioral |
| `microsoft_sde` | Problem solving, collaboration, design |
| `aws_solutions_architect` | Cloud architecture, AWS best practices |
| `azure_solutions_architect` | Azure services, enterprise solutions |
| `gcp_solutions_architect` | GCP services, data analytics |
| `cv_grilling` | Resume deep dive, STAR method |
| `coding_practice` | Pure coding problems, optimization |

Each type has configurable phases with duration targets and evaluation guidelines defined in `backend/app/config/interview_types.py`.

## Performance Notes
- **STT**: Deepgram Nova-2 API via persistent `httpx.AsyncClient` singleton — ~500–620ms stable (was 660–3726ms with per-call TCP+TLS)
- **STT + session fetch parallelised**: `asyncio.gather(transcribe_audio, _warm_session)` — session fetch is 0ms on critical path
- **Session cache in-place**: user+assistant turns appended to `_session_cache` after each turn; next turn's session fetch is a free dict lookup (0ms), no S3 re-read
- **LLM**: bedrock-runtime `converse_stream` → direct Claude Haiku 4.5 token streaming (replaced Bedrock Agent; no ~300ms Agent overhead)
- **TTS**: clause-split via `_find_tts_split()` (hard split at `.!?`, soft split at `,`/`;` when chunk >60 chars and remainder >20 chars); fired concurrently as tokens stream; asyncio.Queue `_audio_sender()` sends each MP3 to browser immediately upon completion; 263–476ms for short clauses, 866–1716ms for long clauses
- **TTS audio payload**: MP3 `Audio24Khz48KBitRateMonoMp3` — 13–55KB/chunk (was 95–283KB WAV with edge-tts)
- **S3 saves** are non-blocking (asyncio background tasks)
- **Silero VAD** (neural ONNX) replaces amplitude VAD — eliminates mid-sentence cut-offs; audio sent as single WAV blob per utterance
- **Hardcoded fast intro** hides any cold-start latency on session open
- **Bedrock connection pool**: 50 max connections with adaptive retries
- **End-to-end latency** (speech_end → first audio): ~1.7s first audio; ~2.9–4.0s last audio (scales with response length, 2026-03-27)

---

## Keeping Docs Up to Date

After any significant change, update these three files **in the same session**. They are gitignored — local only.

| File | What to update |
|------|---------------|
| `ARCHITECTURE_GUIDE.md` | Update the relevant section(s). If a design decision changes, update §5. If the pipeline changes, update §3 or §7. If a new service is added, update §2 and §6. |
| `OPTIMIZATION_CHANGES.md` | Prepend a new entry with: date, what changed, why, measured/estimated impact, files changed. |
| `CLAUDE.md` | Update Performance Notes, Project Structure, Tech Stack, or Key APIs if they've changed. |

### What counts as a "significant change" (update docs for all of these):
- Any change that measurably reduces end-to-end latency (>100ms)
- Replacing or upgrading a core service (STT, TTS, LLM, storage, auth)
- Adding or removing an API route, WebSocket message type, or Lambda function
- Changing the VAD/audio pipeline behavior
- Architectural shifts (e.g., S3 → PostgreSQL, in-memory → Redis)
- New interview types or major changes to existing phase configs
- Infrastructure changes (new EC2, CloudFront, domain, SSL)
- Any optimization you'd explain in a technical interview or design review

### What does NOT need a doc update:
- Bug fixes that don't change architecture or performance
- UI/copy changes
- Dependency version bumps with no behavior change
- Test additions

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

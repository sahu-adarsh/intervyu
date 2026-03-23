# intervyu - Claude Code Context

## What This Project Is
**intervyu.io** is an AI-powered interview preparation platform. Candidates do real voice interviews with an AI interviewer (Neerja), get their code evaluated live, upload their CV, and receive a performance report at the end.

## Project Structure

```
intervyu/
├── frontend/                    # Next.js 15 (React 19, TypeScript, Tailwind CSS 4)
│   ├── app/
│   │   ├── page.tsx             # Home — interview type selection
│   │   ├── layout.tsx           # Root layout (Geist fonts)
│   │   ├── interview/new/       # Live interview session page
│   │   └── demo/                # Demo pages (code-editor, cv, performance)
│   └── components/
│       ├── VoiceInterview.tsx   # Main voice interview + WebSocket logic
│       ├── code-editor/CodeEditor.tsx
│       ├── cv/CVUpload.tsx + CVAnalysisDisplay.tsx
│       ├── performance/PerformanceDashboard.tsx + InterviewHistory.tsx
│       └── common/PDFExport.tsx
│
├── backend/                     # FastAPI (Python 3.11)
│   └── app/
│       ├── main.py              # App init, CORS, router registration
│       ├── routers/
│       │   ├── sessions.py      # POST /api/sessions, GET /api/sessions/{id}
│       │   ├── websocket.py     # WS /ws/interview/{session_id} (822 lines)
│       │   ├── interviews.py    # CV upload, transcript, end session, report
│       │   ├── code.py          # Code execution via Lambda
│       │   └── analytics.py     # Aggregate stats, benchmarks, trends
│       ├── services/
│       │   ├── bedrock_service.py   # Claude Haiku 4.5 via Bedrock Agent
│       │   ├── s3_service.py        # Session/CV/audio storage
│       │   ├── lambda_service.py    # Lambda invocation helper
│       │   └── textract_service.py  # CV text extraction + skill parsing
│       ├── models/
│       │   ├── session.py           # Session Pydantic models
│       │   └── code_submission.py   # Code metrics & test result models
│       └── config/
│           ├── settings.py          # Env-var settings
│           ├── interview_types.py   # 8 interview configs + phases
│           └── agent_instruction.txt # Bedrock Agent system prompt (Neerja persona)
│
├── lambda-tools/                # AWS SAM — 3 Lambda functions
│   ├── code-executor/           # Sandboxed Python/JS execution
│   ├── cv-analyzer/             # Resume parsing + skill categorization
│   ├── performance-evaluator/   # Score calculation + report generation
│   └── template.yaml            # SAM CloudFormation template
│
├── database/                    # PostgreSQL (planned, schema ready)
│   ├── schema.sql               # 9 tables, 3 views, triggers
│   ├── docker-compose.yml       # Postgres 15 + pgAdmin 4
│   ├── migrations/              # 001_initial, 002_s3_to_postgres
│   └── scripts/migrate_from_s3.py
│
├── knowledge-base/              # RAG content for Bedrock Agent
├── deployment/                  # AWS deployment guides
├── scripts/                     # deploy-frontend.sh, deploy-backend.sh, deployment-info.txt
└── docs/                        # Architecture, optimization notes
```

## Tech Stack

### Backend (FastAPI)
- **STT**: faster-whisper (`small` model, Apple Silicon int8 quantized)
- **TTS**: edge-tts (`en-IN-NeerjaExpressiveNeural` voice, WAV chunks streamed)
- **AI**: AWS Bedrock Agent (Claude Haiku 4.5 — `us.anthropic.claude-haiku-4-5-20251001-v1:0`) + RAG Knowledge Base
- **Storage**: S3 (`prepai-user-data-2026`) — sessions JSON, CVs, audio, reports
- **CV Parsing**: AWS Textract + `prepai-cv-analyzer` Lambda
- **Real-time**: WebSocket at `/ws/interview/{session_id}`

### Frontend (Next.js 15)
- **Pages**: `/` (home), `/interview/new` (live session), `/demo/*` (feature demos)
- **Key libs**: Monaco Editor, Recharts, react-dropzone, html2canvas, jspdf, lucide-react
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
- **Restart backend**: `sudo systemctl restart prepai-backend`
- **Redeploy frontend**: `cd frontend && npm run build && aws s3 sync out/ s3://prepai-frontend-1773670407/ --delete && aws cloudfront create-invalidation --distribution-id EEQ8MGLCMSZXT --paths "/*"`
- **Lambda deploy**: `cd lambda-tools && sam build && sam deploy`

## Key APIs

```
POST /api/sessions                        → create session (returns session_id)
GET  /api/sessions/{session_id}           → get session
WS   /ws/interview/{session_id}           → voice interview (binary audio + JSON messages)

POST /api/interviews/{id}/upload-cv       → upload PDF/DOCX/TXT CV
GET  /api/interviews/{id}/cv-analysis     → parsed CV data
GET  /api/interviews/{id}/transcript      → full conversation history
POST /api/interviews/{id}/end             → end session + generate performance report
GET  /api/interviews/{id}/performance-report

POST /api/code/execute                    → run code via Lambda
GET  /api/code/{session_id}/submissions   → all submissions
GET  /api/code/{session_id}/quality-summary

GET  /api/analytics/aggregate             → totals + completion rate + avg score
GET  /api/analytics/benchmarks/{type}     → p25/p50/p75/p90 by interview type
GET  /api/analytics/trends?days=30        → daily score trends
GET  /api/analytics/candidate/{name}/history
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
WHISPER_MODEL=small
TTS_VOICE=en-IN-NeerjaExpressiveNeural
LAMBDA_CODE_EXECUTOR=prepai-code-executor
LAMBDA_CV_ANALYZER=prepai-cv-analyzer
LAMBDA_PERFORMANCE_EVALUATOR=prepai-performance-evaluator
CORS_ORIGINS=http://localhost:3000,https://intervyu.io,https://www.intervyu.io
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
ENVIRONMENT=production
```

**Frontend `frontend/.env.local`:**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
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

## Database Schema (PostgreSQL — not yet active)

9 tables: `candidates`, `sessions`, `transcript_messages`, `cv_documents`, `cv_analysis`, `code_submissions`, `test_case_results`, `performance_reports`, `audio_recordings`

3 views: `complete_sessions`, `candidate_performance_history`, `session_analytics` (materialized)

Current storage: S3 JSON. Migration script at `database/scripts/migrate_from_s3.py`.

## Current Phase

Phase 5 (Production) — live at `https://intervyu.io`:
- [ ] Auth (JWT/OAuth)
- [ ] Migrate storage from S3 JSON → PostgreSQL (`database/schema.sql`)
- [ ] Redis caching (replace in-memory Bedrock session state cache)
- [ ] Rate limiting

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
- Whisper model loads lazily on first request
- Bedrock connection pool: 50 max connections with adaptive retries
- TTS is sentence-chunked for low latency streaming
- S3 saves are non-blocking (asyncio background tasks)
- Hardcoded fast intro to avoid Bedrock cold start on session open
- Silero VAD (neural ONNX) replaces amplitude VAD — eliminates mid-sentence cut-offs; audio sent as single WAV blob per utterance

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

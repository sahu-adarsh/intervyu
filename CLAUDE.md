# intervyu - Claude Code Context

## What This Project Is
**intervyu.io** is an AI-powered interview preparation platform. Candidates do real voice interviews with an AI interviewer, get their code evaluated live, upload their CV, and receive a performance report at the end.

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
│       │   ├── bedrock_service.py   # Claude 3.5 Haiku via Bedrock Agent
│       │   ├── s3_service.py        # Session/CV/audio storage
│       │   ├── lambda_service.py    # Lambda invocation helper
│       │   └── textract_service.py  # CV text extraction + skill parsing
│       ├── models/
│       │   ├── session.py           # Session Pydantic models
│       │   └── code_submission.py   # Code metrics & test result models
│       └── config/
│           ├── settings.py          # Env-var settings
│           ├── interview_types.py   # 8 interview configs + phases
│           └── agent_instruction.txt # Bedrock Agent system prompt
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
├── deployment/                  # AWS deployment guides
├── knowledge-base/              # RAG content for Bedrock Agent
└── docs/                        # Architecture, optimization notes
```

## Tech Stack

### Backend (FastAPI)
- **STT**: faster-whisper (`small` model, Apple Silicon int8 quantized)
- **TTS**: edge-tts (`en-IN-NeerjaNeural` voice, WAV chunks streamed)
- **AI**: AWS Bedrock Agent (Claude 3.5 Haiku) + RAG Knowledge Base
- **Storage**: S3 (`prepai-user-data-2026`) — sessions JSON, CVs, audio, reports
- **CV Parsing**: AWS Textract + `prepai-cv-analyzer` Lambda
- **Real-time**: WebSocket at `/ws/interview/{session_id}`

### Frontend (Next.js 15)
- **Pages**: `/` (home), `/interview/new` (live session), `/demo/*` (feature demos)
- **Key libs**: Monaco Editor, Recharts, react-dropzone, html2canvas, jspdf, lucide-react
- **WebSocket messages handled**: `transcript`, `llm_chunk`, `assistant_complete`, `coding_question`, `error`
- **Audio**: MediaRecorder API → binary frames to backend; VAD silence detection (500ms)

### AWS Lambda Functions (3)
1. `prepai-code-executor` — Python/JS sandboxed execution, test case runner
2. `prepai-cv-analyzer` — PDF/DOCX parsing, skills extraction by category
3. `prepai-performance-evaluator` — 5-dimension scoring, HIRE/NO_HIRE recommendation

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

## Deployment

- **Frontend**: S3 + CloudFront (`E1QHM81F6DD5IR`, domain: `intervyu.io`)
- **Backend**: EC2 (`i-06959f5b800df8328`, Ubuntu, systemd `prepai-backend`, port 8000)
- **SSL**: ACM certificate + Route53 hosted zone
- **EC2 SSH**: `ssh -i ~/.ssh/prepai-backend-key.pem ubuntu@34.202.231.149`
- **Restart backend**: `sudo systemctl restart prepai-backend`
- **Lambda deploy**: `cd lambda-tools && sam build && sam deploy`

## Environment Variables

**Backend `backend/.env`:**
```
AWS_ACCESS_KEY=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_USER_DATA=prepai-user-data-2026
S3_BUCKET_KNOWLEDGE_BASE=prepai-knowledge-base-2026
BEDROCK_AGENT_ID=QWKJJLWIUO
BEDROCK_AGENT_ALIAS_ID=XLMJWHPALK
BEDROCK_KNOWLEDGE_BASE_ID=FGBOJOTC4C
WHISPER_MODEL=small
TTS_VOICE=en-IN-NeerjaNeural
LAMBDA_CODE_EXECUTOR=prepai-code-executor
LAMBDA_CV_ANALYZER=prepai-cv-analyzer
LAMBDA_PERFORMANCE_EVALUATOR=prepai-performance-evaluator
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
ENVIRONMENT=development
```

**Frontend `frontend/.env.local`:**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

**Database `database/.env` (local dev):**
```
DATABASE_URL=postgresql://prepai:prepai_dev_password@localhost:5432/prepai
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

## Database Schema (PostgreSQL — not yet active in backend)

9 tables: `candidates`, `sessions`, `transcript_messages`, `cv_documents`, `cv_analysis`, `code_submissions`, `test_case_results`, `performance_reports`, `audio_recordings`

3 views: `complete_sessions`, `candidate_performance_history`, `session_analytics` (materialized)

Current storage: S3 JSON. Migration script at `database/scripts/migrate_from_s3.py`.

## Current Phase
Phase 5 (Production) — in progress:
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

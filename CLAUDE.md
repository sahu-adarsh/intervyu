# PrepAI - Claude Code Context

## What This Project Is
PrepAI (branded as **intervyu.io**) is an AI-powered interview preparation platform. Candidates do real voice interviews with an AI interviewer, get their code evaluated live, upload their CV, and receive a performance report at the end.

## Project Structure

```
prepai/
├── frontend/          # Next.js 15 (React 19, TypeScript, Tailwind CSS 4)
├── backend/           # FastAPI (Python 3.11)
│   └── app/
│       ├── routers/   # sessions, interviews, code, analytics, websocket
│       ├── services/  # bedrock_service, s3_service, lambda_service, textract_service
│       └── models/    # session, code_submission
├── database/          # PostgreSQL schema (planned migration from S3 JSON)
├── lambda-tools/      # 3 AWS Lambda functions (SAM)
├── deployment/        # EC2 + CloudFront deployment guides
└── knowledge-base/    # RAG content for Bedrock Agent
```

## Tech Stack

### Backend (FastAPI)
- **STT**: faster-whisper (Apple Silicon optimized)
- **TTS**: edge-tts (`en-IN-NeerjaExpressiveNeural`)
- **AI**: AWS Bedrock Agent (Claude 3.5 Haiku) with RAG Knowledge Base
- **Storage**: S3 (`prepai-user-data` bucket) for sessions, CVs, reports
- **CV Parsing**: AWS Textract + Lambda
- **Real-time**: WebSocket at `/ws/interview/{session_id}`

### Frontend (Next.js 15)
- Pages: `/` (home), `/interview/new` (live session), `/demo/*`
- Key components: `VoiceInterview.tsx`, `CodeEditor.tsx`, `PerformanceDashboard.tsx`, `CVUpload.tsx`
- Code editor: Monaco Editor

### AWS Lambda Functions (3 functions)
1. `prepai-code-executor` — sandboxed code execution
2. `prepai-cv-analyzer` — resume parsing
3. `prepai-performance-evaluator` — scoring + report generation

## Deployment
- **Frontend**: S3 + CloudFront (`E1QHM81F6DD5IR`, domain: `intervyu.io`)
- **Backend**: EC2 (`i-06959f5b800df8328`, Ubuntu, systemd service `prepai-backend`)
- **SSL**: ACM certificate, Route53 hosted zone
- **EC2 SSH**: `ssh -i ~/.ssh/prepai-backend-key.pem ubuntu@34.202.231.149`
- **Restart backend**: `sudo systemctl restart prepai-backend`

## Key APIs
```
POST /api/sessions/create         → create interview session
WS   /ws/interview/{session_id}   → voice interview
POST /api/code/execute            → run code in Lambda
POST /api/interviews/{id}/upload-cv
POST /api/interviews/{id}/end     → generate performance report
GET  /api/analytics/aggregate
```

## Environment Variables
**Backend `.env`:**
```
AWS_REGION=us-east-1
BEDROCK_AGENT_ID=...
BEDROCK_AGENT_ALIAS_ID=...
S3_BUCKET_USER_DATA=prepai-user-data
```

**Frontend `.env.local`:**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Running Locally
```bash
# Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev

# Lambda (deploy)
cd lambda-tools && sam build && sam deploy
```

## Current Phase
Phase 5 (Production) — in progress:
- [ ] Auth (JWT/OAuth)
- [ ] Migrate storage from S3 JSON → PostgreSQL (schema in `database/schema.sql`)
- [ ] Redis caching
- [ ] Rate limiting

## Interview Types Supported
Google SDE, AWS SA, Azure SA, GCP SA, Microsoft SDE, Amazon SDE, Behavioral, Coding

# intervyu

**AI-powered mock interview platform.** Practice real voice interviews with an AI interviewer, get your code evaluated live, and receive a detailed performance report all in your browser.

🌐 **[intervyu.io](https://intervyu.io)**

![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900?style=flat&logo=amazon-aws)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)

---

## What It Does

- **Voice Interview** — Speak naturally with Neerja, an AI interviewer powered by Claude Haiku 4.5 via AWS bedrock-runtime. She adapts difficulty based on your answers.
- **Live Code Editor** — Monaco-based editor with sandboxed execution for coding questions. Supports Python and JavaScript.
- **CV Upload & Analysis** — Upload your resume (PDF/DOCX) for Neerja to reference during the interview.
- **Performance Report** — Get scored across 5 dimensions with a HIRE/NO_HIRE recommendation and percentile benchmarks.

---

## Interview Types

| Type | Focus |
|------|-------|
| Google SDE | Algorithms, data structures, system design |
| Amazon SDE | Leadership principles, coding, behavioral |
| Microsoft SDE | Problem solving, collaboration, design |
| AWS Solutions Architect | Cloud architecture, AWS best practices |
| Azure Solutions Architect | Azure services, enterprise solutions |
| GCP Solutions Architect | GCP services, data analytics |
| CV Grilling | Resume deep dive, STAR method |
| Coding Practice | Pure coding problems, optimization |

---

## Architecture

```
Browser
  │
  ├── HTTPS ──→ CloudFront (intervyu.io) ──→ S3 (Next.js static export)
  │
  └── WebSocket / REST ──→ EC2 (FastAPI, port 8000)
                                │
                      ┌─────────┼──────────────┐
                      │         │              │
              bedrock-runtime  Supabase     Lambda (×3)
              converse_stream  PostgreSQL   ├── code-executor
              (Claude Haiku    (sessions,   ├── cv-analyzer
               4.5, streaming) transcripts, └── performance-evaluator
                      │        reports)
                 Textract (CV parsing)      S3 (binary only:
                 Deepgram Nova-2 (STT)       CVs, audio)
                 Azure Speech SDK (TTS)
                 Supabase Auth (JWT)
```

**Voice pipeline**: Silero VAD → Deepgram STT (~300–800ms) + session fetch in parallel → Claude Haiku 4.5 stream → per-clause TTS (splits at `,`/`;` for long chunks) → browser plays MP3 immediately. Typical latency: ~1.7s speech_end → first audio; ~2.9–4.0s last audio.

**Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4, Monaco Editor, Recharts

**Backend**: FastAPI (Python 3.11), Deepgram Nova-2 (STT), Azure Speech SDK (TTS), WebSockets

**AWS**: bedrock-runtime (Claude Haiku 4.5), S3 (binary files), Lambda (SAM), Textract, CloudFront, ACM, EC2

**Auth**: Supabase (Google + GitHub OAuth, JWT, PostgreSQL with RLS)

---

## Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- AWS account with Bedrock, S3, Lambda access

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # fill in your AWS credentials and resource IDs

uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### Frontend

```bash
cd frontend
npm install
npm run copy-vad-assets   # copies Silero VAD ONNX models from node_modules

cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
EOF

npm run dev
# → http://localhost:3000
```

### Lambda Functions (deploy to AWS)

```bash
cd lambda-tools
sam build && sam deploy
```

---

## API Reference

```
POST /api/sessions                         Create interview session
GET  /api/sessions/{id}                    Get session details

WS   /ws/interview/{session_id}            Real-time voice interview

POST /api/interviews/{id}/upload-cv        Upload resume (PDF/DOCX/TXT)
GET  /api/interviews/{id}/cv-analysis      Get parsed CV data
GET  /api/interviews/{id}/transcript       Full conversation transcript
POST /api/interviews/{id}/end              End session + generate report
GET  /api/interviews/{id}/performance-report

POST /api/code/execute                     Run code (sandboxed via Lambda)
GET  /api/code/{session_id}/submissions    All code submissions
GET  /api/code/{session_id}/quality-summary

GET  /api/analytics/aggregate              Platform-wide stats
GET  /api/analytics/benchmarks/{type}      Percentile scores by interview type
GET  /api/analytics/trends?days=30         Score trends over time
GET  /api/analytics/candidate/{name}/history
```

---

## Environment Variables

**`backend/.env`**

```env
AWS_ACCESS_KEY=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

S3_BUCKET_USER_DATA=

DEEPGRAM_API_KEY=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=eastus

LAMBDA_CODE_EXECUTOR=prepai-code-executor
LAMBDA_CV_ANALYZER=prepai-cv-analyzer
LAMBDA_PERFORMANCE_EVALUATOR=prepai-performance-evaluator

CORS_ORIGINS=http://localhost:3000,https://intervyu.io
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development

# Supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
```

**`frontend/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Deployment

### Frontend (S3 + CloudFront)

```bash
cd frontend && npm run build
aws s3 sync out/ s3://YOUR_BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_CF_ID --paths "/*"
```

### Backend (EC2)

```bash
# Copy .env to server
scp -i ~/.ssh/your-key.pem backend/.env ubuntu@YOUR_EC2_IP:/home/ubuntu/intervyu/backend/.env

# Restart service
ssh -i ~/.ssh/your-key.pem ubuntu@YOUR_EC2_IP "sudo systemctl restart intervyu-backend"
```
---

## CI/CD

GitHub Actions workflows auto-deploy on push to `main`:

- **`deploy-frontend.yml`** — installs deps, runs `copy-vad-assets`, builds with production env vars, syncs to S3, invalidates CloudFront
- **`deploy-backend.yml`** — SSHes to EC2, pulls latest, restarts systemd service

---

## Backlog

- Redis caching (replace in-memory EC2 Bedrock session cache)
- Rate limiting
- PastInterviewsList: pull from Supabase API instead of localStorage

---

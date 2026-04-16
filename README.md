# intervyu.io

### AI-powered mock interview platform for voice interviews, live coding, and real-time performance feedback.

🌐 **[Try it live → intervyu.io](https://intervyu.io)**

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi)
![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900?style=flat&logo=amazon-aws)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat&logo=supabase)

---

## The Problem

Mock interviews are broken. Practicing with a friend is awkward and unreliable. Interview coaching is expensive. LeetCode doesn't simulate the pressure of speaking out loud, explaining your thought process, or being asked follow-ups in real time. Candidates go into interviews underprepared, not because they don't know the content, but because they've never actually practiced the format.

---

## The Solution

intervyu.io puts you in a real interview. You speak, and an AI interviewer named Neerja listens, responds, and adapts to your answers. She can give you coding problems to solve live in a Monaco editor with sandboxed test execution. You upload your CV and she can grill you on it. When the session ends, a performance report scores you across 5 dimensions and tells you whether you'd be hired.

Eight interview types (Google SDE, Amazon SDE, AWS/Azure/GCP Solutions Architect, CV Grilling, and more), each with a distinct persona and evaluation criteria.

---

## Preview

<!-- Dashboard -->
> **Dashboard: pick your interview type and track past sessions**

_[screenshot]_

---

<!-- Live Interview -->
> **Live voice interview: speak naturally, Neerja responds in ~1.7s**

_[screenshot]_

---

<!-- Code Editor -->
> **In-interview code editor: Monaco + sandboxed execution + live test results**

_[screenshot]_

---

<!-- CV Upload -->
> **CV upload & analysis: upload once, Neerja references it throughout**

_[screenshot]_

---

<!-- Performance Report -->
> **Performance report: 5-dimension scores, HIRE/NO_HIRE, percentile benchmarks**

_[screenshot]_

---

## How It Works

**1. Speech detection**
Silero VAD (neural ONNX model, Web Worker) detects true speech boundaries client-side, eliminating the false cuts you get with amplitude thresholds. Each utterance is encoded to a single WAV blob and sent over a persistent WebSocket.

**2. Transcription + session fetch in parallel**
The backend fires Deepgram Nova-2 STT and a session cache lookup simultaneously via `asyncio.gather`. STT resolves in ~500–620ms via a persistent `httpx` singleton (TCP+TLS reused across calls). The session is almost always already in-memory, so that lookup costs 0ms.

**3. LLM streaming**
Claude Haiku 4.5 via AWS bedrock-runtime `converse_stream` starts returning tokens in ~850ms. Conversation history is managed directly (no Bedrock Agent overhead). Neerja adapts difficulty, asks follow-ups, and drives structured interview phases defined per type.

**4. Concurrent TTS**
As tokens stream in, the backend splits at sentence/clause boundaries and fires Azure Cognitive Services (`en-IN-NeerjaNeural`, MP3) concurrently for each chunk, using a pool of 3 persistent `SpeechSynthesizer` instances. An `asyncio.Queue` sender pushes each MP3 chunk to the browser the moment it's ready.

**Result: ~1.7s speech_end → first audio. ~2.9–4.0s for a full response.**

---

## Architecture

```
Browser (Next.js 15)
│
│  WAV audio blob ──────────────────────────────────────┐
│  JSON control messages (speech_start, speech_end)     │
│  REST calls: Authorization: Bearer <supabase_jwt>     │
│                                                        ▼
│                                    FastAPI  ·  EC2 t3.small  ·  port 8000
│                                    ├── WebSocket /ws/interview/{id}?token=<jwt>
│                                    │     ├── Deepgram Nova-2  (STT, persistent httpx)
│                                    │     ├── bedrock-runtime  (Claude Haiku 4.5, streaming)
│                                    │     └── Azure Speech SDK (TTS → MP3 chunks, pool of 3)
│                                    └── REST /api/*
│                                          ├── Supabase PostgreSQL  (sessions, transcripts, reports)
│                                          ├── S3  (CV files, audio recordings)
│                                          └── Lambda ×3  (code executor · cv analyzer · perf evaluator)
│
│  ◄── MP3 audio chunks (binary WebSocket frames)
│  ◄── JSON (transcript · llm_chunk · assistant_complete · coding_question)
│
├── CloudFront + S3  (static Next.js export at intervyu.io)
├── Supabase  (Google OAuth + Email OTP · JWT · PostgreSQL with RLS)
└── AWS Textract  (CV PDF/DOCX parsing)
```

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

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Monaco Editor, Recharts |
| **Backend** | FastAPI (Python 3.11), WebSockets, asyncpg, asyncio |
| **AI / ML** | Claude Haiku 4.5 (AWS Bedrock), Deepgram Nova-2 (STT), Azure Speech `en-IN-NeerjaNeural` (TTS), Silero VAD (ONNX) |
| **Infra** | EC2, CloudFront, S3, Lambda (SAM), Textract, ACM |
| **Auth / DB** | Supabase (Google OAuth + Email OTP, JWT, PostgreSQL with RLS) |

---

## 🚀 Installation

### Prerequisites
- Python 3.11+, Node.js 18+
- AWS account with Bedrock, S3, Lambda, Textract access
- Supabase project
- Deepgram API key, Azure Speech key

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in credentials
uvicorn app.main:app --reload
# → http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run copy-vad-assets   # copies Silero VAD ONNX models
cp .env.local.example .env.local   # set API URLs + Supabase keys
npm run dev
# → http://localhost:3000
```

### Lambda Functions
```bash
cd lambda-tools
sam build && sam deploy          # deploy to AWS
# or for local dev:
sam build && sam local start-lambda --port 3001
# then set LAMBDA_ENDPOINT_URL=http://127.0.0.1:3001 in backend/.env
```

---

🌐 **[intervyu.io](https://intervyu.io)**

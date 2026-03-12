# intervyu - AI-Powered Interview Preparation Platform

![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900?style=flat&logo=amazon-aws)
![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11.14-blue?style=flat&logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)

Real-time voice-enabled AI interview preparation platform powered by AWS Bedrock, featuring live conversation practice, code execution, CV analysis, and comprehensive performance analytics.

## Features

- **Voice Conversations** - Real-time Speech-to-Text and Text-to-Speech via WebSocket streaming
- **8 Interview Types** - Google/Amazon/Microsoft SDE, AWS/Azure/GCP Solutions Architect, Behavioral, Coding
- **Live Code Editor** - Monaco editor with code execution, test cases, and quality metrics
- **CV Analysis** - PDF/DOCX parsing with AWS Textract and industry-specific skill extraction
- **Performance Analytics** - Percentile benchmarks, trend analysis, and detailed reports
- **AI Agent** - Claude 3 Haiku with 3 specialized Lambda action groups

## Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Deploy Lambda Functions
```bash
cd lambda-tools
sam build
sam deploy --guided --capabilities CAPABILITY_NAMED_IAM
```

### 4. Configure Bedrock Agent
- Create agent with Claude 3 Haiku model
- Add action groups: `CodeExecutor`, `CVAnalyzer`, `PerformanceEvaluator`
- Attach Lambda ARNs from SAM deployment output
- Update agent instructions (see `condensed-agent-instructions.txt`)

## Architecture

```
┌─────────────┐      WebSocket       ┌──────────────┐
│   Next.js   │ ◄──────────────────► │   FastAPI    │
│   Frontend  │                      │   Backend    │
└─────────────┘                      └───────┬──────┘
                                             │
                 ┌───────────────────────────┼────────────────┐
                 │                           │                │
            ┌────▼────┐               ┌──────▼─────┐   ┌──────▼──────┐
            │ Bedrock │               │    S3      │   │   Lambda    │
            │  Agent  │               │  Storage   │   │  Functions  │
            └─────────┘               └────────────┘   └─────────────┘
```

## Tech Stack

- **Frontend:** Next.js 15.5, React 19, TypeScript, TailwindCSS, Monaco Editor, Recharts
- **Backend:** FastAPI, Python 3.12, WebSockets, Boto3
- **AI/ML:** AWS Bedrock (Claude 3 Haiku), AWS Textract
- **Serverless:** AWS Lambda, SAM CLI
- **Storage:** AWS S3

## Demo Pages

Visit `http://localhost:3000/demo` to explore:
- CV Upload & Analysis
- Code Editor with Test Runner
- Performance Dashboard & History

## API Endpoints

- **Sessions:** `POST /api/sessions`, `GET /api/sessions/{id}`, `DELETE /api/sessions/{id}`
- **Interviews:** `POST /api/interviews/{id}/start`, `POST /api/interviews/{id}/upload-cv`
- **Code:** `POST /api/code/execute`, `GET /api/code/{id}/submissions`
- **Analytics:** `GET /api/analytics/aggregate`, `GET /api/analytics/benchmarks/{type}`
- **WebSocket:** `ws://localhost:8000/ws/{session_id}`

## Configuration

### Environment Variables
```bash
# Backend (.env)
AWS_REGION=us-east-1
S3_BUCKET_USER_DATA=prepai-user-data
BEDROCK_AGENT_ID=your-agent-id
BEDROCK_AGENT_ALIAS_ID=your-alias-id

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```
---

Built with AWS Bedrock Agents | Real-time Voice AI Interview Practice
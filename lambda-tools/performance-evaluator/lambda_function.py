"""
Performance Evaluator Lambda Function
Uses Claude Sonnet 4.6 via AWS Bedrock to generate genuine, transcript-grounded evaluations.
Falls back to heuristic scoring if the LLM call fails.
"""

import json
import os
import re
import boto3
from typing import Dict, Any, List, Optional
from datetime import datetime

# ─── AWS clients ──────────────────────────────────────────────────────────────

s3_client = boto3.client('s3')
bedrock_client = boto3.client(
    'bedrock-runtime',
    region_name=os.environ.get('BEDROCK_AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.environ.get('BEDROCK_AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('BEDROCK_AWS_SECRET_ACCESS_KEY'),
)

# Claude Sonnet 4.6 cross-region inference
EVALUATION_MODEL_ID = 'us.anthropic.claude-sonnet-4-6'

INTERVIEW_TYPE_LABELS: Dict[str, str] = {
    'google_sde': 'Google SDE Interview',
    'amazon_sde': 'Amazon SDE Interview',
    'microsoft_sde': 'Microsoft SDE Interview',
    'aws_solutions_architect': 'AWS Solutions Architect Interview',
    'azure_solutions_architect': 'Azure Solutions Architect Interview',
    'gcp_solutions_architect': 'GCP Solutions Architect Interview',
    'cv_grilling': 'Behavioral / CV Review Interview',
    'coding_practice': 'Coding Practice Session',
}

SCORE_WEIGHTS = {
    'technicalKnowledge': 0.30,
    'problemSolving': 0.25,
    'communication': 0.20,
    'codeQuality': 0.15,
    'culturalFit': 0.10,
}

# ─── Entry point ──────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    try:
        is_bedrock_agent = 'messageVersion' in event
        if is_bedrock_agent:
            params = {p['name']: p['value'] for p in event.get('parameters', [])}
            body = event.get('requestBody', {}).get('content', {}).get('application/json', {})
            if isinstance(body, str):
                body = json.loads(body)
            params = {**body, **params}
        else:
            params = event

        session_id = params.get('sessionId')
        if not session_id:
            return _fmt(event, {'success': False, 'error': 'sessionId is required'}, 400)

        report = _generate_report(params)

        if params.get('saveToS3', True):
            _save_to_s3(session_id, report)

        return _fmt(event, report, 200)

    except Exception as e:
        print(f'[ERROR] lambda_handler: {e}')
        return _fmt(event, {'success': False, 'error': str(e)}, 500)


def _fmt(event, body, status_code=200):
    if 'messageVersion' in event:
        return {
            'messageVersion': '1.0',
            'response': {
                'actionGroup': event.get('actionGroup', ''),
                'apiPath': event.get('apiPath', ''),
                'httpMethod': event.get('httpMethod', 'POST'),
                'httpStatusCode': status_code,
                'responseBody': {'application/json': {'body': json.dumps(body)}},
            },
        }
    return {'statusCode': status_code, 'body': json.dumps(body)}


# ─── Report generation ────────────────────────────────────────────────────────

def _generate_report(params: Dict[str, Any]) -> Dict[str, Any]:
    session_id = params.get('sessionId')
    raw_type = params.get('interviewType', '')
    type_label = INTERVIEW_TYPE_LABELS.get(raw_type, raw_type.replace('_', ' ').title() or 'Technical Interview')
    candidate_name = params.get('candidateName', 'Candidate')
    history = params.get('conversationHistory', [])
    code_submissions = params.get('codeSubmissions', [])
    duration = int(params.get('duration', 0) or 0)

    evaluation = None
    try:
        evaluation = _llm_evaluation(type_label, candidate_name, history, code_submissions, duration)
    except Exception as e:
        print(f'[WARN] LLM evaluation failed ({e}), using heuristic fallback')

    if evaluation is None:
        evaluation = _heuristic_evaluation(history, code_submissions)

    overall = _weighted_score(evaluation['scores'])

    return {
        'success': True,
        'sessionId': session_id,
        'candidateName': candidate_name,
        'interviewType': raw_type,
        'timestamp': datetime.utcnow().isoformat(),
        'duration': duration,
        'overallScore': round(overall, 1),
        'scores': {k: round(float(v), 1) for k, v in evaluation['scores'].items()},
        'strengths': evaluation['strengths'],
        'improvements': evaluation['improvements'],
        'recommendation': evaluation['recommendation'],
        'detailedFeedback': evaluation['detailed_feedback'],
        'metrics': {
            'totalQuestions': _count_questions(history),
            'codeSubmissions': len(code_submissions),
            'averageResponseTime': 30.0,
        },
    }


# ─── LLM evaluation via Claude Sonnet 4.6 ────────────────────────────────────

def _llm_evaluation(
    type_label: str,
    candidate_name: str,
    history: List[Dict],
    code_submissions: List[Dict],
    duration: int,
) -> Optional[Dict]:
    """Call Claude Sonnet 4.6 to generate a genuine, transcript-grounded evaluation."""

    if not history:
        return None

    # Format transcript
    lines = []
    for msg in history:
        role = 'Interviewer' if msg.get('role') == 'assistant' else candidate_name
        content = (msg.get('content') or '').strip()
        if content:
            lines.append(f'{role}: {content}')
    transcript = '\n\n'.join(lines)

    # Format code submissions
    code_block = ''
    if code_submissions:
        parts = []
        for i, sub in enumerate(code_submissions, 1):
            status = '✓ All tests passed' if sub.get('allTestsPassed') else '✗ Tests failed'
            lang = sub.get('language', 'unknown')
            code_snippet = (sub.get('code') or 'N/A')[:600]
            parts.append(f'--- Submission {i} ({lang}) {status} ---\n{code_snippet}')
        code_block = '\n\nCODE SUBMISSIONS:\n' + '\n'.join(parts)

    dur_str = f'{duration // 60}m {duration % 60}s' if duration > 0 else 'N/A'

    prompt = f"""You are an expert technical interview evaluator conducting rigorous, fair assessments.

INTERVIEW DETAILS
Type: {type_label}
Candidate: {candidate_name}
Duration: {dur_str}

FULL TRANSCRIPT
{transcript}{code_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read the entire transcript carefully. Your evaluation must be specific — reference actual things the candidate said or did. Never give generic feedback.

SCORING DIMENSIONS (0.0–10.0):
• technicalKnowledge — Depth, accuracy, and correctness of technical answers. Domain expertise demonstrated.
• problemSolving — Systematic thinking, reasoning process, edge-case awareness, optimization instinct.
• communication — Clarity, structure, completeness. Ability to articulate ideas under pressure.
• codeQuality — Code correctness, efficiency, readability. Use 5.0 if no code was submitted.
• culturalFit — Enthusiasm, growth mindset, professional demeanor, alignment with role.

RECOMMENDATION:
• STRONG_HIRE — Clear top performer, above the bar
• HIRE — Strong candidate, would move forward
• INCONCLUSIVE — Mixed signals, would need further assessment
• NO_HIRE — Below expectations for this role
• STRONG_NO_HIRE — Significantly below bar

STRENGTHS & IMPROVEMENTS FORMAT:
Each item must follow this exact format: "Short Title: Specific explanation that references what the candidate actually said or did in the interview."
Provide 2–4 strengths and 2–4 improvement areas. Be honest — if the interview was poor, most items should be improvements.

INTERVIEWER OBSERVATIONS:
Write 4–6 sharp, honest observations about this candidate. Think like a senior engineer who just sat in the interview and is writing a private debrief note for the hiring committee.

Rules:
- Each observation has a 3–6 word title that names the exact pattern (e.g. "Deflected Every Follow-up Question", "Strong Instinct for Edge Cases", "Vague on System Scalability", "Recovered Well Under Pressure")
- Each body is exactly 1 sentence. Quote or paraphrase what the candidate actually said. No generic statements — if you cannot point to a specific moment in the transcript, do not write the observation.
- Be blunt. Do not soften criticism. If the candidate only said "hello" repeatedly, say that plainly.
- Cover a mix: behavioral patterns, technical substance, communication quality, pressure handling.
- Do NOT organize observations by the 5 scoring dimensions. Organize by what actually happened.

BOTTOM LINE:
Write exactly 1 sentence giving the honest overall verdict — name the single biggest factor that determined this outcome.

RESPONSE FORMAT:
Respond with ONLY the JSON object inside <evaluation> tags. No explanation before or after.
The detailed_feedback field must be a JSON string (escaped) containing observations and bottom_line.

<evaluation>
{{
  "scores": {{
    "technicalKnowledge": X.X,
    "problemSolving": X.X,
    "communication": X.X,
    "codeQuality": X.X,
    "culturalFit": X.X
  }},
  "recommendation": "HIRE",
  "strengths": [
    "Title: Specific observation from the actual transcript."
  ],
  "improvements": [
    "Title: Specific actionable recommendation based on what was observed."
  ],
  "detailed_feedback": "{{\\\"bottom_line\\\": \\\"2-3 sentence honest verdict.\\\", \\\"observations\\\": [{{\\\"title\\\": \\\"Pattern Title\\\", \\\"body\\\": \\\"2-3 sentences referencing the transcript.\\\"}}, {{\\\"title\\\": \\\"Another Pattern\\\", \\\"body\\\": \\\"2-3 sentences.\\\"}}, {{\\\"title\\\": \\\"Another Pattern\\\", \\\"body\\\": \\\"2-3 sentences.\\\"}}, {{\\\"title\\\": \\\"Another Pattern\\\", \\\"body\\\": \\\"2-3 sentences.\\\"}}]}}"
}}
</evaluation>"""

    response = bedrock_client.converse(
        modelId=EVALUATION_MODEL_ID,
        messages=[{'role': 'user', 'content': [{'text': prompt}]}],
        inferenceConfig={'maxTokens': 3000, 'temperature': 0.2},
    )

    raw_text = response['output']['message']['content'][0]['text']

    # Extract JSON from <evaluation> tags
    match = re.search(r'<evaluation>\s*([\s\S]*?)\s*</evaluation>', raw_text)
    raw_json = match.group(1).strip() if match else raw_text.strip()

    data = json.loads(raw_json)

    # Validate + clamp scores
    scores = data.get('scores', {})
    for key in ['technicalKnowledge', 'problemSolving', 'communication', 'codeQuality', 'culturalFit']:
        scores[key] = max(0.0, min(10.0, float(scores.get(key, 5.0))))

    # Validate recommendation
    valid = {'STRONG_HIRE', 'HIRE', 'INCONCLUSIVE', 'NO_HIRE', 'STRONG_NO_HIRE'}
    rec = (data.get('recommendation') or 'INCONCLUSIVE').upper().strip()
    if rec not in valid:
        rec = 'INCONCLUSIVE'

    return {
        'scores': scores,
        'recommendation': rec,
        'strengths': [s for s in data.get('strengths', []) if s][:5],
        'improvements': [s for s in data.get('improvements', []) if s][:5],
        'detailed_feedback': data.get('detailed_feedback', ''),
    }


# ─── Heuristic fallback ───────────────────────────────────────────────────────

def _heuristic_evaluation(history: List[Dict], code_submissions: List[Dict]) -> Dict:
    """Rule-based fallback used only when LLM is unavailable."""
    scores = {
        'technicalKnowledge': _h_technical(history),
        'problemSolving': _h_problem_solving(history, code_submissions),
        'communication': _h_communication(history),
        'codeQuality': _h_code_quality(code_submissions) if code_submissions else 5.0,
        'culturalFit': _h_cultural_fit(history),
    }
    overall = _weighted_score(scores)
    strengths, improvements = [], []
    labels = {
        'technicalKnowledge': 'Technical Knowledge',
        'problemSolving': 'Problem Solving',
        'communication': 'Communication',
        'codeQuality': 'Code Quality',
        'culturalFit': 'Cultural Fit',
    }
    for k, v in scores.items():
        lbl = labels[k]
        if v >= 8.0:
            strengths.append(f'{lbl}: Demonstrated strong performance in this dimension.')
        elif v < 6.0:
            improvements.append(f'{lbl}: Further development recommended in this area.')
    if not strengths:
        strengths = ['Performance: Completed the interview and demonstrated baseline competency.']
    if not improvements:
        improvements = ['Continuous Improvement: Keep practicing to maintain and strengthen performance.']

    rec = _h_recommend(overall)
    feedback_lines = []
    for k, lbl in labels.items():
        v = scores[k]
        level = 'exceptional' if v >= 8.5 else 'strong' if v >= 7.0 else 'developing' if v >= 5.5 else 'needs improvement'
        feedback_lines += [f'{lbl}:', f'Scored {v:.1f}/10 — {level} performance.', '']
    feedback_lines += ['Overall Assessment:', f'Overall score of {overall:.1f}/10. {rec.replace("_", " ").title()} recommendation.']

    return {
        'scores': scores,
        'recommendation': rec,
        'strengths': strengths[:4],
        'improvements': improvements[:4],
        'detailed_feedback': '\n'.join(feedback_lines),
    }


def _h_technical(history):
    user_msgs = [m for m in history if m.get('role') == 'user']
    if not user_msgs: return 5.0
    kw = ['algorithm', 'complexity', 'data structure', 'optimize', 'scalability', 'database',
          'api', 'architecture', 'pattern', 'aws', 'cloud', 'cache', 'hash', 'tree', 'graph',
          'sort', 'binary', 'recursion', 'dynamic', 'O(n)', 'O(log', 'amortized']
    total, n = 0, 0
    for m in user_msgs[-10:]:
        c = m.get('content', '').lower()
        words = len(c.split())
        s = 8 if words > 50 else 7 if words > 30 else 6 if words > 15 else 5
        s += min(sum(1 for k in kw if k in c) * 0.4, 2)
        total += min(s, 10); n += 1
    return round(total / n if n else 5.0, 1)


def _h_problem_solving(history, code_submissions):
    s = 5.0
    if code_submissions:
        passed = sum(1 for x in code_submissions if x.get('allTestsPassed'))
        s = 4 + (passed / len(code_submissions)) * 6
    kw = ['approach', 'strategy', 'solution', 'optimize', 'tradeoff', 'edge case',
          'complexity', 'efficient', 'alternative', 'brute force', 'greedy']
    text = ' '.join(m.get('content', '').lower() for m in history if m.get('role') == 'user')
    cnt = sum(1 for k in kw if k in text)
    s += 1.0 if cnt > 5 else 0.5 if cnt > 2 else 0
    return round(min(s, 10), 1)


def _h_communication(history):
    responses = [m for m in history if m.get('role') == 'user']
    if not responses: return 5.0
    total, n = 0, 0
    for m in responses:
        words = len((m.get('content') or '').split())
        total += 8 if 20 <= words <= 100 else 5 if words < 10 else 6 if words > 150 else 7
        n += 1
    return round(total / n if n else 5.0, 1)


def _h_code_quality(code_submissions):
    if not code_submissions: return 5.0
    total, n = 0, 0
    for s in code_submissions:
        score = 8.0 if s.get('allTestsPassed') else 5.0
        if s.get('executionTime', 0) < 0.1: score += 1
        elif s.get('executionTime', 0) > 1.0: score -= 0.5
        if s.get('error'): score = min(score, 6)
        total += score; n += 1
    return round(total / n if n else 5.0, 1)


def _h_cultural_fit(history):
    words = ['learn', 'grow', 'collaborate', 'team', 'feedback', 'challenge',
             'passionate', 'excited', 'interested', 'improve', 'curious']
    text = ' '.join(m.get('content', '').lower() for m in history if m.get('role') == 'user')
    return round(min(6.0 + sum(1 for w in words if w in text) * 0.3, 10), 1)


def _h_recommend(score):
    if score >= 8.5: return 'STRONG_HIRE'
    if score >= 7.5: return 'HIRE'
    if score >= 6.0: return 'INCONCLUSIVE'
    if score >= 4.5: return 'NO_HIRE'
    return 'STRONG_NO_HIRE'


# ─── Shared helpers ───────────────────────────────────────────────────────────

def _weighted_score(scores: Dict[str, float]) -> float:
    return sum(scores.get(k, 0) * w for k, w in SCORE_WEIGHTS.items())


def _count_questions(history: List[Dict]) -> int:
    return sum(1 for m in history if m.get('role') == 'assistant' and '?' in (m.get('content') or ''))


def _save_to_s3(session_id: str, report: Dict) -> None:
    try:
        bucket = os.environ.get('S3_BUCKET_USER_DATA', 'prepai-user-data-2026')
        key = f'reports/{session_id}/performance_report.json'
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(report, indent=2),
            ContentType='application/json',
        )
        report['reportUrl'] = f's3://{bucket}/{key}'
    except Exception as e:
        print(f'[WARN] S3 save failed: {e}')


# ─── Local test ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    test = {
        'sessionId': 'test-001',
        'candidateName': 'Aisha Khan',
        'interviewType': 'google_sde',
        'duration': 1800,
        'conversationHistory': [
            {'role': 'assistant', 'content': 'Hi Aisha! Tell me about yourself and your experience with distributed systems.'},
            {'role': 'user', 'content': 'I have 3 years at Stripe building payment processing pipelines. We used Kafka for event streaming and Redis for idempotency keys. I designed a system that handled 50k TPS with sub-100ms p99 latency.'},
            {'role': 'assistant', 'content': 'Great! Can you implement a function to find the k-th largest element in an array?'},
            {'role': 'user', 'content': 'Sure. Naive approach is sort and index in O(n log n). But we can do better with a min-heap of size k — that\'s O(n log k). Or QuickSelect gives O(n) average, O(n²) worst case. For this problem I\'d use the heap approach since k is usually small.'},
        ],
        'codeSubmissions': [],
        'saveToS3': False,
    }
    result = lambda_handler(test, None)
    print(json.dumps(json.loads(result['body']), indent=2))

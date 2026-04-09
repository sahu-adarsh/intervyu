"""
CV Analyzer Lambda Function
Uses Claude Sonnet 4.6 (via Bedrock) for accurate structured CV parsing.
Falls back to regex extraction if Bedrock is unavailable.
"""

import json
import boto3
import re
import os
import logging
from typing import Dict, Any, List
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

s3_client = boto3.client('s3')


def get_bedrock_client():
    """Create Bedrock Runtime client using Textract account credentials."""
    key_id = os.environ.get('BEDROCK_AWS_ACCESS_KEY_ID', '')
    secret = os.environ.get('BEDROCK_AWS_SECRET_ACCESS_KEY', '')
    region = os.environ.get('BEDROCK_AWS_REGION', 'us-east-1')

    if key_id and secret:
        return boto3.client(
            'bedrock-runtime',
            region_name=region,
            aws_access_key_id=key_id,
            aws_secret_access_key=secret
        )
    # Fallback: use Lambda execution role credentials
    return boto3.client('bedrock-runtime', region_name=region)


def lambda_handler(event, context):
    try:
        is_bedrock_agent = 'messageVersion' in event

        if is_bedrock_agent:
            parameters = {p['name']: p['value'] for p in event.get('parameters', [])}
            request_body = event.get('requestBody', {}).get('content', {}).get('application/json', {})
            if isinstance(request_body, str):
                request_body = json.loads(request_body)
            params = {**request_body, **parameters}
        else:
            params = event

        cv_text = params.get('cvText', '')

        if not cv_text:
            s3_bucket = params.get('s3Bucket')
            s3_key = params.get('s3Key')
            if not s3_bucket or not s3_key:
                return format_response(event, {'success': False, 'error': 'Either cvText or s3Bucket+s3Key required'}, 400)
            cv_text = download_cv_from_s3(s3_bucket, s3_key)

        # Run both Claude calls in parallel — cuts total time roughly in half
        with ThreadPoolExecutor(max_workers=2) as pool:
            f_analysis = pool.submit(analyze_cv_with_claude, cv_text)
            f_corrections = pool.submit(generate_corrections_with_claude, cv_text)
            analysis = f_analysis.result()
            corrections = f_corrections.result()

        analysis['corrections'] = corrections
        return format_response(event, analysis, 200)

    except Exception as e:
        logger.error(f"Lambda error: {e}", exc_info=True)
        return format_response(event, {'success': False, 'error': f'Analysis error: {str(e)}'}, 500)


def analyze_cv_with_claude(cv_text: str) -> Dict[str, Any]:
    """
    Parse CV text using Claude Sonnet 4.6 for accurate structured extraction.
    Falls back to regex if Bedrock call fails.
    """
    prompt = f"""You are a CV/resume parser. Extract structured information from the following CV text and return ONLY a valid JSON object with no extra text or markdown.

CV TEXT:
{cv_text[:8000]}

Return this exact JSON structure:
{{
  "success": true,
  "candidateName": "full name or null",
  "email": "email address or null",
  "phone": "phone number or null",
  "summary": "2-sentence professional summary based on their experience and skills",
  "totalYearsExperience": <number, calculate from work history dates, 0 if unclear>,
  "skills": ["list", "of", "technical", "skills", "extracted"],
  "technologies": ["same", "as", "skills"],
  "experience": [
    {{
      "duration": "YYYY-YYYY or YYYY-Present",
      "company": "company name",
      "role": "job title",
      "context": "brief description of responsibilities"
    }}
  ],
  "education": [
    {{
      "degree": "degree type",
      "institution": "university/school name",
      "year": "graduation year or period",
      "context": "field of study"
    }}
  ]
}}

Rules:
- Extract ALL technical skills mentioned anywhere in the CV
- For totalYearsExperience: sum up actual working years (exclude education, internships under 6 months)
- If a field is not found, use null for strings and [] for arrays
- Return ONLY the JSON, no markdown, no explanation"""

    try:
        bedrock = get_bedrock_client()
        response = bedrock.invoke_model(
            modelId='us.anthropic.claude-haiku-4-5-20251001',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 2000,
                'messages': [{'role': 'user', 'content': prompt}]
            }),
            contentType='application/json',
            accept='application/json'
        )
        result = json.loads(response['body'].read())
        text = result['content'][0]['text'].strip()

        # Strip markdown code fences if present
        if text.startswith('```'):
            text = re.sub(r'^```[a-z]*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)

        analysis = json.loads(text)
        analysis['success'] = True
        return analysis

    except Exception as e:
        logger.error(f"Claude parsing failed, falling back to regex: {e}")
        return analyze_cv_regex_fallback(cv_text)


def generate_corrections_with_claude(cv_text: str) -> Dict[str, Any]:
    """
    Second Claude call: analyze CV for 9 types of corrections.
    Uses Haiku (faster, cheaper) — corrections are pattern-matching tasks
    that don't require Sonnet-level reasoning.
    Each correction item includes the exact verbatim text for PDF highlighting.
    Returns empty checkers list on any failure so upload is never blocked.
    """
    prompt = f"""You are a professional resume reviewer. Analyze the following resume and identify issues across exactly 9 dimensions.

CRITICAL RULES:
1. The "text" field in every item MUST be an exact verbatim substring copied from the resume text below. Do not paraphrase or summarize. This text will be used to highlight that exact excerpt in the PDF.
2. Keep "text" to a single bullet point or sentence — not the entire paragraph.
3. Return ONLY valid JSON, no markdown, no explanation.

Return this exact JSON structure:
{{
  "checkers": [
    {{
      "id": "quantification",
      "label": "Quantification Checker",
      "description": "Bullet points that lack measurable metrics, numbers, or percentages",
      "needsFix": [{{"text": "<exact verbatim bullet>", "issue": "Missing quantifiable metric", "suggestion": "Add a specific number, percentage, or scale"}}],
      "good": [{{"text": "<exact verbatim bullet>", "issue": ""}}],
      "score": <0-100 based on % of bullets that have metrics>
    }},
    {{
      "id": "bullet_length",
      "label": "Bullet Point Length",
      "description": "Bullets that are too long (>25 words) or too short (<5 words)",
      "needsFix": [{{"text": "<exact verbatim bullet>", "issue": "Too long — 32 words" or "Too short — 3 words", "suggestion": "..."}}],
      "good": [{{"text": "<exact verbatim bullet>", "issue": ""}}],
      "score": <0-100>
    }},
    {{
      "id": "bullet_improver",
      "label": "Bullet Points Improver",
      "description": "Weak or generic bullet points that lack impact or specificity",
      "needsFix": [{{"text": "<exact verbatim bullet>", "issue": "Generic description", "suggestion": "<specific improved version>"}}],
      "good": [{{"text": "<exact verbatim bullet>", "issue": ""}}],
      "score": <0-100>
    }},
    {{
      "id": "verb_tense",
      "label": "Verb Tense Checker",
      "description": "Wrong verb tense: past roles must use past tense, current role must use present tense",
      "needsFix": [{{"text": "<exact verbatim bullet>", "issue": "Present tense used for past job" or "Past tense used for current job", "suggestion": "<corrected text>"}}],
      "good": [{{"text": "<exact verbatim bullet>", "issue": ""}}],
      "score": <0-100>
    }},
    {{
      "id": "weak_verb",
      "label": "Weak Verb Checker",
      "description": "Bullets starting with weak verbs like 'Worked on', 'Helped', 'Assisted', 'Supported', 'Participated in'",
      "needsFix": [{{"text": "<exact verbatim bullet>", "issue": "Weak opening verb: 'Helped'", "suggestion": "Replace with strong verb like 'Led', 'Built', 'Delivered'"}}],
      "good": [{{"text": "<exact verbatim bullet>", "issue": ""}}],
      "score": <0-100>
    }},
    {{
      "id": "section_checker",
      "label": "Section Checker",
      "description": "Missing or poorly labeled resume sections",
      "needsFix": [{{"text": "<section header or first line of the problematic section>", "issue": "Section 'Summary' is missing", "suggestion": "Add a professional summary section"}}],
      "good": [{{"text": "<section header>", "issue": ""}}],
      "score": <0-100>
    }},
    {{
      "id": "skill_checker",
      "label": "Skill Checker",
      "description": "Missing important skills for the candidate's target role based on their experience",
      "needsFix": [{{"text": "<relevant section header or nearby text>", "issue": "Missing skill: Docker", "suggestion": "Add Docker if you have experience with it"}}],
      "good": [{{"text": "<skill or skills section text>", "issue": ""}}],
      "score": <0-100>
    }},
    {{
      "id": "repetition",
      "label": "Repetition Checker",
      "description": "Repeated words, phrases, or action verbs used too many times",
      "needsFix": [{{"text": "<exact verbatim sentence containing the repeated word>", "issue": "'Developed' used 5 times", "suggestion": "Vary with: Built, Engineered, Created, Designed"}}],
      "good": [],
      "score": <0-100>
    }},
    {{
      "id": "spelling",
      "label": "Spelling Checker",
      "description": "Spelling errors and typos found in the resume",
      "needsFix": [{{"text": "<exact verbatim sentence containing the error>", "issue": "Misspelling: 'recieve' should be 'receive'", "suggestion": "receive"}}],
      "good": [],
      "score": <0-100>
    }}
  ],
  "generatedAt": "{datetime.utcnow().isoformat()}Z"
}}

RESUME TEXT:
{cv_text[:8000]}"""

    try:
        bedrock = get_bedrock_client()
        response = bedrock.invoke_model(
            modelId='us.anthropic.claude-haiku-4-5-20251001',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 4000,
                'messages': [{'role': 'user', 'content': prompt}]
            }),
            contentType='application/json',
            accept='application/json'
        )
        result = json.loads(response['body'].read())
        text = result['content'][0]['text'].strip()

        if text.startswith('```'):
            text = re.sub(r'^```[a-z]*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)

        corrections = json.loads(text)
        return corrections

    except Exception as e:
        logger.error(f"Corrections generation failed (non-fatal): {e}")
        return {
            "checkers": [],
            "generatedAt": datetime.utcnow().isoformat() + "Z"
        }


def analyze_cv_regex_fallback(text: str) -> Dict[str, Any]:
    """Regex-based fallback if Claude is unavailable."""
    return {
        'success': True,
        'candidateName': extract_name(text),
        'email': extract_email(text),
        'phone': extract_phone(text),
        'skills': extract_skills_keywords(text),
        'technologies': extract_skills_keywords(text),
        'experience': extract_experience(text),
        'education': extract_education(text),
        'totalYearsExperience': calculate_years_experience(text),
        'summary': generate_summary(text)
    }


def format_response(event: Dict, body: Dict, status_code: int = 200) -> Dict:
    is_bedrock_agent = 'messageVersion' in event
    if is_bedrock_agent:
        return {
            "messageVersion": "1.0",
            "response": {
                "actionGroup": event.get('actionGroup', ''),
                "apiPath": event.get('apiPath', ''),
                "httpMethod": event.get('httpMethod', 'POST'),
                "httpStatusCode": status_code,
                "responseBody": {"application/json": {"body": json.dumps(body)}}
            }
        }
    return {'statusCode': status_code, 'body': json.dumps(body)}


def download_cv_from_s3(bucket: str, key: str) -> str:
    response = s3_client.get_object(Bucket=bucket, Key=key)
    file_content = response['Body'].read()
    if key.lower().endswith('.pdf'):
        return extract_text_from_pdf(file_content)
    return file_content.decode('utf-8')


def extract_text_from_pdf(pdf_content: bytes) -> str:
    try:
        import pypdf
        import io
        pdf_reader = pypdf.PdfReader(io.BytesIO(pdf_content))
        return '\n'.join(p.extract_text() or '' for p in pdf_reader.pages)
    except Exception as e:
        raise Exception(f'PDF extraction failed: {str(e)}')


# ── Regex fallback helpers ────────────────────────────────────────────────────

def extract_name(text: str) -> str:
    lines = text.strip().split('\n')
    for line in lines[:5]:
        line = line.strip()
        if line and len(line) < 50 and '@' not in line and not re.match(r'^\+?\d', line):
            return line
    return "Name not found"


def extract_email(text: str) -> str:
    match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', text)
    return match.group(0) if match else None


def extract_phone(text: str) -> str:
    for pattern in [r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', r'\+?\d{10,15}']:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None


def extract_skills_keywords(text: str) -> List[str]:
    skill_keywords = [
        'Python', 'JavaScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'TypeScript',
        'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'React', 'Angular', 'Vue',
        'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Next.js',
        'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'DynamoDB', 'Elasticsearch',
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'Terraform',
        'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Pandas',
        'NumPy', 'Scikit-learn', 'Git', 'REST API', 'GraphQL', 'Microservices',
        'CI/CD', 'Linux', 'Bash', 'GenAI', 'LLM', 'Bedrock', 'SageMaker'
    ]
    text_lower = text.lower()
    return [s for s in skill_keywords if s.lower() in text_lower]


def extract_experience(text: str) -> List[Dict[str, str]]:
    experiences = []
    section = extract_section(text, ['experience', 'work history', 'employment'])
    if section:
        for match in re.finditer(r'(\d{4})\s*[-–]\s*(\d{4}|Present|Current)', section, re.IGNORECASE):
            ctx_start = max(0, match.start() - 150)
            ctx_end = min(len(section), match.end() + 200)
            experiences.append({
                'duration': f"{match.group(1)}-{match.group(2)}",
                'context': section[ctx_start:ctx_end].strip()[:200]
            })
    return experiences[:5]


def extract_education(text: str) -> List[Dict[str, str]]:
    education = []
    section = extract_section(text, ['education', 'academic', 'qualification'])
    if section:
        for keyword in ['B.Tech', 'B.E.', 'M.Tech', 'M.S.', 'B.S.', 'MBA', 'PhD', 'Bachelor', 'Master']:
            if keyword.lower() in section.lower():
                idx = section.lower().find(keyword.lower())
                ctx = section[max(0, idx - 50): min(len(section), idx + 150)].strip()
                education.append({'degree': keyword, 'context': ctx})
    return education[:3]


def extract_section(text: str, keywords: List[str]) -> str:
    text_lower = text.lower()
    for kw in keywords:
        idx = text_lower.find(kw)
        if idx != -1:
            return text[idx: min(len(text), idx + 1000)]
    return ""


def calculate_years_experience(text: str) -> float:
    current_year = datetime.now().year
    total = 0
    for match in re.finditer(r'(\d{4})\s*[-–]\s*(\d{4}|Present|Current)', text, re.IGNORECASE):
        start = int(match.group(1))
        end_str = match.group(2).lower()
        end = current_year if end_str in ('present', 'current') else int(end_str)
        years = end - start
        if 0 < years < 50:
            total += years
    return round(total, 1)


def generate_summary(text: str) -> str:
    skills = extract_skills_keywords(text)
    years = calculate_years_experience(text)
    if years > 0 and skills:
        return f"Experienced professional with {years} years in {', '.join(skills[:3])}"
    elif skills:
        return f"Technical professional with skills in {', '.join(skills[:3])}"
    return "Professional candidate"


if __name__ == '__main__':
    test_cv = """
    John Doe
    john.doe@example.com | +1-555-123-4567

    EXPERIENCE
    Senior Software Engineer, Tech Corp (2020 - Present)
    - Developed microservices using Python and AWS

    EDUCATION
    B.Tech Computer Science, MIT (2018)

    SKILLS
    Python, JavaScript, React, AWS, Docker, PostgreSQL
    """
    result = lambda_handler({'cvText': test_cv}, None)
    print(json.dumps(json.loads(result['body']), indent=2))
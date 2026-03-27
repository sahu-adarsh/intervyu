from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.bedrock_service import BedrockService
from app.services.s3_service import S3Service
from app.config.settings import DEEPGRAM_API_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
import azure.cognitiveservices.speech as speechsdk
import httpx
import io
import os
import re
import json
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

# Azure Speech SDK — module-level config + pool of persistent synthesizers
# en-IN-NeerjaExpressiveNeural is the same voice edge-tts used, via the official SDK.
# MP3 output matches edge-tts quality (~10-15KB/sentence vs 95-280KB for WAV).
# Pool of 3 synthesizers handles up to 3 concurrent sentence TTS tasks per turn;
# each instance keeps its Azure WebSocket alive across turns (~50-200ms vs ~700ms cold).
_speech_config = speechsdk.SpeechConfig(subscription=AZURE_SPEECH_KEY, region=AZURE_SPEECH_REGION)
_speech_config.speech_synthesis_voice_name = "en-IN-NeerjaExpressiveNeural"
_speech_config.set_speech_synthesis_output_format(
    speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3  # MP3 — matches edge-tts size
)
_synth_pool: asyncio.Queue | None = None  # lazily initialized on first async call

def _get_synth_pool() -> asyncio.Queue:
    global _synth_pool
    if _synth_pool is None:
        _synth_pool = asyncio.Queue()
        for _ in range(3):
            _synth_pool.put_nowait(speechsdk.SpeechSynthesizer(
                speech_config=_speech_config, audio_config=None
            ))
    return _synth_pool

# Persistent HTTP client — reuses TCP/TLS connection to Deepgram across all sessions
# Creating a new AsyncClient per STT call costs 200-500ms for TCP+TLS handshake.
_http_client = httpx.AsyncClient(
    timeout=30.0,
    limits=httpx.Limits(max_keepalive_connections=5, keepalive_expiry=30)
)

# In-memory session cache — avoids repeated S3 round-trips each voice turn
_session_cache: dict = {}

def _get_cached_session(s3_service, session_id: str) -> dict:
    if session_id not in _session_cache:
        data = s3_service.get_session(session_id)
        _session_cache[session_id] = data or {}
    return _session_cache[session_id]

def _invalidate_session_cache(session_id: str):
    _session_cache.pop(session_id, None)


def _extract_problem_statement(text: str) -> str:
    """Extract problem statement from [PROBLEM]...[/PROBLEM] tags. Returns '' if not found."""
    match = re.search(r'\[PROBLEM\](.*?)\[/PROBLEM\]', text, re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else ''


def _extract_test_cases(text: str) -> list:
    """Extract test cases from [TESTCASE]...{json}...[/TESTCASE] tags. Returns [] if none found."""
    import json as _json
    cases = []
    for match in re.finditer(r'\[TESTCASE\](.*?)\[/TESTCASE\]', text, re.IGNORECASE | re.DOTALL):
        try:
            case = _json.loads(match.group(1).strip())
            if 'input' in case and 'expected' in case:
                cases.append({'input': str(case['input']), 'expected': str(case['expected'])})
        except Exception:
            pass
    return cases


def _generate_initial_code(test_cases: list) -> str:
    """Generate a Python function template matching the argument count inferred from the first test case."""
    n_args = 1
    if test_cases:
        try:
            first_input = eval(test_cases[0]['input'], {"__builtins__": {}})
            if isinstance(first_input, (list, tuple)):
                n_args = len(first_input)
        except Exception:
            pass

    arg_names = {
        1: ['arr'],
        2: ['nums', 'target'],
        3: ['arr', 'val', 'k'],
    }
    args = ', '.join(arg_names.get(n_args, [f'arg{i+1}' for i in range(n_args)]))
    return f'# Write your code here\ndef solution({args}):\n    # Your implementation\n    pass\n'


def clean_agent_response(text: str) -> str:
    """
    Clean agent response by removing stage directions and formatting issues.

    Removes:
    - Stage directions like "*smiling*", "*in a friendly tone*"
    - Text in asterisks or within parentheses that describe tone
    - Extra whitespace

    Args:
        text: Raw text from agent

    Returns:
        Cleaned text suitable for TTS
    """
    if not text:
        return text

    # Remove text within asterisks (stage directions)
    # Pattern: *anything* including multi-word phrases
    cleaned = re.sub(r'\*[^*]+\*', '', text)

    # Remove text within parentheses that looks like stage directions
    # Pattern: (in a X tone), (friendly), etc.
    cleaned = re.sub(r'\([^)]*tone[^)]*\)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\([^)]*smiling[^)]*\)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\([^)]*warmly[^)]*\)', '', cleaned, flags=re.IGNORECASE)

    # Remove common stage direction phrases even without markers
    stage_direction_patterns = [
        r'in a \w+ tone,?\s*',
        r'with a \w+ voice,?\s*',
        r'warmly,?\s*',
        r'friendly,?\s*',
        r'professionally,?\s*',
    ]
    for pattern in stage_direction_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

    # Clean up extra whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = cleaned.strip()

    # Remove leading/trailing punctuation artifacts
    cleaned = re.sub(r'^[,\s]+', '', cleaned)

    return cleaned


def validate_and_truncate_response(text: str) -> str:
    """
    Validate agent response follows formatting rules and truncate if needed.

    Enforces:
    - Maximum 3 sentences
    - No bullet points or numbered lists
    - Stops at first question mark to ensure ONE question

    Args:
        text: Raw response from agent

    Returns:
        Validated and potentially truncated response
    """
    if not text:
        return text

    # Remove bullet points and list markers
    # Pattern: lines starting with -, *, •, numbers like "1.", "2.", etc.
    lines = text.split('\n')
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()
        # Skip lines that are bullet points or numbered lists
        if re.match(r'^[\-\*•\d]+[\.\)]\s', stripped):
            continue
        # Skip lines that start with bold markers like **
        if stripped.startswith('**'):
            continue
        if stripped:  # Keep non-empty lines
            cleaned_lines.append(stripped)

    text = ' '.join(cleaned_lines)

    # Split into sentences (rough approximation)
    sentences = re.split(r'([.!?])\s+', text)

    # Reconstruct sentences with their punctuation
    reconstructed = []
    for i in range(0, len(sentences) - 1, 2):
        if i + 1 < len(sentences):
            sentence = sentences[i] + sentences[i + 1]
            reconstructed.append(sentence.strip())

    # Handle last sentence if it doesn't end with punctuation
    if len(sentences) % 2 == 1 and sentences[-1].strip():
        reconstructed.append(sentences[-1].strip())

    # Limit to 3 sentences
    if len(reconstructed) > 3:
        reconstructed = reconstructed[:3]

    # If there's a question mark, truncate after the FIRST question
    result = ' '.join(reconstructed)
    question_match = re.search(r'[^?]*\?', result)
    if question_match:
        # Keep everything up to and including the first question mark
        result = question_match.group(0).strip()

    return result


@router.websocket("/ws/interview/{session_id}")
async def voice_interview_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time voice interviews
    Handles: Audio streaming, Speech-to-Text, LLM interaction, Text-to-Speech
    """
    try:
        # Accept connection FIRST for faster perceived performance
        await websocket.accept()

        # Initialize services
        bedrock_service = BedrockService()
        s3_service = S3Service()
    except Exception as e:
        logger.error(f"Model initialization error: {e}")
        await websocket.close(code=1011, reason=f"Model init failed: {str(e)}")
        return

    # State management
    streaming_active = False
    streaming_audio_chunks = []
    accumulated_transcript = ""
    processing = False
    interview_started = False

    async def transcribe_audio(audio_data: bytes) -> str:
        """Convert audio to text using Deepgram Nova-2"""
        import time
        start_time = time.time()

        try:
            response = await _http_client.post(
                "https://api.deepgram.com/v1/listen?model=nova-2&language=en",
                headers={
                    "Authorization": f"Token {DEEPGRAM_API_KEY}",
                    "Content-Type": "audio/wav",
                },
                content=audio_data,
            )
            response.raise_for_status()
            data = response.json()
            text = data["results"]["channels"][0]["alternatives"][0]["transcript"]

            elapsed = time.time() - start_time
            logger.info(f"[DEEPGRAM] Transcription took {elapsed:.2f}s")
            return text
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return ""

    async def text_to_speech(text: str) -> bytes:
        """
        Convert text to speech using Azure Cognitive Services Speech SDK.
        Same en-IN-NeerjaExpressiveNeural voice as edge-tts, but via the official SDK
        which maintains a persistent connection — ~50-200ms vs edge-tts's 200-2700ms.
        """
        import time
        import html
        start_time = time.time()

        # Expand acronyms so TTS reads them as individual letters
        ACRONYMS = {
            r'\bSDE\b': 'S.D.E.',
            r'\bSDEs\b': 'S.D.E.s',
            r'\bLLM\b': 'L.L.M.',
            r'\bLLMs\b': 'L.L.M.s',
            r'\bML\b': 'M.L.',
            r'\bDSA\b': 'D.S.A.',
            r'\bOOP\b': 'O.O.P.',
            r'\bSQL\b': 'S.Q.L.',
        }
        for pattern, replacement in ACRONYMS.items():
            text = re.sub(pattern, replacement, text)

        try:
            # SSML with +20% rate — same pace as the old edge-tts call
            # html.escape() prevents XML injection from special chars in text
            ssml = (
                '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">'
                '<voice name="en-IN-NeerjaExpressiveNeural">'
                f'<prosody rate="+20%">{html.escape(text)}</prosody>'
                '</voice></speak>'
            )
            # Acquire a pooled synthesizer — persistent connection, no per-call TCP+TLS
            pool = _get_synth_pool()
            synthesizer = await pool.get()
            try:
                result = await asyncio.to_thread(lambda: synthesizer.speak_ssml_async(ssml).get())
            finally:
                await pool.put(synthesizer)  # always return to pool

            elapsed = time.time() - start_time
            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                logger.info(f"[AZURE-TTS] {len(text)} chars in {elapsed*1000:.0f}ms ({len(result.audio_data)} bytes)")
                return result.audio_data
            else:
                details = result.cancellation_details.error_details if result.cancellation_details else "unknown"
                logger.error(f"[AZURE-TTS] Failed: {result.reason} — {details}")
                return b""
        except Exception as e:
            logger.error(f"[AZURE-TTS] Error: {e}")
            return b""

    async def send_interviewer_introduction():
        """Send interviewer's initial introduction"""
        nonlocal processing

        if processing:
            return

        processing = True

        try:
            # Fetch session data asynchronously to avoid blocking
            session_data = await asyncio.to_thread(s3_service.get_session, session_id)
            candidate_name = session_data.get("candidate_name", "candidate") if session_data else "candidate"
            interview_type = session_data.get("interview_type", "Technical Interview") if session_data else "Technical Interview"

            # Use display_name so TTS gets "Google India - SDE" instead of raw "google-sde"
            from app.config.interview_types import get_interview_config as _get_config
            _interview_config = _get_config(interview_type)
            interview_display = _interview_config.get("display_name", interview_type)

            # Use a simple, fast greeting without Bedrock for instant response
            # This eliminates the 2-5 second Bedrock cold start delay
            greeting_text = f"Hello {candidate_name}, I'm Neerja, your interviewer for today's {interview_display}. Let's begin. Please tell me about yourself."

            logger.info(f"[{datetime.now()}] Sending fast introduction...")

            # Start TTS generation in parallel while streaming text word-by-word
            tts_task = asyncio.create_task(text_to_speech(greeting_text))

            # Stream text word-by-word so frontend can animate it in
            words = greeting_text.split()
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                await websocket.send_json({"type": "llm_chunk", "text": chunk})
                await asyncio.sleep(0.07)  # ~70ms/word ≈ natural reading pace

            # Wait for TTS (likely already done by now) and send audio
            audio_bytes = await tts_task
            if len(audio_bytes) > 44:
                await websocket.send_bytes(audio_bytes)

            full_response = greeting_text

            # Alternative: Use Bedrock if you need dynamic greetings (slower but more personalized)
            # Uncomment below to use Bedrock Agent instead
            """
            greeting_prompt = f"Start the interview by introducing yourself (Neerja) as the interviewer and welcoming {candidate_name} to the {interview_type}. Keep it brief and professional."
            logger.info(f"[{datetime.now()}] Sending interviewer introduction...")
            full_response = ""
            text_buffer = ""
            sentence_endings = re.compile(r'[.!?]\s*')

            try:
                event_stream = bedrock_service.invoke_agent(session_id, greeting_prompt)
                logger.info(f"[{datetime.now()}] Bedrock Agent invoked for introduction")

                for event in event_stream:
                    if 'chunk' in event:
                        chunk_data = event['chunk']
                        if 'bytes' in chunk_data:
                            chunk_text = chunk_data['bytes'].decode('utf-8')
                            full_response += chunk_text
                            text_buffer += chunk_text

                            # Send text chunk to frontend
                            await websocket.send_json({
                                "type": "llm_chunk",
                                "text": chunk_text
                            })

                            # Generate TTS for complete sentences
                            sentences = sentence_endings.split(text_buffer)

                            for sentence in sentences[:-1]:
                                sentence = sentence.strip()
                                if sentence:
                                    # Clean stage directions before TTS
                                    cleaned_sentence = clean_agent_response(sentence)
                                    if cleaned_sentence:  # Only generate TTS if there's content after cleaning
                                        audio_bytes = await text_to_speech(cleaned_sentence)
                                        if len(audio_bytes) > 44:  # More than WAV header
                                            await websocket.send_bytes(audio_bytes)

                            # Keep incomplete fragment
                            text_buffer = sentences[-1] if sentences else ""

                # Process remaining text
                if text_buffer.strip():
                    # Clean stage directions before TTS
                    cleaned_text = clean_agent_response(text_buffer)
                    if cleaned_text:  # Only generate TTS if there's content after cleaning
                        audio_bytes = await text_to_speech(cleaned_text)
                        if len(audio_bytes) > 44:
                            await websocket.send_bytes(audio_bytes)

            except Exception as e:
                logger.error(f"Bedrock Agent error during introduction: {e}")
                # Fallback greeting
                full_response = f"Hello {candidate_name}, welcome to your {interview_type}. I'll be conducting this interview today. Let's begin."
                audio_bytes = await text_to_speech(full_response)
                if len(audio_bytes) > 44:
                    await websocket.send_bytes(audio_bytes)
            """

            # Signal completion
            await websocket.send_json({
                "type": "assistant_complete",
                "text": full_response,
                "role": "assistant"
            })

            # Save introduction to transcript in background (non-blocking)
            asyncio.create_task(asyncio.to_thread(
                s3_service.update_session_transcript,
                session_id,
                {
                    "role": "assistant",
                    "content": full_response,
                    "timestamp": datetime.utcnow().isoformat()
                }
            ))

        except Exception as e:
            logger.error(f"Error sending introduction: {e}")
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        finally:
            processing = False

    async def process_voice_turn(audio_data: bytes):
        """Process complete voice turn: STT -> Bedrock -> TTS"""
        nonlocal processing, accumulated_transcript

        if processing:
            return

        processing = True

        # Start overall timer
        import time
        overall_start = time.time()
        audio_kb = len(audio_data) / 1024
        logger.info(f"[TIMING] ══════════════════════════════════════════")
        logger.info(f"[TIMING] Voice turn started — audio: {audio_kb:.1f} KB")

        try:
            # Step 1: STT + session fetch in parallel — both are I/O-bound with no dependency
            async def _warm_session():
                if session_id not in _session_cache:
                    _raw = await asyncio.to_thread(s3_service.get_session, session_id)
                    _session_cache[session_id] = _raw or {}

            step_start = time.time()
            transcript, _ = await asyncio.gather(
                transcribe_audio(audio_data),
                _warm_session()
            )
            step_elapsed = time.time() - step_start
            logger.info(f"[TIMING] [1] Deepgram STT:        {step_elapsed*1000:.0f}ms  (transcript: {len(transcript)} chars)")
            logger.info(f"[TIMING] [2] Session fetch:        0ms  (ran in parallel with STT)")

            if not transcript:
                processing = False
                return

            # Send final transcript to frontend IMMEDIATELY with priority
            await websocket.send_json({
                "type": "transcript",
                "text": transcript,
                "role": "user",
                "is_final": True
            })
            await asyncio.sleep(0)  # Force context switch, let message send
            logger.info(f"[{datetime.now().strftime('%H:%M:%S')}] Transcript sent: {transcript}")

            # Save user transcript to S3 in background (non-blocking).
            asyncio.create_task(asyncio.to_thread(
                s3_service.update_session_transcript,
                session_id,
                {
                    "role": "user",
                    "content": transcript,
                    "timestamp": datetime.utcnow().isoformat()
                }
            ))
            # Update cache in-place so session_data next turn includes this user turn
            if session_id in _session_cache:
                _session_cache[session_id].setdefault("transcript", []).append({
                    "role": "user",
                    "content": transcript,
                    "timestamp": datetime.utcnow().isoformat()
                })

            # Step 2: Get response from Claude (direct streaming)
            logger.info(f"[{datetime.now()}] Starting Claude direct stream...")
            full_response = ""
            bedrock_first_token_time = None
            bedrock_start = time.time()

            try:
                session_data = _session_cache.get(session_id, {})

                # Count turns from transcript to determine current phase
                transcript_history = session_data.get("transcript", [])
                turn_count = len([msg for msg in transcript_history if msg.get("role") == "user"])

                # Get interview configuration to determine phase progression
                from app.config.interview_types import get_interview_config
                interview_config = get_interview_config(session_data.get("interview_type", "Technical Interview") if session_data else "Technical Interview")

                # Get custom phase flow for this interview type
                phases = interview_config.get("phases", ["introduction", "background", "technical", "problem_solving", "closing"])

                # Determine current phase based on turn count and phase progression
                # Coding practice: ["introduction", "coding"] - 2 phases
                # Regular interviews: ["introduction", "background", "technical", "problem_solving", "closing"] - 5 phases
                if turn_count == 0:
                    current_phase = phases[0]  # introduction
                elif turn_count <= 1:
                    current_phase = phases[1] if len(phases) > 1 else phases[0]  # coding or background
                elif len(phases) == 2:
                    # Coding practice - stay in coding phase
                    current_phase = phases[1]  # coding
                elif turn_count <= 3:
                    current_phase = phases[2] if len(phases) > 2 else phases[-1]  # technical or behavioral
                elif turn_count <= 8:
                    current_phase = phases[3] if len(phases) > 3 else phases[-1]  # problem_solving or scenario_based
                else:
                    current_phase = phases[-1]  # closing

                # Add context and constraints to the prompt
                # This ensures the agent knows all the interview details
                candidate_name = session_data.get("candidate_name", "candidate") if session_data else "candidate"
                interview_type = session_data.get("interview_type", "Technical Interview") if session_data else "Technical Interview"

                # Get full interview configuration based on type
                from app.config.interview_types import get_interview_config
                interview_config = get_interview_config(interview_type)

                # Build comprehensive context from config
                display_name = interview_config.get("display_name", interview_type)
                focus_areas = interview_config.get("focus_areas", "technical skills")
                key_topics = interview_config.get("key_topics", "general topics")
                difficulty = interview_config.get("difficulty_range", "medium")

                cv_analysis = session_data.get("cv_analysis") if session_data else None
                cv_context = ""
                if cv_analysis:
                    skills = cv_analysis.get("skills", [])
                    years = cv_analysis.get("years_of_experience", "")
                    summary = cv_analysis.get("summary", "")
                    skills_str = ", ".join(skills[:15]) if skills else "not listed"
                    cv_context = f" Candidate CV: {years} yrs exp. Skills: {skills_str}. {summary}"

                context_prefix = f"[CONTEXT: Interviewing {candidate_name} for {display_name}. Focus: {focus_areas}. Topics: {key_topics}. Difficulty: {difficulty}. Current phase: {current_phase}.{cv_context}]\n"
                constraint_reminder = "[REMINDER: Respond with MAXIMUM 2-3 sentences. Ask EXACTLY ONE question. NO bullet points, NO lists, NO asterisks.]\n\n"
                enhanced_input = context_prefix + constraint_reminder + transcript

                # Build conversation history for direct Claude call (no KB overhead, true token streaming)
                transcript_msgs = session_data.get("transcript", []) if session_data else []
                conversation_history = [
                    {"role": m["role"], "content": m["content"]}
                    for m in transcript_msgs
                    if m.get("role") in ("user", "assistant") and m.get("content")
                ]
                logger.info(f"[{datetime.now()}] Invoking Claude direct stream ({len(conversation_history)} prior turns)")

                # Async bridge: run sync boto3 generator in thread pool (non-blocking event loop)
                # Use next(gen, _DONE) sentinel to avoid StopIteration→RuntimeError (PEP 479)
                async def _stream_tokens():
                    loop = asyncio.get_event_loop()
                    gen = bedrock_service.invoke_claude_stream(conversation_history, enhanced_input)
                    _DONE = object()
                    while True:
                        token = await loop.run_in_executor(None, next, gen, _DONE)
                        if token is _DONE:
                            return
                        yield token

                # Sentence boundary: punctuation followed by whitespace
                sentence_boundary = re.compile(r'(?<=[.!?])\s+')

                # Step A+B concurrent: stream tokens + fire TTS per sentence + send audio immediately
                # Audio sender runs concurrently — sends each audio chunk as soon as its TTS task resolves,
                # without waiting for the full Claude stream to finish.
                tts_queue: asyncio.Queue = asyncio.Queue()
                tts_count = 0
                first_audio_sent = False

                async def _audio_sender():
                    nonlocal first_audio_sent
                    while True:
                        task = await tts_queue.get()
                        if task is None:  # sentinel — all TTS tasks enqueued
                            break
                        audio_bytes = await task
                        if len(audio_bytes) > 44:
                            if not first_audio_sent:
                                first_audio_sent = True
                                logger.info(f"[TIMING] [5] First audio sent:     +{(time.time()-overall_start)*1000:.0f}ms total  ({len(audio_bytes)//1024} KB)")
                            await websocket.send_bytes(audio_bytes)

                audio_sender_task = asyncio.create_task(_audio_sender())

                def _fire_tts(text: str):
                    nonlocal tts_count
                    cleaned = clean_agent_response(text)
                    if cleaned:
                        task = asyncio.create_task(text_to_speech(cleaned))
                        tts_queue.put_nowait(task)
                        tts_count += 1
                        logger.info(f"[TIMING] [4] TTS fired (stream):     +{(time.time()-overall_start)*1000:.0f}ms")

                tts_buffer = ""
                problem_detected = False  # [PROBLEM] tag seen → switch to batch TTS

                async for token in _stream_tokens():
                    if bedrock_first_token_time is None:
                        bedrock_first_token_time = time.time() - bedrock_start
                        logger.info(f"[TIMING] [3] Claude first token:   {bedrock_first_token_time*1000:.0f}ms")
                    full_response += token
                    # True token streaming to frontend — no word-by-word artificial delay
                    await websocket.send_json({"type": "llm_chunk", "text": token})

                    if not problem_detected:
                        tts_buffer += token
                        # Detect [PROBLEM] tag — switch to batch TTS for coding questions
                        if re.search(r'\[PROBLEM\]', tts_buffer, re.IGNORECASE):
                            problem_detected = True
                            intro = re.split(r'\[PROBLEM\]', tts_buffer, maxsplit=1, flags=re.IGNORECASE)[0]
                            for sent in re.split(r'(?<=[.!?])\s', intro.strip()):
                                if sent.strip():
                                    _fire_tts(sent.strip())
                            tts_buffer = ""
                        else:
                            # Fire TTS per complete sentence as tokens arrive
                            while True:
                                m = sentence_boundary.search(tts_buffer)
                                if not m:
                                    break
                                sentence = tts_buffer[:m.start() + 1].strip()
                                tts_buffer = tts_buffer[m.end():]
                                _fire_tts(sentence)

                bedrock_total = time.time() - bedrock_start
                logger.info(f"[TIMING] [3] Claude complete:      {bedrock_total*1000:.0f}ms  (+{(time.time()-overall_start)*1000:.0f}ms total | {len(full_response)} chars)")

                # Flush remaining buffer (last sentence may not end with whitespace)
                if not problem_detected and tts_buffer.strip():
                    _fire_tts(tts_buffer.strip())

                # For coding questions: batch TTS for the problem description text
                if problem_detected:
                    problem_match = re.search(r'\[PROBLEM\](.*?)\[/PROBLEM\]', full_response, re.IGNORECASE | re.DOTALL)
                    if problem_match:
                        for sent in re.split(r'(?<=[.!?])\s', problem_match.group(1).strip()):
                            if sent.strip():
                                _fire_tts(sent.strip())

                logger.info(f"[TIMING] [4] All TTS tasks fired:  +{(time.time()-overall_start)*1000:.0f}ms  ({tts_count} tasks)")

                # Signal audio sender that all tasks are enqueued, then wait for it to finish
                await tts_queue.put(None)
                await audio_sender_task
                if tts_count:
                    logger.info(f"[TIMING] [5] Last audio sent:      +{(time.time()-overall_start)*1000:.0f}ms total")

            except Exception as e:
                logger.error(f"Bedrock Agent error: {e}")
                # Fallback error message
                await websocket.send_json({
                    "type": "error",
                    "message": f"AI processing error: {str(e)}"
                })
                full_response = "I apologize, but I encountered an error processing your response."

            # Extract problem statement and test cases BEFORE validation — truncation would destroy the tags
            extracted_problem = _extract_problem_statement(full_response)
            extracted_test_cases = _extract_test_cases(full_response)

            # Validate and truncate the conversational part only (strip all tags first so
            # the sentence-limiter and "stop at ?" logic see only spoken text)
            spoken_response = re.sub(r'\[PROBLEM\].*?\[/PROBLEM\]', '', full_response, flags=re.IGNORECASE | re.DOTALL)
            spoken_response = re.sub(r'\[TESTCASE\].*?\[/TESTCASE\]', '', spoken_response, flags=re.IGNORECASE | re.DOTALL).strip()
            validated_response = validate_and_truncate_response(spoken_response)

            # Log if response was truncated
            if len(validated_response) < len(spoken_response):
                logger.info(f"[{session_id}] Response truncated: {len(spoken_response)} -> {len(validated_response)} chars")
                logger.info(f"[{session_id}] Original: {spoken_response[:100]}...")
                logger.info(f"[{session_id}] Validated: {validated_response}")

            full_response = validated_response

            # Signal completion with the clean spoken text (no tags)
            await websocket.send_json({
                "type": "assistant_complete",
                "text": full_response,
                "role": "assistant"
            })

            # Only open the code editor when an actual problem statement was tagged
            if extracted_problem:
                logger.info(f"[{session_id}] Coding problem detected via [PROBLEM] tags — {len(extracted_test_cases)} test case(s)")
                await websocket.send_json({
                    "type": "coding_question",
                    "question": extracted_problem,
                    "language": "python",
                    "testCases": extracted_test_cases,
                    "initialCode": _generate_initial_code(extracted_test_cases)
                })
                logger.info(f"[{session_id}] Code editor signal sent to frontend")

            # Save assistant response to transcript and update cache in-place
            s3_service.update_session_transcript(session_id, {
                "role": "assistant",
                "content": full_response,
                "timestamp": datetime.utcnow().isoformat()
            })
            # Update cache in-place — next turn session fetch is a free dict lookup (0ms)
            if session_id in _session_cache:
                _session_cache[session_id].setdefault("transcript", []).append({
                    "role": "assistant",
                    "content": full_response,
                    "timestamp": datetime.utcnow().isoformat()
                })

            accumulated_transcript = ""

            # Final performance summary
            overall_elapsed = time.time() - overall_start
            logger.info(f"[TIMING] ══ TOTAL: {overall_elapsed*1000:.0f}ms (speech_end → last audio sent) ══════════")

        except Exception as e:
            logger.error(f"Voice processing error: {e}")
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        finally:
            processing = False

    # Main WebSocket loop
    try:
        while True:
            message = await websocket.receive()

            if message['type'] == 'websocket.disconnect':
                break

            # Handle control signals
            if 'text' in message:
                try:
                    data = json.loads(message['text'])
                    if isinstance(data, dict):
                        if data.get('type') == 'interview_ready' and not interview_started:
                            logger.info(f"[{session_id}] Client ready, sending introduction...")
                            interview_started = True
                            await send_interviewer_introduction()
                        elif data.get('type') == 'speech_start':
                            logger.info(f"[{session_id}] Speech started")
                            streaming_active = True
                            streaming_audio_chunks = []
                            accumulated_transcript = ""
                        elif data.get('type') == 'speech_end':
                            import time as _t
                            logger.info(f"[TIMING] speech_end received — {len(streaming_audio_chunks)} audio chunks buffered")
                            streaming_active = False
                            if streaming_audio_chunks:
                                combined_audio = b''.join(streaming_audio_chunks)
                                streaming_audio_chunks = []
                                await process_voice_turn(combined_audio)
                        elif data.get('type') == 'code_submission':
                            logger.info(f"[{session_id}] Code submission received")
                            # Format code submission for conversation context
                            code = data.get('code', '')
                            language = data.get('language', 'unknown')
                            all_passed = data.get('allTestsPassed', False)
                            test_results = data.get('testResults', [])
                            error = data.get('error', '')

                            # Create a summary message for the agent
                            status = "passed all tests" if all_passed else "failed some tests"
                            summary = f"Candidate submitted {language} code that {status}. "
                            summary += f"Tests: {len([t for t in test_results if t.get('passed')])} passed, "
                            summary += f"{len([t for t in test_results if not t.get('passed')])} failed."

                            # Add to session transcript
                            s3_service.update_session_transcript(session_id, {
                                "role": "system",
                                "content": summary,
                                "timestamp": datetime.utcnow().isoformat(),
                                "code": code,
                                "testResults": test_results
                            })

                            logger.info(f"[{session_id}] Code submission logged: {summary}")

                            # Generate chatbot response to the code submission
                            if not processing:
                                processing = True
                                try:
                                    # Get session data
                                    session_data = s3_service.get_session(session_id)
                                    candidate_name = session_data.get("candidate_name", "candidate") if session_data else "candidate"

                                    # Build context for the agent about the code submission
                                    submitted_code = data.get('code', '')
                                    if all_passed:
                                        prompt = f"[CONTEXT: {candidate_name} just submitted {language} code that passed all {len(test_results)} test cases.]\n"
                                        prompt += f"[CODE SUBMITTED:\n{submitted_code}\n]\n"
                                        prompt += "[INSTRUCTION: Provide brief positive feedback and ask a follow-up question about their approach or optimization.]\n"
                                        prompt += "Code submission: All tests passed!"
                                    elif error:
                                        prompt = f"[CONTEXT: {candidate_name} submitted {language} code with a top-level error: {error}]\n"
                                        prompt += f"[CODE SUBMITTED:\n{submitted_code}\n]\n"
                                        prompt += "[INSTRUCTION: Identify the error from the code and guide them to fix it without giving the answer.]\n"
                                        prompt += "Code submission: Execution error occurred."
                                    else:
                                        failed = [t for t in test_results if not t.get('passed')]
                                        failed_count = len(failed)
                                        # Include first failure's error detail so Neerja knows exactly what went wrong
                                        first_error = failed[0].get('error') if failed else None
                                        prompt = f"[CONTEXT: {candidate_name} submitted {language} code. {len(test_results) - failed_count}/{len(test_results)} tests passed."
                                        if first_error:
                                            prompt += f" First failing test error: {first_error}"
                                        prompt += "]\n"
                                        prompt += f"[CODE SUBMITTED:\n{submitted_code}\n]\n"
                                        prompt += "[INSTRUCTION: Based on the error, provide a targeted hint without giving the solution. Point to the specific issue.]\n"
                                        prompt += "Code submission: Some tests failed."

                                    prompt += "\n[REMINDER: Respond with MAXIMUM 2-3 sentences. Ask EXACTLY ONE question. NO bullet points, NO lists, NO asterisks.]"

                                    # Get response from Bedrock Agent
                                    full_response = ""
                                    text_buffer = ""
                                    sentence_endings = re.compile(r'[.!?]\s*')

                                    event_stream = bedrock_service.invoke_agent(
                                        session_id=session_id,
                                        input_text=prompt
                                    )

                                    for event in event_stream:
                                        if 'chunk' in event:
                                            chunk_data = event['chunk']
                                            if 'bytes' in chunk_data:
                                                chunk_text = chunk_data['bytes'].decode('utf-8')
                                                full_response += chunk_text
                                                text_buffer += chunk_text

                                                # Send text chunk to frontend
                                                await websocket.send_json({
                                                    "type": "llm_chunk",
                                                    "text": chunk_text
                                                })

                                                # Generate TTS for complete sentences
                                                sentences = sentence_endings.split(text_buffer)

                                                for sentence in sentences[:-1]:
                                                    sentence = sentence.strip()
                                                    if sentence:
                                                        # Clean stage directions before TTS
                                                        cleaned_sentence = clean_agent_response(sentence)
                                                        if cleaned_sentence:
                                                            audio_bytes = await text_to_speech(cleaned_sentence)
                                                            if len(audio_bytes) > 44:
                                                                await websocket.send_bytes(audio_bytes)

                                                # Keep incomplete fragment
                                                text_buffer = sentences[-1] if sentences else ""

                                    # Process remaining text
                                    if text_buffer.strip():
                                        cleaned_text = clean_agent_response(text_buffer)
                                        if cleaned_text:
                                            audio_bytes = await text_to_speech(cleaned_text)
                                            if len(audio_bytes) > 44:
                                                await websocket.send_bytes(audio_bytes)

                                    # Validate and truncate response
                                    validated_response = validate_and_truncate_response(full_response)
                                    full_response = validated_response

                                    # Signal completion
                                    await websocket.send_json({
                                        "type": "assistant_complete",
                                        "text": full_response,
                                        "role": "assistant"
                                    })

                                    # Save assistant response to transcript
                                    s3_service.update_session_transcript(session_id, {
                                        "role": "assistant",
                                        "content": full_response,
                                        "timestamp": datetime.utcnow().isoformat()
                                    })

                                    logger.info(f"[{session_id}] Chatbot response sent: {full_response}")

                                except Exception as e:
                                    logger.error(f"Error generating code feedback: {e}")
                                    await websocket.send_json({
                                        "type": "error",
                                        "message": f"Failed to generate feedback: {str(e)}"
                                    })
                                finally:
                                    processing = False
                except Exception as e:
                    logger.error(f"Error parsing control message: {e}")

            # Handle audio data
            if 'bytes' in message:
                data = message['bytes']

                # Skip small chunks (noise)
                if len(data) < 1000:
                    continue

                if streaming_active:
                    streaming_audio_chunks.append(data)
                else:
                    # Fallback: process complete audio
                    await process_voice_turn(data)

    except WebSocketDisconnect:
        logger.info(f"[{session_id}] Client disconnected")
    except Exception as e:
        logger.error(f"[{session_id}] WebSocket error: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass

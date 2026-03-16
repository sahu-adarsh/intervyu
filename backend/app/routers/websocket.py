from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.bedrock_service import BedrockService
from app.services.s3_service import S3Service
from faster_whisper import WhisperModel
import edge_tts
import torch
import io
import tempfile
import os
import re
import json
import asyncio
from datetime import datetime

router = APIRouter()

# Initialize models (lazy loading recommended for production)
whisper_model = None
# Edge TTS voice - Indian English female (fast and natural)
EDGE_TTS_VOICE = "en-IN-NeerjaNeural"


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

def get_whisper_model():
    """
    Initialize Whisper model with GPU support if available.
    Supports: NVIDIA CUDA, Apple Silicon (MPS), CPU fallback.
    """
    global whisper_model
    if whisper_model is None:
        # Auto-detect best available device
        if torch.cuda.is_available():
            device = "cuda"
            compute_type = "float16"
            acceleration_info = "NVIDIA CUDA GPU"
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            # Apple Silicon (M1/M2/M3/M4) - Use CPU with optimized compute type
            # Note: faster-whisper doesn't support MPS directly, but runs efficiently on Apple Silicon CPU
            device = "cpu"
            compute_type = "int8"
            acceleration_info = "Apple Silicon (optimized)"
        else:
            device = "cpu"
            compute_type = "int8"
            acceleration_info = "CPU only"

        print(f"[WHISPER] Initializing on {device.upper()} with {compute_type}")
        print(f"[WHISPER] Hardware: {acceleration_info}")

        whisper_model = WhisperModel(
            "small",  # Use "small" for balance, or "tiny" for even faster processing
            device=device,
            compute_type=compute_type,
            num_workers=4  # Utilize multiple cores on Apple Silicon
        )

        if device == "cuda":
            print(f"[WHISPER] GPU acceleration enabled (expected 3-5x speedup)")
        elif "Apple Silicon" in acceleration_info:
            print(f"[WHISPER] Apple Silicon detected - optimized performance on Neural Engine")
        else:
            print(f"[WHISPER] Running on standard CPU")

    return whisper_model

@router.websocket("/ws/interview/{session_id}")
async def voice_interview_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time voice interviews
    Handles: Audio streaming, Speech-to-Text, LLM interaction, Text-to-Speech
    """
    try:
        # Accept connection FIRST for faster perceived performance
        await websocket.accept()

        # Initialize Whisper model (lazy loading)
        whisper = get_whisper_model()

        # Initialize services
        bedrock_service = BedrockService()
        s3_service = S3Service()
    except Exception as e:
        print(f"Model initialization error: {e}")
        await websocket.close(code=1011, reason=f"Model init failed: {str(e)}")
        return

    # State management
    streaming_active = False
    streaming_audio_chunks = []
    accumulated_transcript = ""
    processing = False
    interview_started = False

    async def transcribe_audio(audio_data: bytes) -> str:
        """Convert audio to text using faster-whisper"""
        import time
        start_time = time.time()

        suffix = '.webm' if audio_data[:4] != b'RIFF' else '.wav'

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_audio:
            temp_audio.write(audio_data)
            temp_path = temp_audio.name

        try:
            segments, _ = whisper.transcribe(
                temp_path,
                beam_size=1,  # Reduced from 5 for speed
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            text = " ".join([segment.text for segment in segments]).strip()
            elapsed = time.time() - start_time
            print(f"[WHISPER] Transcription took {elapsed:.2f}s")
            return text
        except Exception as e:
            print(f"Transcription error: {e}")
            return ""
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    async def text_to_speech(text: str) -> bytes:
        """
        Convert text to speech using Edge TTS (Microsoft Azure).
        Fast, free, and high-quality neural voices.
        """
        import time
        start_time = time.time()

        try:
            # Create Edge TTS communication
            communicate = edge_tts.Communicate(text, EDGE_TTS_VOICE)

            # Generate audio and collect chunks
            audio_buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_buffer.write(chunk["data"])

            elapsed = time.time() - start_time
            print(f"[EDGE-TTS] Generated {len(text)} chars in {elapsed:.2f}s (~{len(text)/elapsed:.0f} chars/s)")

            return audio_buffer.getvalue()
        except Exception as e:
            print(f"[EDGE-TTS] Error: {e}")
            import traceback
            traceback.print_exc()
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

            # Use a simple, fast greeting without Bedrock for instant response
            # This eliminates the 2-5 second Bedrock cold start delay
            greeting_text = f"Hello {candidate_name}, I'm Neerja, your interviewer for today's {interview_type}. Let's begin. Please tell me about yourself."

            print(f"[{datetime.now()}] Sending fast introduction...")

            # Send text immediately
            await websocket.send_json({
                "type": "llm_chunk",
                "text": greeting_text
            })

            # Generate TTS for the greeting
            audio_bytes = await text_to_speech(greeting_text)
            if len(audio_bytes) > 44:
                await websocket.send_bytes(audio_bytes)

            full_response = greeting_text

            # Alternative: Use Bedrock if you need dynamic greetings (slower but more personalized)
            # Uncomment below to use Bedrock Agent instead
            """
            greeting_prompt = f"Start the interview by introducing yourself (Neerja) as the interviewer and welcoming {candidate_name} to the {interview_type}. Keep it brief and professional."
            print(f"[{datetime.now()}] Sending interviewer introduction...")
            full_response = ""
            text_buffer = ""
            sentence_endings = re.compile(r'[.!?]\s*')

            try:
                event_stream = bedrock_service.invoke_agent(session_id, greeting_prompt)
                print(f"[{datetime.now()}] Bedrock Agent invoked for introduction")

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
                print(f"Bedrock Agent error during introduction: {e}")
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
            print(f"Error sending introduction: {e}")
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

        try:
            # Step 1: Speech-to-Text
            step_start = time.time()
            transcript = await transcribe_audio(audio_data)
            step_elapsed = time.time() - step_start
            print(f"[PERF] Step 1 (Whisper STT): {step_elapsed:.2f}s")

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
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Transcript sent: {transcript}")

            # Save to S3 in background (don't wait)
            asyncio.create_task(asyncio.to_thread(
                s3_service.update_session_transcript,
                session_id,
                {
                    "role": "user",
                    "content": transcript,
                    "timestamp": datetime.utcnow().isoformat()
                }
            ))

            # Step 2: Get response from Bedrock Agent (streaming) - starts IMMEDIATELY
            step_start = time.time()
            print(f"[{datetime.now()}] Calling Bedrock Agent...")
            full_response = ""
            text_buffer = ""
            sentence_endings = re.compile(r'[.!?]\s*')
            coding_question_detected = False
            bedrock_first_token_time = None
            bedrock_start = time.time()

            try:
                # Get session state to pass interview configuration to Bedrock
                session_state_start = time.time()
                session_data = s3_service.get_session(session_id)
                session_state_elapsed = time.time() - session_state_start
                print(f"[PERF] Step 2a (S3 session fetch): {session_state_elapsed:.2f}s")

                # Debug: Log session data
                print(f"[{session_id}] Session data retrieved:")
                print(f"  - candidate_name: {session_data.get('candidate_name') if session_data else 'NO SESSION DATA'}")
                print(f"  - interview_type: {session_data.get('interview_type') if session_data else 'NO SESSION DATA'}")

                # Count turns from transcript to determine current phase
                transcript_history = session_data.get("transcript", []) if session_data else []
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

                session_state_for_bedrock = {
                    "interviewType": session_data.get("interview_type", "Technical Interview") if session_data else "Technical Interview",
                    "candidateName": session_data.get("candidate_name", "candidate") if session_data else "candidate",
                    "resumeSummary": session_data.get("resume_summary", "Not provided") if session_data else "Not provided",
                    "turnCount": turn_count,
                    "currentPhase": current_phase,
                    "difficultyLevel": "medium"  # Adapt based on performance
                }

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

                context_prefix = f"[CONTEXT: Interviewing {candidate_name} for {display_name}. Focus: {focus_areas}. Topics: {key_topics}. Difficulty: {difficulty}. Current phase: {current_phase}.]\n"
                constraint_reminder = "[REMINDER: Respond with MAXIMUM 2-3 sentences. Ask EXACTLY ONE question. NO bullet points, NO lists, NO asterisks.]\n\n"
                enhanced_input = context_prefix + constraint_reminder + transcript

                event_stream = bedrock_service.invoke_agent(
                    session_id=session_id,
                    input_text=enhanced_input,
                    session_state=session_state_for_bedrock
                )
                print(f"[{datetime.now()}] Bedrock Agent invoked with session state")

                for event in event_stream:
                    if 'chunk' in event:
                        chunk_data = event['chunk']
                        if 'bytes' in chunk_data:
                            # Track first token time
                            if bedrock_first_token_time is None:
                                bedrock_first_token_time = time.time() - bedrock_start
                                print(f"[PERF] Step 2b (Bedrock first token): {bedrock_first_token_time:.2f}s")

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

                # Log Bedrock total time
                bedrock_total = time.time() - bedrock_start
                print(f"[PERF] Step 2 (Bedrock complete): {bedrock_total:.2f}s")

            except Exception as e:
                print(f"Bedrock Agent error: {e}")
                # Fallback error message
                await websocket.send_json({
                    "type": "error",
                    "message": f"AI processing error: {str(e)}"
                })
                full_response = "I apologize, but I encountered an error processing your response."

            # Validate and truncate response to enforce formatting rules
            validated_response = validate_and_truncate_response(full_response)

            # Log if response was truncated
            if len(validated_response) < len(full_response):
                print(f"[{session_id}] Response truncated: {len(full_response)} -> {len(validated_response)} chars")
                print(f"[{session_id}] Original: {full_response[:100]}...")
                print(f"[{session_id}] Validated: {validated_response}")

            # Use validated response for all further processing
            full_response = validated_response

            # Detect coding question patterns in the response
            coding_keywords = [
                'write a function', 'implement', 'code', 'algorithm',
                'write code', 'solve this problem', 'coding problem',
                'programming challenge', 'leetcode', 'code editor',
                'function that', 'write a program', 'implement a solution'
            ]

            full_response_lower = full_response.lower()
            coding_question_detected = any(keyword in full_response_lower for keyword in coding_keywords)

            # Signal completion
            await websocket.send_json({
                "type": "assistant_complete",
                "text": full_response,
                "role": "assistant"
            })

            # If coding question detected, send coding_question signal
            if coding_question_detected:
                print(f"[{session_id}] Coding question detected in response")

                # Extract coding question details (you can enhance this with NLP)
                # For now, we'll send a simple notification
                await websocket.send_json({
                    "type": "coding_question",
                    "question": full_response,
                    "language": "python",  # Default language
                    "testCases": [],  # You can populate this based on the question
                    "initialCode": "# Write your code here\ndef solution(arr):\n    # Your implementation\n    return arr\n"
                })
                print(f"[{session_id}] Code editor signal sent to frontend")

            # Save assistant response to transcript
            s3_service.update_session_transcript(session_id, {
                "role": "assistant",
                "content": full_response,
                "timestamp": datetime.utcnow().isoformat()
            })

            accumulated_transcript = ""

            # Final performance summary
            overall_elapsed = time.time() - overall_start
            print(f"[PERF] ========================================")
            print(f"[PERF] TOTAL END-TO-END: {overall_elapsed:.2f}s")
            print(f"[PERF] ========================================")

        except Exception as e:
            print(f"Voice processing error: {e}")
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
                            print(f"[{session_id}] Client ready, sending introduction...")
                            interview_started = True
                            await send_interviewer_introduction()
                        elif data.get('type') == 'speech_start':
                            print(f"[{session_id}] Speech started")
                            streaming_active = True
                            streaming_audio_chunks = []
                            accumulated_transcript = ""
                        elif data.get('type') == 'speech_end':
                            print(f"[{session_id}] Speech ended, processing...")
                            streaming_active = False
                            if streaming_audio_chunks:
                                combined_audio = b''.join(streaming_audio_chunks)
                                streaming_audio_chunks = []
                                await process_voice_turn(combined_audio)
                        elif data.get('type') == 'code_submission':
                            print(f"[{session_id}] Code submission received")
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

                            print(f"[{session_id}] Code submission logged: {summary}")

                            # Generate chatbot response to the code submission
                            if not processing:
                                processing = True
                                try:
                                    # Get session data
                                    session_data = s3_service.get_session(session_id)
                                    candidate_name = session_data.get("candidate_name", "candidate") if session_data else "candidate"

                                    # Build context for the agent about the code submission
                                    if all_passed:
                                        prompt = f"[CONTEXT: {candidate_name} just submitted {language} code that passed all {len(test_results)} test cases successfully.]\n"
                                        prompt += "[INSTRUCTION: Provide brief positive feedback and ask a follow-up question about their approach or optimization.]\n"
                                        prompt += f"Code submission: All tests passed!"
                                    elif error:
                                        prompt = f"[CONTEXT: {candidate_name} just submitted {language} code that had an error: {error}]\n"
                                        prompt += "[INSTRUCTION: Provide constructive feedback on the error and guide them to fix it.]\n"
                                        prompt += f"Code submission: Execution error occurred."
                                    else:
                                        failed_count = len([t for t in test_results if not t.get('passed')])
                                        prompt = f"[CONTEXT: {candidate_name} just submitted {language} code. {len(test_results) - failed_count} tests passed, {failed_count} tests failed.]\n"
                                        prompt += "[INSTRUCTION: Provide constructive feedback on what might be wrong and guide them to debug.]\n"
                                        prompt += f"Code submission: Some tests failed."

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

                                    print(f"[{session_id}] Chatbot response sent: {full_response}")

                                except Exception as e:
                                    print(f"Error generating code feedback: {e}")
                                    await websocket.send_json({
                                        "type": "error",
                                        "message": f"Failed to generate feedback: {str(e)}"
                                    })
                                finally:
                                    processing = False
                except Exception as e:
                    print(f"Error parsing control message: {e}")

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
        print(f"[{session_id}] Client disconnected")
    except Exception as e:
        print(f"[{session_id}] WebSocket error: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass

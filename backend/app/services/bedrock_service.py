import boto3
import time
import json
import logging
from typing import Dict, Any, Optional, List, Generator
from botocore.config import Config
from botocore.exceptions import ClientError
from app.config import AWS_REGION, AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, BEDROCK_AGENT_ID, BEDROCK_AGENT_ALIAS_ID, TEXTRACT_AWS_ACCESS_KEY, TEXTRACT_AWS_SECRET_ACCESS_KEY
from app.config.interview_types import get_interview_config, INTERVIEW_PHASES

logger = logging.getLogger(__name__)

class BedrockService:
    def __init__(self):
        # Configure boto3 with connection reuse and faster settings
        config = Config(
            region_name=AWS_REGION,
            retries={
                'max_attempts': 3,
                'mode': 'adaptive'
            },
            connect_timeout=5,  # Faster initial connection
            read_timeout=60,
            max_pool_connections=50,  # Connection pooling
            tcp_keepalive=True  # Keep connections alive
        )

        self.bedrock_agent_client = boto3.client(
            'bedrock-agent-runtime',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            config=config
        )
        # Direct bedrock-runtime client for converse_stream (no KB overhead, true token streaming)
        self.bedrock_runtime_client = boto3.client(
            'bedrock-runtime',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            config=config
        )
        # Separate client for structured JSON calls (uses Textract creds which have Sonnet/Haiku-3.5 access)
        self.bedrock_json_client = boto3.client(
            'bedrock-runtime',
            region_name=AWS_REGION,
            aws_access_key_id=TEXTRACT_AWS_ACCESS_KEY,
            aws_secret_access_key=TEXTRACT_AWS_SECRET_ACCESS_KEY,
            config=config
        )
        self.agent_id = BEDROCK_AGENT_ID
        self.agent_alias_id = BEDROCK_AGENT_ALIAS_ID
        self._system_prompt: Optional[str] = None

        # Session state cache (in production, use Redis or DynamoDB)
        self.session_states: Dict[str, Dict[str, Any]] = {}

    def initialize_session(
        self,
        session_id: str,
        interview_type: str,
        candidate_name: str,
        resume_summary: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Initialize session state for a new interview session

        Args:
            session_id: Unique session identifier
            interview_type: Type of interview (e.g., "Google SDE", "AWS SA")
            candidate_name: Name of the candidate
            resume_summary: Optional summary of candidate's resume

        Returns:
            Session state dictionary
        """
        session_state = {
            "sessionId": session_id,
            "interviewType": interview_type,
            "candidateName": candidate_name,
            "resumeSummary": resume_summary or "Not provided",
            "conversationHistory": [],
            "startTime": time.time(),
            "turnCount": 0
        }

        self.session_states[session_id] = session_state
        return session_state

    def get_session_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve session state for a given session ID

        Args:
            session_id: Unique session identifier

        Returns:
            Session state dictionary or None if not found
        """
        return self.session_states.get(session_id)

    def update_session_state(
        self,
        session_id: str,
        user_input: str,
        agent_response: str
    ) -> None:
        """
        Update session state with latest conversation turn

        Args:
            session_id: Unique session identifier
            user_input: User's input text
            agent_response: Agent's response text
        """
        if session_id in self.session_states:
            self.session_states[session_id]["conversationHistory"].append({
                "role": "user",
                "content": user_input,
                "timestamp": time.time()
            })
            self.session_states[session_id]["conversationHistory"].append({
                "role": "assistant",
                "content": agent_response,
                "timestamp": time.time()
            })
            self.session_states[session_id]["turnCount"] += 1

    def invoke_agent(
        self,
        session_id: str,
        input_text: str,
        enable_trace: bool = False,
        max_retries: int = 2,
        session_state: Optional[Dict[str, Any]] = None
    ):
        """
        Invoke Bedrock Agent with streaming response and retry logic

        Args:
            session_id: Unique session identifier
            input_text: User input text
            enable_trace: Enable agent trace for debugging
            max_retries: Maximum number of retry attempts
            session_state: Optional session state attributes to pass to agent

        Returns:
            Generator yielding response chunks
        """
        retry_count = 0
        base_delay = 0.5  # Start with 500ms delay

        # Build enhanced session state for Bedrock Agent
        session_attributes = {}
        if session_state:
            interview_type = session_state.get("interviewType", "")

            # Get interview configuration based on type
            interview_config = get_interview_config(interview_type)

            # Build comprehensive session attributes
            session_attributes = {
                # Basic session info
                "interview_type": interview_type,
                "candidate_name": session_state.get("candidateName", ""),
                "resume_summary": session_state.get("resumeSummary", "Not provided"),
                "turn_count": str(session_state.get("turnCount", 0)),

                # Interview configuration (from interview_types.py)
                "focus_areas": interview_config.get("focus_areas", ""),
                "key_topics": interview_config.get("key_topics", ""),
                "difficulty_range": interview_config.get("difficulty_range", "medium"),
                "evaluation_weight": interview_config.get("evaluation_weight", ""),

                # Current phase tracking
                "current_phase": session_state.get("currentPhase", "introduction"),
                "difficulty_level": session_state.get("difficultyLevel", "medium"),

                # Performance tracking (optional)
                "performance_score": str(session_state.get("performanceScore", 5)),
            }

            logger.debug(
                "[BEDROCK] Session attributes — type=%s candidate=%s phase=%s",
                session_attributes.get('interview_type'),
                session_attributes.get('candidate_name'),
                session_attributes.get('current_phase'),
            )

        while retry_count <= max_retries:
            try:
                # Prepare invocation parameters
                invoke_params = {
                    "agentId": self.agent_id,
                    "agentAliasId": self.agent_alias_id,
                    "sessionId": session_id,
                    "inputText": input_text,
                    "enableTrace": enable_trace
                }

                # Add session state if provided
                if session_attributes:
                    invoke_params["sessionState"] = {
                        "sessionAttributes": session_attributes
                    }

                response = self.bedrock_agent_client.invoke_agent(**invoke_params)

                # Return the streaming event stream
                event_stream = response.get('completion', [])
                return event_stream

            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', '')

                if error_code == 'ThrottlingException' and retry_count < max_retries:
                    # Exponential backoff
                    delay = base_delay * (2 ** retry_count)
                    logger.warning(f"Bedrock throttling. Retrying in {delay}s... (attempt {retry_count + 1}/{max_retries})")
                    time.sleep(delay)
                    retry_count += 1
                else:
                    logger.error(f"Error invoking Bedrock Agent: {e}")
                    raise

            except Exception as e:
                logger.error(f"Error invoking Bedrock Agent: {e}")
                raise

        # If all retries exhausted
        raise Exception("Max retries exceeded for Bedrock Agent invocation")

    def extract_text_from_stream(self, event_stream):
        """
        Extract text chunks from Bedrock Agent event stream

        Yields:
            Text chunks from the agent response
        """
        for event in event_stream:
            if 'chunk' in event:
                chunk_data = event['chunk']
                if 'bytes' in chunk_data:
                    text_chunk = chunk_data['bytes'].decode('utf-8')
                    yield text_chunk

    def _load_system_prompt(self) -> str:
        """Load Neerja system prompt from agent_instruction.txt (cached after first read)."""
        if self._system_prompt is None:
            import os
            prompt_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'agent_instruction.txt')
            try:
                with open(os.path.abspath(prompt_path), 'r') as f:
                    self._system_prompt = f.read().strip()
            except Exception as e:
                logger.warning(f"Could not load agent_instruction.txt: {e}")
                self._system_prompt = "You are Neerja, a professional technical interviewer. Respond with 2-3 sentences and exactly one question."
        return self._system_prompt

    def invoke_claude_stream(
        self,
        conversation_history: list,
        user_message: str,
    ):
        """
        Direct Claude streaming via bedrock-runtime converse_stream.
        No KB lookup overhead — true token-by-token streaming for low latency TTS pipeline.

        Args:
            conversation_history: List of prior turns [{"role": "user"/"assistant", "content": "..."}]
            user_message: The current user message (with injected context prefix)

        Yields:
            Text tokens as they stream from Claude
        """
        system_prompt = self._load_system_prompt()

        messages = []
        for msg in conversation_history:
            role = msg.get("role")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": [{"text": content}]})

        messages.append({"role": "user", "content": [{"text": user_message}]})

        try:
            response = self.bedrock_runtime_client.converse_stream(
                modelId="us.anthropic.claude-haiku-4-5-20251001-v1:0",
                system=[{"text": system_prompt}],
                messages=messages,
                inferenceConfig={
                    "maxTokens": 300,
                    "temperature": 0.7,
                }
            )
            stream = response.get("stream", [])
            for event in stream:
                delta = event.get("contentBlockDelta", {}).get("delta", {})
                text = delta.get("text", "")
                if text:
                    yield text
        except Exception as e:
            logger.error(f"invoke_claude_stream error: {e}")
            raise

    def invoke_claude_json(self, prompt: str, max_tokens: int = 2000) -> str:
        """
        Single-turn Claude call for structured JSON output. Not streaming.
        Returns the raw text response (caller parses JSON).
        """
        response = self.bedrock_json_client.converse(
            modelId="us.anthropic.claude-haiku-4-5-20251001-v1:0",
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0.3},
        )
        return response["output"]["message"]["content"][0]["text"]

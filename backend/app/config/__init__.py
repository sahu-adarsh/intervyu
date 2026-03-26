"""
Configuration package for intervyu application.
Contains interview type configurations and other settings.
"""

# Import settings from settings.py
from .settings import (
    AWS_REGION,
    AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY,
    TEXTRACT_AWS_ACCESS_KEY,
    TEXTRACT_AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_USER_DATA,
    S3_BUCKET_KNOWLEDGE_BASE,
    BEDROCK_AGENT_ID,
    BEDROCK_AGENT_ALIAS_ID,
    WHISPER_MODEL,
    WS_CONNECTION_TIMEOUT
)

# Import interview configurations
from .interview_types import get_interview_config, INTERVIEW_CONFIGS, INTERVIEW_PHASES

__all__ = [
    # Settings
    "AWS_REGION",
    "AWS_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "TEXTRACT_AWS_ACCESS_KEY",
    "TEXTRACT_AWS_SECRET_ACCESS_KEY",
    "S3_BUCKET_USER_DATA",
    "S3_BUCKET_KNOWLEDGE_BASE",
    "BEDROCK_AGENT_ID",
    "BEDROCK_AGENT_ALIAS_ID",
    "WHISPER_MODEL",
    "WS_CONNECTION_TIMEOUT",
    # Interview types
    "get_interview_config",
    "INTERVIEW_CONFIGS",
    "INTERVIEW_PHASES"
]
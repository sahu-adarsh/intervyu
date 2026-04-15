import os
from dotenv import load_dotenv

load_dotenv()

# AWS Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")

# Textract-specific credentials (separate account with Textract subscription)
TEXTRACT_AWS_ACCESS_KEY = os.getenv("TEXTRACT_AWS_ACCESS_KEY", AWS_ACCESS_KEY)
TEXTRACT_AWS_SECRET_ACCESS_KEY = os.getenv("TEXTRACT_AWS_SECRET_ACCESS_KEY", AWS_SECRET_ACCESS_KEY)

# S3 Configuration
S3_BUCKET_USER_DATA = os.getenv("S3_BUCKET_USER_DATA", "prepai-user-data")
S3_BUCKET_KNOWLEDGE_BASE = os.getenv("S3_BUCKET_KNOWLEDGE_BASE", "prepai-knowledge-base")

# Bedrock Configuration
BEDROCK_AGENT_ID = os.getenv("BEDROCK_AGENT_ID", "")
BEDROCK_AGENT_ALIAS_ID = os.getenv("BEDROCK_AGENT_ALIAS_ID", "")

# Voice Models Configuration
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")

# Deepgram STT
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")

# Azure Cognitive Services Speech (TTS)
AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "eastus")

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Lambda Configuration
LAMBDA_CODE_EXECUTOR = os.getenv("LAMBDA_CODE_EXECUTOR", "prepai-code-executor")
LAMBDA_CV_ANALYZER = os.getenv("LAMBDA_CV_ANALYZER", "prepai-cv-analyzer")
LAMBDA_PERFORMANCE_EVALUATOR = os.getenv("LAMBDA_PERFORMANCE_EVALUATOR", "prepai-performance-evaluator")
LAMBDA_ENDPOINT_URL = os.getenv("LAMBDA_ENDPOINT_URL", None)  # None = use real AWS; set to http://127.0.0.1:3001 for sam local

# WebSocket Configuration
WS_CONNECTION_TIMEOUT = int(os.getenv("WS_CONNECTION_TIMEOUT", "900"))  # 15 minutes

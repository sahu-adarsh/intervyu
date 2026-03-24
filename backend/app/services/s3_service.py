import boto3
import json
import logging
from datetime import datetime
from app.config import AWS_REGION, AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, S3_BUCKET_USER_DATA

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        self.bucket_name = S3_BUCKET_USER_DATA

    def save_session(self, session_data: dict) -> bool:
        """Save session data to S3"""
        try:
            session_id = session_data.get('session_id')
            key = f"sessions/{session_id}.json"

            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=json.dumps(session_data, indent=2),
                ContentType='application/json'
            )
            return True
        except Exception as e:
            logger.error(f"Error saving session to S3: {e}")
            return False

    def get_session(self, session_id: str) -> dict:
        """Retrieve session data from S3"""
        try:
            key = f"sessions/{session_id}.json"
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=key
            )
            session_data = json.loads(response['Body'].read().decode('utf-8'))
            return session_data
        except Exception as e:
            logger.error(f"Error retrieving session from S3: {e}")
            return {}

    def update_session_transcript(self, session_id: str, message: dict) -> bool:
        """Add a message to the session transcript"""
        try:
            session_data = self.get_session(session_id)
            if not session_data:
                return False

            if 'transcript' not in session_data:
                session_data['transcript'] = []

            session_data['transcript'].append(message)
            session_data['updated_at'] = datetime.utcnow().isoformat()

            return self.save_session(session_data)
        except Exception as e:
            logger.error(f"Error updating transcript: {e}")
            return False

    def save_audio_recording(self, session_id: str, audio_data: bytes) -> str:
        """Save audio recording to S3"""
        try:
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            key = f"recordings/{session_id}/audio_{timestamp}.wav"

            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=audio_data,
                ContentType='audio/wav'
            )
            return f"s3://{self.bucket_name}/{key}"
        except Exception as e:
            logger.error(f"Error saving audio recording: {e}")
            return ""

    def upload_cv(self, session_id: str, file_content: bytes, filename: str) -> str:
        """Upload CV/Resume to S3"""
        try:
            key = f"cvs/{session_id}/{filename}"

            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_content,
                ContentType='application/pdf'
            )
            return f"s3://{self.bucket_name}/{key}"
        except Exception as e:
            logger.error(f"Error uploading CV: {e}")
            return ""

    def list_all_sessions(self) -> list:
        """List all sessions from S3"""
        try:
            sessions = []
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix='sessions/'
            )

            for obj in response.get('Contents', []):
                key = obj['Key']
                if key.endswith('.json'):
                    session_data = self.get_session(key.split('/')[-1].replace('.json', ''))
                    if session_data:
                        sessions.append(session_data)

            return sessions
        except Exception as e:
            logger.error(f"Error listing sessions: {e}")
            return []

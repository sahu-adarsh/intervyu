"""
Lambda Service - Direct invocation of Lambda functions
Used for explicit tool calls outside of Bedrock Agent orchestration
"""

import boto3
import json
import logging
from typing import Dict, Any, Optional
from app.config import AWS_REGION, AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY

logger = logging.getLogger(__name__)

class LambdaService:
    def __init__(self):
        self.lambda_client = boto3.client(
            'lambda',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )

    def invoke_code_executor(
        self,
        code: str,
        language: str,
        test_cases: list,
        function_name: str = "solution"
    ) -> Dict[str, Any]:
        """
        Directly invoke Code Executor Lambda

        Args:
            code: Code to execute
            language: Programming language (python, javascript)
            test_cases: List of test cases with input/expected
            function_name: Name of the function to test

        Returns:
            Execution result with test outcomes
        """
        payload = {
            "code": code,
            "language": language,
            "testCases": test_cases,
            "functionName": function_name
        }

        return self._invoke_lambda("prepai-code-executor", payload)

    def invoke_cv_analyzer(
        self,
        s3_bucket: Optional[str] = None,
        s3_key: Optional[str] = None,
        cv_text: Optional[str] = None,
        extract_skills: bool = True
    ) -> Dict[str, Any]:
        """
        Directly invoke CV Analyzer Lambda

        Args:
            s3_bucket: S3 bucket containing CV
            s3_key: S3 key of CV file
            cv_text: Direct CV text (alternative to S3)
            extract_skills: Whether to extract skills

        Returns:
            CV analysis results
        """
        payload: Dict[str, Any] = {
            "extractSkills": extract_skills
        }

        if cv_text:
            payload["cvText"] = cv_text
        elif s3_bucket and s3_key:
            payload["s3Bucket"] = s3_bucket
            payload["s3Key"] = s3_key
        else:
            raise ValueError("Either cv_text or s3_bucket+s3_key must be provided")

        return self._invoke_lambda("prepai-cv-analyzer", payload)

    def invoke_performance_evaluator(
        self,
        session_id: str,
        conversation_history: list,
        code_submissions: list,
        interview_type: str,
        duration: int,
        candidate_name: str = "Candidate",
        save_to_s3: bool = True
    ) -> Dict[str, Any]:
        """
        Directly invoke Performance Evaluator Lambda

        Args:
            session_id: Session identifier
            conversation_history: Full conversation transcript
            code_submissions: Code submissions with results
            interview_type: Type of interview
            duration: Interview duration in seconds
            candidate_name: Candidate's name
            save_to_s3: Whether to save report to S3

        Returns:
            Performance evaluation report
        """
        payload = {
            "sessionId": session_id,
            "conversationHistory": conversation_history,
            "codeSubmissions": code_submissions,
            "interviewType": interview_type,
            "duration": duration,
            "candidateName": candidate_name,
            "saveToS3": save_to_s3
        }

        return self._invoke_lambda("prepai-performance-evaluator", payload)

    def _invoke_lambda(self, function_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Internal method to invoke Lambda function

        Args:
            function_name: Name of Lambda function
            payload: Payload to send

        Returns:
            Lambda response body
        """
        try:
            response = self.lambda_client.invoke(
                FunctionName=function_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(payload)
            )

            # Parse response
            response_payload = json.loads(response['Payload'].read())

            # Handle both direct invocation and Bedrock Agent response formats
            if 'statusCode' in response_payload:
                # Direct invocation format
                if response_payload['statusCode'] == 200:
                    return json.loads(response_payload['body'])
                else:
                    error_body = json.loads(response_payload['body'])
                    raise Exception(f"Lambda error: {error_body.get('error', 'Unknown error')}")
            else:
                # Unexpected format
                raise Exception(f"Unexpected response format from Lambda")

        except Exception as e:
            logger.error(f"Error invoking Lambda {function_name}: {e}")
            raise
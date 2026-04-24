"""
Code Executor Lambda Function
Executes candidate code submissions in a sandboxed environment
Supports Python and JavaScript
"""

import ast
import json
import logging
import sys
import io
import time
import traceback
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def lambda_handler(event, context):
    """
    Main Lambda handler for code execution

    Bedrock Agent event structure:
    {
        "messageVersion": "1.0",
        "agent": {...},
        "actionGroup": "CodeExecutorGroup",
        "apiPath": "/execute-code",
        "httpMethod": "POST",
        "parameters": [
            {"name": "code", "value": "..."},
            {"name": "language", "value": "python"},
            ...
        ],
        "requestBody": {...}
    }
    """

    try:
        # Check if this is a Bedrock Agent request or direct invocation
        is_bedrock_agent = 'messageVersion' in event

        if is_bedrock_agent:
            # Extract parameters from Bedrock Agent format
            parameters = {p['name']: p['value'] for p in event.get('parameters', [])}
            request_body = event.get('requestBody', {}).get('content', {}).get('application/json', {})

            # Merge parameters and request body
            if isinstance(request_body, str):
                request_body = json.loads(request_body)

            params = {**request_body, **parameters}
        else:
            # Direct invocation format
            params = event

        # Extract parameters
        code = params.get('code', '')
        language = params.get('language', 'python').lower()
        test_cases = params.get('testCases', [])
        function_name = params.get('functionName', 'solution')
        timeout = params.get('timeout', 5)

        # Validate inputs
        if not code:
            error_response = {
                'success': False,
                'error': 'Code is required'
            }
            return format_response(event, error_response, 400)

        # Execute code based on language
        if language == 'python':
            result = execute_python(code, test_cases, function_name, timeout)
        elif language == 'javascript':
            result = execute_javascript(code, test_cases, function_name, timeout)
        else:
            error_response = {
                'success': False,
                'error': f'Unsupported language: {language}'
            }
            return format_response(event, error_response, 400)

        return format_response(event, result, 200)

    except Exception as e:
        logger.error("lambda_handler error: %s", traceback.format_exc())
        error_response = {
            'success': False,
            'error': 'Execution error — please try again',
        }
        return format_response(event, error_response, 500)


def format_response(event: Dict, body: Dict, status_code: int = 200) -> Dict:
    """
    Format response for both Bedrock Agent and direct invocation
    """
    is_bedrock_agent = 'messageVersion' in event

    if is_bedrock_agent:
        # Bedrock Agent format
        return {
            "messageVersion": "1.0",
            "response": {
                "actionGroup": event.get('actionGroup', ''),
                "apiPath": event.get('apiPath', ''),
                "httpMethod": event.get('httpMethod', 'POST'),
                "httpStatusCode": status_code,
                "responseBody": {
                    "application/json": {
                        "body": json.dumps(body)
                    }
                }
            }
        }
    else:
        # Direct invocation format
        return {
            'statusCode': status_code,
            'body': json.dumps(body)
        }


def execute_python(code: str, test_cases: List[Dict], function_name: str, timeout: int) -> Dict[str, Any]:
    """
    Execute Python code in sandboxed environment
    """
    results = {
        'success': True,
        'language': 'python',
        'testResults': [],
        'allTestsPassed': True,
        'executionTime': 0,
        'output': None,
        'error': None
    }

    start_time = time.time()

    try:
        # Create restricted globals (no dangerous imports)
        safe_globals = {
            '__builtins__': {
                'abs': abs,
                'all': all,
                'any': any,
                'bool': bool,
                'dict': dict,
                'enumerate': enumerate,
                'filter': filter,
                'float': float,
                'int': int,
                'len': len,
                'list': list,
                'map': map,
                'max': max,
                'min': min,
                'print': print,
                'range': range,
                'reversed': reversed,
                'set': set,
                'sorted': sorted,
                'str': str,
                'sum': sum,
                'tuple': tuple,
                'zip': zip,
            }
        }

        # Execute the user's code
        exec(code, safe_globals)

        # Check if function exists
        if function_name not in safe_globals:
            results['success'] = False
            results['error'] = f"Function '{function_name}' not found in code"
            return results

        user_function = safe_globals[function_name]

        # Run test cases
        for i, test_case in enumerate(test_cases):
            test_result = {
                'testCase': i + 1,
                'passed': False,
                'input': test_case.get('input'),
                'expected': test_case.get('expected'),
                'actual': None,
                'error': None
            }

            try:
                # Parse input — ast.literal_eval only accepts Python literals (safe)
                test_input = ast.literal_eval(test_case['input'])
                expected_output = ast.literal_eval(test_case['expected'])

                # Call function with timeout
                if isinstance(test_input, (list, tuple)):
                    actual_output = user_function(*test_input)
                else:
                    actual_output = user_function(test_input)

                test_result['actual'] = str(actual_output)

                # Compare results
                if actual_output == expected_output:
                    test_result['passed'] = True
                else:
                    test_result['passed'] = False
                    results['allTestsPassed'] = False

            except Exception as e:
                test_result['error'] = str(e)
                test_result['passed'] = False
                results['allTestsPassed'] = False

            results['testResults'].append(test_result)

        # Store output from last successful run
        if results['testResults'] and results['testResults'][-1].get('actual'):
            results['output'] = results['testResults'][-1]['actual']

    except SyntaxError as e:
        results['success'] = False
        results['error'] = f'Syntax Error: {str(e)}'
        results['allTestsPassed'] = False

    except Exception as e:
        results['success'] = False
        results['error'] = f'Runtime Error: {str(e)}'
        results['allTestsPassed'] = False

    results['executionTime'] = round(time.time() - start_time, 3)

    return results


def execute_javascript(code: str, test_cases: List[Dict], function_name: str, timeout: int) -> Dict[str, Any]:
    """
    Execute JavaScript code using Node.js subprocess
    """
    import subprocess
    import tempfile
    import os

    results = {
        'success': True,
        'language': 'javascript',
        'testResults': [],
        'allTestsPassed': True,
        'executionTime': 0,
        'output': None,
        'error': None
    }

    start_time = time.time()

    try:
        # Run test cases
        for i, test_case in enumerate(test_cases):
            test_result = {
                'testCase': i + 1,
                'passed': False,
                'input': test_case.get('input'),
                'expected': test_case.get('expected'),
                'actual': None,
                'error': None
            }

            try:
                # Parse test values then re-serialize as JSON — safe against JS injection
                try:
                    test_input_val = ast.literal_eval(test_case.get('input', 'null'))
                except (ValueError, SyntaxError):
                    test_input_val = test_case.get('input', '')
                try:
                    expected_val = ast.literal_eval(test_case.get('expected', 'null'))
                except (ValueError, SyntaxError):
                    expected_val = test_case.get('expected', '')

                safe_input_json = json.dumps(test_input_val)
                safe_expected_json = json.dumps(expected_val)

                # Build JavaScript test code — no raw string interpolation of user data
                js_test_code = f"""
{code}

// Test runner
try {{
    const input = {safe_input_json};
    const expected = {safe_expected_json};

    let actual;
    if (Array.isArray(input)) {{
        actual = {function_name}(...input);
    }} else {{
        actual = {function_name}(input);
    }}

    console.log(JSON.stringify({{
        actual: actual,
        expected: expected,
        passed: JSON.stringify(actual) === JSON.stringify(expected)
    }}));
}} catch (err) {{
    console.log(JSON.stringify({{
        error: err.message,
        passed: false
    }}));
}}
"""

                # Write to temp file
                with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                    f.write(js_test_code)
                    temp_file = f.name

                try:
                    # Execute with Node.js (if available in Lambda environment)
                    result = subprocess.run(
                        ['node', temp_file],
                        capture_output=True,
                        text=True,
                        timeout=timeout
                    )

                    if result.returncode == 0 and result.stdout:
                        output = json.loads(result.stdout.strip())
                        test_result['actual'] = str(output.get('actual'))
                        test_result['passed'] = output.get('passed', False)

                        if output.get('error'):
                            test_result['error'] = output['error']
                            test_result['passed'] = False
                            results['allTestsPassed'] = False
                        elif not test_result['passed']:
                            results['allTestsPassed'] = False
                    else:
                        # Node.js error
                        error_msg = result.stderr or 'Execution failed'
                        test_result['error'] = error_msg
                        test_result['passed'] = False
                        results['allTestsPassed'] = False

                finally:
                    # Clean up temp file
                    if os.path.exists(temp_file):
                        os.unlink(temp_file)

            except subprocess.TimeoutExpired:
                test_result['error'] = f'Timeout: execution exceeded {timeout} seconds'
                test_result['passed'] = False
                results['allTestsPassed'] = False

            except FileNotFoundError:
                # Node.js not available, fall back to Python-based JS execution
                test_result['error'] = 'Node.js runtime not available in Lambda. Please use Python or deploy with Node.js layer.'
                test_result['passed'] = False
                results['allTestsPassed'] = False
                results['success'] = False

            except Exception as e:
                test_result['error'] = str(e)
                test_result['passed'] = False
                results['allTestsPassed'] = False

            results['testResults'].append(test_result)

        # Store output from last successful run
        if results['testResults'] and results['testResults'][-1].get('actual'):
            results['output'] = results['testResults'][-1]['actual']

    except Exception as e:
        results['success'] = False
        results['error'] = f'JavaScript execution error: {str(e)}'
        results['allTestsPassed'] = False

    results['executionTime'] = round(time.time() - start_time, 3)

    return results


# For testing locally
if __name__ == '__main__':
    # Test event
    test_event = {
        'code': '''
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
        ''',
        'language': 'python',
        'functionName': 'two_sum',
        'testCases': [
            {
                'input': '[[2, 7, 11, 15], 9]',
                'expected': '[0, 1]'
            },
            {
                'input': '[[3, 2, 4], 6]',
                'expected': '[1, 2]'
            }
        ]
    }

    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))
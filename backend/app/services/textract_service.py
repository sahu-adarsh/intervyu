"""
AWS Textract Service
Advanced document parsing for PDF and DOCX files
"""

import boto3
import io
import re
import logging
from typing import Dict, Any, List, Optional
from app.config import AWS_REGION, TEXTRACT_AWS_ACCESS_KEY, TEXTRACT_AWS_SECRET_ACCESS_KEY

logger = logging.getLogger(__name__)

class TextractService:
    def __init__(self):
        self.textract_client = boto3.client(
            'textract',
            region_name=AWS_REGION,
            aws_access_key_id=TEXTRACT_AWS_ACCESS_KEY,
            aws_secret_access_key=TEXTRACT_AWS_SECRET_ACCESS_KEY
        )

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """
        Extract text from PDF using AWS Textract

        Args:
            pdf_bytes: PDF file content as bytes

        Returns:
            Extracted text as string
        """
        try:
            # Call Textract
            response = self.textract_client.detect_document_text(
                Document={'Bytes': pdf_bytes}
            )

            # Extract text from blocks
            text_lines = []
            for block in response.get('Blocks', []):
                if block['BlockType'] == 'LINE':
                    text_lines.append(block['Text'])

            return '\n'.join(text_lines)

        except Exception as e:
            logger.error(f"Textract error: {e}")
            # Fallback to basic extraction
            return self._fallback_pdf_extraction(pdf_bytes)

    def extract_text_from_multi_page_pdf(self, pdf_bytes: bytes) -> List[str]:
        """
        Extract text from multi-page PDF

        Returns:
            List of text strings, one per page
        """
        try:
            # For multi-page, we need to use async Textract API
            # For now, extract all text and split by page markers
            text = self.extract_text_from_pdf(pdf_bytes)

            # Try to detect page breaks
            pages = self._split_by_pages(text)
            return pages

        except Exception as e:
            logger.error(f"Multi-page extraction error: {e}")
            return [self._fallback_pdf_extraction(pdf_bytes)]

    def extract_structured_data(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Extract structured data using Textract's form and table detection

        Returns:
            Dictionary with forms and tables
        """
        try:
            response = self.textract_client.analyze_document(
                Document={'Bytes': pdf_bytes},
                FeatureTypes=['FORMS', 'TABLES']
            )

            # Extract key-value pairs (forms)
            forms = self._extract_forms(response)

            # Extract tables
            tables = self._extract_tables(response)

            return {
                'forms': forms,
                'tables': tables,
                'text': self._extract_text_from_response(response)
            }

        except Exception as e:
            logger.error(f"Structured extraction error: {e}")
            return {
                'forms': {},
                'tables': [],
                'text': self.extract_text_from_pdf(pdf_bytes)
            }

    def _extract_forms(self, response: Dict) -> Dict[str, str]:
        """Extract key-value pairs from Textract response"""
        forms = {}
        blocks = response.get('Blocks', [])

        # Build a map of block IDs to blocks
        block_map = {block['Id']: block for block in blocks}

        for block in blocks:
            if block['BlockType'] == 'KEY_VALUE_SET':
                if 'KEY' in block.get('EntityTypes', []):
                    key_text = self._get_text_from_relationship(block, block_map, 'CHILD')
                    value_block = self._get_related_block(block, block_map, 'VALUE')

                    if value_block:
                        value_text = self._get_text_from_relationship(value_block, block_map, 'CHILD')
                        if key_text and value_text:
                            forms[key_text] = value_text

        return forms

    def _extract_tables(self, response: Dict) -> List[List[str]]:
        """Extract tables from Textract response"""
        tables = []
        blocks = response.get('Blocks', [])

        for block in blocks:
            if block['BlockType'] == 'TABLE':
                table = self._parse_table(block, blocks)
                if table:
                    tables.append(table)

        return tables

    def _extract_text_from_response(self, response: Dict) -> str:
        """Extract plain text from Textract response"""
        text_lines = []
        for block in response.get('Blocks', []):
            if block['BlockType'] == 'LINE':
                text_lines.append(block['Text'])
        return '\n'.join(text_lines)

    def _get_text_from_relationship(self, block: Dict, block_map: Dict, relationship_type: str) -> str:
        """Get text from related blocks"""
        text = []
        if 'Relationships' in block:
            for relationship in block['Relationships']:
                if relationship['Type'] == relationship_type:
                    for child_id in relationship['Ids']:
                        child_block = block_map.get(child_id)
                        if child_block and child_block['BlockType'] == 'WORD':
                            text.append(child_block['Text'])
        return ' '.join(text)

    def _get_related_block(self, block: Dict, block_map: Dict, relationship_type: str) -> Optional[Dict]:
        """Get related block"""
        if 'Relationships' in block:
            for relationship in block['Relationships']:
                if relationship['Type'] == relationship_type:
                    for related_id in relationship['Ids']:
                        return block_map.get(related_id)
        return None

    def _parse_table(self, table_block: Dict, blocks: List[Dict]) -> List[List[str]]:
        """Parse table structure"""
        # Simplified table parsing
        # In production, implement full row/column parsing
        return []

    def _split_by_pages(self, text: str) -> List[str]:
        """Split text by page markers"""
        # Look for common page break indicators
        page_markers = [
            r'\n\s*Page \d+\s*\n',
            r'\n\s*-\d+-\s*\n',
            r'\f',  # Form feed
        ]

        pages = [text]
        for marker in page_markers:
            new_pages = []
            for page in pages:
                new_pages.extend(re.split(marker, page))
            pages = new_pages

        return [p.strip() for p in pages if p.strip()]

    def _fallback_pdf_extraction(self, pdf_bytes: bytes) -> str:
        """Fallback PDF extraction using pypdf"""
        try:
            import pypdf
            pdf_reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            text = []
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text.append(extracted)
            return '\n'.join(text)
        except Exception as e:
            logger.error(f"Fallback extraction error: {e}")
            return "Unable to extract text from PDF"


class IndustrySkillExtractor:
    """
    Industry-specific skill extraction
    Enhanced skill detection based on job roles and industries
    """

    # Industry-specific skill categories
    SKILL_CATEGORIES = {
        'software_engineering': {
            'languages': [
                'Python', 'JavaScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'TypeScript',
                'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'Perl', 'Haskell',
                'Elixir', 'Clojure', 'F#', 'Dart', 'Lua', 'Julia'
            ],
            'frameworks': [
                'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask',
                'FastAPI', 'Spring Boot', 'ASP.NET', 'Next.js', 'Nuxt', 'Svelte',
                'Laravel', 'Rails', 'Phoenix', 'Gin', 'Echo'
            ],
            'databases': [
                'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'DynamoDB', 'Cassandra',
                'Oracle', 'SQL Server', 'SQLite', 'Elasticsearch', 'Neo4j', 'CockroachDB',
                'InfluxDB', 'TimescaleDB', 'MariaDB', 'Couchbase'
            ],
            'tools': [
                'Git', 'Docker', 'Kubernetes', 'Jenkins', 'GitLab CI', 'GitHub Actions',
                'Terraform', 'Ansible', 'Prometheus', 'Grafana', 'ELK', 'Datadog',
                'New Relic', 'Sentry', 'Webpack', 'Vite', 'Babel'
            ]
        },
        'cloud_architect': {
            'aws': [
                'EC2', 'S3', 'Lambda', 'DynamoDB', 'RDS', 'ECS', 'EKS', 'CloudFormation',
                'CloudWatch', 'IAM', 'VPC', 'Route53', 'ALB', 'API Gateway', 'SQS',
                'SNS', 'Kinesis', 'Athena', 'Glue', 'EMR', 'Bedrock'
            ],
            'azure': [
                'Virtual Machines', 'Blob Storage', 'Functions', 'Cosmos DB', 'AKS',
                'Azure DevOps', 'Azure Monitor', 'App Service', 'Logic Apps', 'Service Bus'
            ],
            'gcp': [
                'Compute Engine', 'Cloud Storage', 'Cloud Functions', 'BigQuery', 'GKE',
                'Cloud Run', 'Pub/Sub', 'Dataflow', 'Firestore', 'Cloud SQL'
            ],
            'concepts': [
                'Microservices', 'Serverless', 'High Availability', 'Disaster Recovery',
                'Auto Scaling', 'Load Balancing', 'CDN', 'Zero Trust', 'Multi-region',
                'Blue-Green Deployment', 'Canary Deployment', 'Infrastructure as Code'
            ]
        },
        'data_science': {
            'languages': ['Python', 'R', 'Julia', 'SQL', 'Scala'],
            'libraries': [
                'Pandas', 'NumPy', 'Scikit-learn', 'TensorFlow', 'PyTorch', 'Keras',
                'XGBoost', 'LightGBM', 'Matplotlib', 'Seaborn', 'Plotly', 'NLTK', 'spaCy'
            ],
            'tools': [
                'Jupyter', 'Tableau', 'Power BI', 'Apache Spark', 'Hadoop', 'Kafka',
                'Airflow', 'MLflow', 'Kubeflow', 'SageMaker', 'Databricks'
            ],
            'concepts': [
                'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision',
                'Time Series', 'A/B Testing', 'Feature Engineering', 'Model Deployment'
            ]
        }
    }

    @classmethod
    def extract_skills_by_industry(cls, text: str, industry: str = 'software_engineering') -> Dict[str, List[str]]:
        """
        Extract skills categorized by industry

        Args:
            text: CV text
            industry: Industry category

        Returns:
            Dictionary of categorized skills
        """
        text_lower = text.lower()
        found_skills = {}

        skill_set = cls.SKILL_CATEGORIES.get(industry, cls.SKILL_CATEGORIES['software_engineering'])

        for category, skills in skill_set.items():
            found_in_category = []
            for skill in skills:
                # Case-insensitive matching with word boundaries
                pattern = r'\b' + re.escape(skill.lower()) + r'\b'
                if re.search(pattern, text_lower):
                    found_in_category.append(skill)

            if found_in_category:
                found_skills[category] = found_in_category

        return found_skills

    @classmethod
    def calculate_skill_match_score(cls, extracted_skills: Dict[str, List[str]], required_skills: List[str]) -> float:
        """
        Calculate how well candidate skills match requirements

        Returns:
            Match score (0-100)
        """
        all_extracted = []
        for skills in extracted_skills.values():
            all_extracted.extend([s.lower() for s in skills])

        required_lower = [s.lower() for s in required_skills]
        matched = sum(1 for req in required_lower if req in all_extracted)

        if not required_skills:
            return 100.0

        return round((matched / len(required_skills)) * 100, 2)
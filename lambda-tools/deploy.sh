#!/bin/bash

# Deploy Intervyu Lambda Tools using SAM
# This script builds and deploys all Lambda functions

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Intervyu Lambda Tools Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo -e "${RED}Error: SAM CLI is not installed${NC}"
    echo "Install it from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

echo -e "\n${YELLOW}Configuration:${NC}"
echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"

# Build SAM application
echo -e "\n${YELLOW}Building Lambda functions...${NC}"
sam build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# Deploy
echo -e "\n${YELLOW}Deploying to AWS...${NC}"

if [ -f samconfig.toml ]; then
    echo "Using existing samconfig.toml"
    sam deploy
else
    echo "Running guided deployment"
    sam deploy --guided \
        --stack-name intervyu-lambda-tools \
        --capabilities CAPABILITY_NAMED_IAM \
        --region $REGION
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}Deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Deployment successful${NC}"

# Get Lambda ARNs
echo -e "\n${YELLOW}Lambda Function ARNs:${NC}"
aws cloudformation describe-stacks \
    --stack-name intervyu-lambda-tools \
    --region $REGION \
    --query 'Stacks[0].Outputs' \
    --output table

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Copy the Lambda ARNs from above"
echo "2. Go to AWS Bedrock Console → Agents → Your Agent"
echo "3. Add Action Groups using the schemas in action-groups/"
echo "4. Link each Action Group to its Lambda function"
echo "5. Test the tools in the agent test panel"

echo -e "\n${YELLOW}To test Lambda functions directly:${NC}"
echo "./test_lambdas.sh"
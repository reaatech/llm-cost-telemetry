#!/bin/bash
# LocalStack initialization script for llm-cost-telemetry
# Creates CloudWatch log group and namespace for local development

set -e

echo "Initializing LocalStack for llm-cost-telemetry..."

awslocal logs create-log-group --log-group-name /aws/llm/costs 2>/dev/null || true

echo "LocalStack initialization complete."

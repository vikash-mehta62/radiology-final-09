#!/bin/bash

# Vault Initialization Script for DICOM Bridge
# This script sets up the initial secrets in Vault for development

set -e

VAULT_ADDR=${VAULT_ADDR:-"http://localhost:8200"}
VAULT_TOKEN=${VAULT_TOKEN:-"dev-root-token"}
ENVIRONMENT=${NODE_ENV:-"development"}

echo "🔐 Initializing Vault secrets for DICOM Bridge..."
echo "Environment: $ENVIRONMENT"
echo "Vault Address: $VAULT_ADDR"

# Wait for Vault to be ready
echo "⏳ Waiting for Vault to be ready..."
until vault status > /dev/null 2>&1; do
  echo "Waiting for Vault..."
  sleep 2
done

echo "✅ Vault is ready"

# Enable KV secrets engine if not already enabled
echo "🔧 Enabling KV secrets engine..."
vault secrets enable -path=dicom-bridge kv-v2 2>/dev/null || echo "KV engine already enabled"

# Create secrets for the environment
echo "📝 Creating secrets for environment: $ENVIRONMENT"

# Orthanc secrets
vault kv put dicom-bridge/$ENVIRONMENT/orthanc \
  username="orthanc" \
  password="orthanc_secure_$(date +%s)" \
  url="http://orthanc:8042"

# Webhook secrets
vault kv put dicom-bridge/$ENVIRONMENT/webhook \
  hmac_secret="webhook_hmac_$(openssl rand -hex 32)"

# Database secrets
vault kv put dicom-bridge/$ENVIRONMENT/database \
  mongodb_uri="mongodb://127.0.0.1:27017/dicomdb"

# Cloudinary removed - no longer needed
  api_secret=""

# Create a policy for the dicom-bridge role
echo "🔐 Creating policy for dicom-bridge role..."
vault policy write dicom-bridge-policy - <<EOF
# Allow reading secrets for the dicom-bridge application
path "dicom-bridge/$ENVIRONMENT/*" {
  capabilities = ["read"]
}

# Allow listing secrets
path "dicom-bridge/$ENVIRONMENT" {
  capabilities = ["list"]
}

# Allow updating secrets for rotation
path "dicom-bridge/$ENVIRONMENT/*" {
  capabilities = ["read", "update"]
}
EOF

# Enable AWS auth method for IAM-based authentication (for production)
echo "🔧 Enabling AWS auth method..."
vault auth enable aws 2>/dev/null || echo "AWS auth already enabled"

# Create a role for the dicom-bridge service
echo "👤 Creating dicom-bridge role..."
vault write auth/aws/role/dicom-bridge \
  auth_type=iam \
  policies=dicom-bridge-policy \
  max_ttl=1h \
  bound_iam_principal_arn="*" 2>/dev/null || echo "Role already exists"

# For development, also enable userpass auth
echo "🔧 Enabling userpass auth for development..."
vault auth enable userpass 2>/dev/null || echo "Userpass auth already enabled"

# Create a development user
vault write auth/userpass/users/dicom-bridge \
  password="dev-password" \
  policies="dicom-bridge-policy" 2>/dev/null || echo "User already exists"

echo "✅ Vault initialization complete!"
echo ""
echo "📋 Development Access Information:"
echo "  Vault UI: http://localhost:8200"
echo "  Root Token: dev-root-token"
echo "  Dev User: dicom-bridge / dev-password"
echo ""
echo "🔍 To view secrets:"
echo "  vault kv get dicom-bridge/$ENVIRONMENT/orthanc"
echo "  vault kv get dicom-bridge/$ENVIRONMENT/webhook"
echo ""
echo "🔄 To rotate secrets:"
echo "  vault kv put dicom-bridge/$ENVIRONMENT/orthanc password=\"new_password\""
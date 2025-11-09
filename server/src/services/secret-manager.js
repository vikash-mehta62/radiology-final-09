const axios = require('axios');
const AWS = require('aws-sdk');

/**
 * Secret Manager Client Service for Node Server
 * Supports HashiCorp Vault and AWS Secrets Manager
 * Implements IAM role-based authentication and secret rotation
 */
class SecretManagerClient {
  constructor(config = {}) {
    this.provider = config.provider || process.env.SECRET_PROVIDER || 'vault';
    this.config = config;
    
    // Initialize provider-specific clients
    if (this.provider === 'vault') {
      this.initializeVault();
    } else if (this.provider === 'aws') {
      this.initializeAWS();
    } else if (this.provider === 'env') {
      // Use environment variables directly (for local development)
      console.log('Using environment variables for secrets (local development mode)');
    } else {
      throw new Error(`Unsupported secret provider: ${this.provider}`);
    }
    
    // Cache for secrets with TTL
    this.secretCache = new Map();
    this.cacheTimeout = config.cacheTimeout || 300000; // 5 minutes default
    
    console.log('Secret Manager Client initialized', {
      provider: this.provider,
      cacheTimeout: this.cacheTimeout
    });
  }

  /**
   * Initialize HashiCorp Vault client
   */
  initializeVault() {
    this.vaultUrl = this.config.vaultUrl || process.env.VAULT_URL || 'http://vault:8200';
    this.vaultToken = this.config.vaultToken || process.env.VAULT_TOKEN;
    this.vaultRole = this.config.vaultRole || process.env.VAULT_ROLE || 'node-server';
    this.vaultNamespace = this.config.vaultNamespace || process.env.VAULT_NAMESPACE;
    
    this.vaultClient = axios.create({
      baseURL: this.vaultUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.vaultNamespace && { 'X-Vault-Namespace': this.vaultNamespace })
      }
    });

    // Add request interceptor for authentication (skip for health checks)
    this.vaultClient.interceptors.request.use(async (config) => {
      // Skip authentication for health check endpoint
      if (config.url && config.url.includes('/sys/health')) {
        return config;
      }
      
      if (!config.headers['X-Vault-Token']) {
        const token = await this.getVaultToken();
        config.headers['X-Vault-Token'] = token;
      }
      return config;
    });

    console.log('Vault client initialized', {
      url: this.vaultUrl,
      role: this.vaultRole,
      namespace: this.vaultNamespace
    });
  }

  /**
   * Initialize AWS Secrets Manager client
   */
  initializeAWS() {
    const region = this.config.awsRegion || process.env.AWS_REGION || 'us-east-1';
    
    this.awsClient = new AWS.SecretsManager({
      region,
      // Use IAM role authentication (no explicit credentials)
      ...(this.config.awsEndpoint && { endpoint: this.config.awsEndpoint })
    });

    console.log('AWS Secrets Manager client initialized', { region });
  }

  /**
   * Get Vault authentication token using IAM role
   */
  async getVaultToken() {
    try {
      // If token is provided directly, use it
      if (this.vaultToken) {
        return this.vaultToken;
      }

      // Use AWS IAM authentication for Vault
      const response = await this.vaultClient.post('/v1/auth/aws/login', {
        role: this.vaultRole
      });

      const token = response.data.auth.client_token;
      const ttl = response.data.auth.lease_duration;

      console.log('Vault token obtained via IAM authentication', {
        role: this.vaultRole,
        ttl
      });

      // Cache token for reuse
      this.vaultToken = token;
      
      // Schedule token renewal
      setTimeout(() => {
        this.vaultToken = null;
      }, (ttl - 300) * 1000); // Renew 5 minutes before expiry

      return token;

    } catch (error) {
      console.error('Failed to obtain Vault token', {
        error: error.message,
        role: this.vaultRole
      });
      throw new Error(`Vault authentication failed: ${error.message}`);
    }
  }

  /**
   * Retrieve secret from configured provider
   */
  async getSecret(secretPath, options = {}) {
    const cacheKey = `${this.provider}:${secretPath}`;
    
    // Check cache first
    if (!options.skipCache && this.secretCache.has(cacheKey)) {
      const cached = this.secretCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('Secret retrieved from cache', { secretPath });
        return cached.value;
      }
    }

    try {
      let secret;
      
      if (this.provider === 'env') {
        // For environment provider, return the environment variable directly
        secret = process.env[secretPath];
        if (!secret) {
          throw new Error(`Environment variable ${secretPath} not found`);
        }
      } else if (this.provider === 'vault') {
        secret = await this.getVaultSecret(secretPath, options);
      } else if (this.provider === 'aws') {
        secret = await this.getAWSSecret(secretPath, options);
      }

      // Cache the secret
      this.secretCache.set(cacheKey, {
        value: secret,
        timestamp: Date.now()
      });

      console.log('Secret retrieved successfully', {
        provider: this.provider,
        secretPath,
        cached: false
      });

      return secret;

    } catch (error) {
      console.error('Failed to retrieve secret', {
        provider: this.provider,
        secretPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieve secret from HashiCorp Vault
   */
  async getVaultSecret(secretPath, options = {}) {
    try {
      const response = await this.vaultClient.get(`/v1/${secretPath}`);
      
      if (!response.data || !response.data.data) {
        throw new Error('Invalid secret response from Vault');
      }

      // Handle KV v2 format
      const secretData = response.data.data.data || response.data.data;
      
      return secretData;

    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Secret not found: ${secretPath}`);
      }
      throw new Error(`Vault secret retrieval failed: ${error.message}`);
    }
  }

  /**
   * Retrieve secret from AWS Secrets Manager
   */
  async getAWSSecret(secretId, options = {}) {
    try {
      const params = {
        SecretId: secretId,
        ...(options.versionId && { VersionId: options.versionId }),
        ...(options.versionStage && { VersionStage: options.versionStage })
      };

      const response = await this.awsClient.getSecretValue(params).promise();
      
      // Parse JSON secrets
      if (response.SecretString) {
        try {
          return JSON.parse(response.SecretString);
        } catch {
          return { value: response.SecretString };
        }
      }
      
      // Handle binary secrets
      if (response.SecretBinary) {
        return { value: Buffer.from(response.SecretBinary, 'base64').toString() };
      }

      throw new Error('No secret data found');

    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        throw new Error(`Secret not found: ${secretId}`);
      }
      throw new Error(`AWS Secrets Manager retrieval failed: ${error.message}`);
    }
  }

  /**
   * Test connectivity to secret provider
   */
  async testConnection() {
    try {
      if (this.provider === 'env') {
        // Environment variables are always available
        return true;
      } else if (this.provider === 'vault') {
        await this.vaultClient.get('/v1/sys/health');
      } else if (this.provider === 'aws') {
        await this.awsClient.describeSecret({ SecretId: 'test-connection' }).promise();
      }
      
      console.log('Secret provider connection test successful', {
        provider: this.provider
      });
      
      return true;
    } catch (error) {
      console.warn('Secret provider connection test failed', {
        provider: this.provider,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Clear secret cache
   */
  clearCache() {
    this.secretCache.clear();
    console.log('Secret cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.secretCache.size,
      timeout: this.cacheTimeout,
      provider: this.provider
    };
  }
}

// Singleton instance
let secretManagerInstance = null;

/**
 * Get or create secret manager instance
 */
function getSecretManager(config) {
  if (!secretManagerInstance) {
    secretManagerInstance = new SecretManagerClient(config);
  }
  return secretManagerInstance;
}

/**
 * Helper function to get specific application secrets for node server
 */
async function getApplicationSecrets() {
  const secretManager = getSecretManager();
  
  try {
    // For environment provider, return values directly from environment variables
    if (secretManager.provider === 'env') {
      return {
        database: {
          uri: process.env.MONGODB_URI
        }
      };
    }

    // Define secret paths for different environments (for vault/aws providers)
    const environment = process.env.NODE_ENV || 'development';
    const secretPaths = {
      database: `node-server/${environment}/database`
    };

    // Retrieve database secrets
    const databaseSecrets = await secretManager.getSecret(secretPaths.database).catch(() => ({}));

    return {
      database: {
        uri: databaseSecrets.mongodb_uri
      }
    };

  } catch (error) {
    console.error('Failed to retrieve application secrets', {
      error: error.message
    });
    throw new Error(`Application secrets retrieval failed: ${error.message}`);
  }
}

module.exports = {
  SecretManagerClient,
  getSecretManager,
  getApplicationSecrets
};
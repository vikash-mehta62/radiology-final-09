/**
 * CSRF Token Utilities
 * Handles CSRF token extraction and injection for API requests
 */

/**
 * Get CSRF token from cookie
 * The server sets this cookie on GET requests
 */
export function getCSRFToken(): string | null {
  const name = 'XSRF-TOKEN';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    const token = parts.pop()?.split(';').shift();
    // Extract just the token value (before the signature)
    return token?.split('.')[0] || null;
  }
  
  return null;
}

/**
 * Add CSRF token to axios config
 */
export function addCSRFToken(config: any = {}): any {
  const token = getCSRFToken();
  
  if (token) {
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-XSRF-TOKEN': token
      }
    };
  }
  
  return config;
}

/**
 * Check if CSRF token is available
 */
export function hasCSRFToken(): boolean {
  return getCSRFToken() !== null;
}

/**
 * Wait for CSRF token to be available
 * Useful for ensuring token is set before making requests
 */
export async function waitForCSRFToken(maxWaitMs: number = 5000): Promise<string | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const token = getCSRFToken();
    if (token) {
      return token;
    }
    
    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return null;
}

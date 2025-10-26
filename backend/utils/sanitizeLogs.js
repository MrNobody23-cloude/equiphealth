/**
 * Utility functions to sanitize console logs and error messages
 * Removes API keys, tokens, passwords, and other sensitive data
 */

class LogSanitizer {
  constructor() {
    // Patterns to match and replace sensitive data
    this.sensitivePatterns = [
      // Google Maps API Key
      {
        pattern: /AIza[0-9A-Za-z-_]{35}/g,
        replacement: '[GOOGLE_MAPS_API_KEY]'
      },
      // Firebase API Key
      {
        pattern: /AIza[0-9A-Za-z-_]{35}/g,
        replacement: '[FIREBASE_API_KEY]'
      },
      // Gmail OAuth2 Client ID
      {
        pattern: /[0-9]+-[a-zA-Z0-9]+\.apps\.googleusercontent\.com/g,
        replacement: '[GMAIL_CLIENT_ID]'
      },
      // Gmail OAuth2 Client Secret
      {
        pattern: /GOCSPX-[a-zA-Z0-9-_]+/g,
        replacement: '[GMAIL_CLIENT_SECRET]'
      },
      // Refresh Token (long base64-like string)
      {
        pattern: /[0-9a-zA-Z-_]{50,}/g,
        replacement: '[REFRESH_TOKEN]'
      },
      // Access Token
      {
        pattern: /ya29\.[0-9A-Za-z-_]+/g,
        replacement: '[ACCESS_TOKEN]'
      },
      // Email passwords
      {
        pattern: /password\s*[:=]\s*['"]?[^'"\s]+['"]?/gi,
        replacement: 'password: [REDACTED]'
      },
      // MongoDB URI
      {
        pattern: /mongodb\+srv:\/\/[^:]+:[^@]+@/g,
        replacement: 'mongodb+srv://[USER]:[PASSWORD]@'
      },
      // Generic API keys (long alphanumeric strings)
      {
        pattern: /\b[A-Za-z0-9]{32,}\b/g,
        replacement: '[API_KEY]'
      }
    ];
  }

  /**
   * Sanitize a message by removing sensitive data
   */
  sanitize(message) {
    if (!message || typeof message !== 'string') {
      return message;
    }

    let sanitized = message;

    // Apply all sanitization patterns
    this.sensitivePatterns.forEach(({ pattern, replacement }) => {
      sanitized = sanitized.replace(pattern, replacement);
    });

    return sanitized;
  }

  /**
   * Sanitize an error object
   */
  sanitizeError(error) {
    if (!error) return error;

    const sanitized = { ...error };

    // Sanitize message
    if (sanitized.message) {
      sanitized.message = this.sanitize(sanitized.message);
    }

    // Sanitize stack trace
    if (sanitized.stack) {
      sanitized.stack = this.sanitize(sanitized.stack);
    }

    return sanitized;
  }

  /**
   * Safe console.warn that sanitizes messages
   */
  warn(message, ...args) {
    const sanitizedMessage = this.sanitize(message);
    console.warn(sanitizedMessage, ...args);
  }

  /**
   * Safe console.error that sanitizes messages
   */
  error(message, ...args) {
    const sanitizedMessage = this.sanitize(message);
    console.error(sanitizedMessage, ...args);
  }

  /**
   * Safe console.log that sanitizes messages
   */
  log(message, ...args) {
    const sanitizedMessage = this.sanitize(message);
    console.log(sanitizedMessage, ...args);
  }
}

// Export singleton instance
module.exports = new LogSanitizer();

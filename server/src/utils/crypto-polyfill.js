/**
 * UUID Generator using uuid library
 * Provides cross-platform UUID v4 generation compatible with all Node.js versions
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Generate a UUID v4 using the uuid library
 * @returns {string} UUID v4 string
 */
function randomUUID() {
  return uuidv4();
}

module.exports = { randomUUID };

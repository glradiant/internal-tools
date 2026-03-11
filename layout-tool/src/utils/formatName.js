/**
 * Formats a name with proper capitalization.
 * Handles edge cases like McCall, O'Brien, McDonald, etc.
 *
 * @param {string} name - The name to format
 * @returns {string} - The properly formatted name
 */
export function formatName(name) {
  if (!name || typeof name !== 'string') return '';

  // Check if already properly formatted (has capital letters in expected positions)
  // Don't modify if it looks intentionally formatted (e.g., McCall, O'Brien)
  const hasInternalCaps = /[a-z][A-Z]/.test(name) || /[''][A-Z]/.test(name);
  if (hasInternalCaps) {
    // Just trim and return - user has intentional formatting
    return name.trim();
  }

  return name
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';

      // Handle hyphenated names (Mary-Jane -> Mary-Jane)
      if (word.includes('-')) {
        return word.split('-').map(part => capitalizeWord(part)).join('-');
      }

      // Handle apostrophes (o'brien -> O'Brien)
      if (word.includes("'") || word.includes("'")) {
        const parts = word.split(/['']/);
        return parts.map(part => capitalizeWord(part)).join("'");
      }

      return capitalizeWord(word);
    })
    .join(' ');
}

/**
 * Capitalizes a single word, handling Mc/Mac prefixes
 */
function capitalizeWord(word) {
  if (!word) return '';

  const lower = word.toLowerCase();

  // Handle Mc prefix (McDonald, McCall, etc.)
  if (lower.startsWith('mc') && lower.length > 2) {
    return 'Mc' + lower.charAt(2).toUpperCase() + lower.slice(3);
  }

  // Handle Mac prefix (but not words like "mack" - only if 4+ chars after Mac)
  if (lower.startsWith('mac') && lower.length > 5) {
    return 'Mac' + lower.charAt(3).toUpperCase() + lower.slice(4);
  }

  // Standard capitalization
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default formatName;

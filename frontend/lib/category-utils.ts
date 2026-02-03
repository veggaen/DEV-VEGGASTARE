// Utility functions for category operations

// Normalize string for matching (lowercase, remove special chars, trim)
export function normalizeForMatching(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')
    .trim();
}

// Create slug from string
export function createSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Simple Levenshtein distance for fuzzy matching
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1, higher is more similar)
export function calculateSimilarity(query: string, target: string): number {
  const normalizedQuery = normalizeForMatching(query);
  const normalizedTarget = normalizeForMatching(target);

  // Exact match
  if (normalizedQuery === normalizedTarget) return 1;

  // Contains match (target contains query)
  if (normalizedTarget.includes(normalizedQuery)) {
    return 0.9 - (normalizedTarget.length - normalizedQuery.length) * 0.01;
  }

  // Starts with match
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return 0.85;
  }

  // Levenshtein-based similarity
  const maxLen = Math.max(normalizedQuery.length, normalizedTarget.length);
  if (maxLen === 0) return 0;

  const distance = levenshteinDistance(normalizedQuery, normalizedTarget);
  return Math.max(0, 1 - distance / maxLen);
}

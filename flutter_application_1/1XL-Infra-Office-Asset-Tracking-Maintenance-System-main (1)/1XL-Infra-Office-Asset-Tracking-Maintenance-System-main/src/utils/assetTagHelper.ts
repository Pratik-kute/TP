/**
 * Smart Asset Tag Generation
 *
 * Format: {CATEGORY_ABBREV}-{ORG_SHORT}-{BATCH}-{SEQ}
 * Example: ACR-1XL-01-001 (Air Conditioner, org 1XL, batch 01, sequence 001)
 */

const CONSONANTS = new Set('BCDFGHJKLMNPQRSTVWXYZ');

/**
 * Generate a 3-4 character abbreviation from a category name.
 *
 * Rules:
 * - Single word (e.g., "Laptop") → first 3 uppercase letters → "LAP"
 * - Multi-word (e.g., "Air Conditioner") → first letter of each word → "AC"
 *   - If result < 3 chars, pad with consonants from the first word → "ACR"
 * - Always uppercase, max 4 chars
 */
export function generateCategoryAbbrev(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return 'GEN'; // fallback for empty category

  const words = trimmed.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 1) {
    // Single word: take first 3 letters
    return words[0].substring(0, 3).toUpperCase();
  }

  // Multi-word: first letter of each word
  let abbrev = words.map(w => w.charAt(0).toUpperCase()).join('');

  // If abbreviation is less than 3 chars, pad with consonants from first word
  if (abbrev.length < 3) {
    const firstWord = words[0].toUpperCase();
    for (let i = 1; i < firstWord.length && abbrev.length < 3; i++) {
      const ch = firstWord.charAt(i);
      if (CONSONANTS.has(ch)) {
        abbrev += ch;
      }
    }
    // If still < 3 chars (rare), pad with remaining chars from first word
    if (abbrev.length < 3) {
      for (let i = 1; i < firstWord.length && abbrev.length < 3; i++) {
        const ch = firstWord.charAt(i);
        if (!abbrev.includes(ch) || abbrev.length < 3) {
          abbrev += ch;
        }
      }
    }
  }

  // Max 4 chars
  return abbrev.substring(0, 4).toUpperCase();
}

/**
 * Extract the sequence number from an existing tag.
 * Tag format: ABBREV-ORG-BATCH-SEQ (e.g., ACR-1XL-01-001)
 * Returns the sequence number or 0 if not matching the prefix.
 */
function extractSequence(tag: string, prefix: string): number {
  if (!tag.startsWith(prefix)) return 0;
  const seqStr = tag.substring(prefix.length);
  const num = parseInt(seqStr, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Generate a new asset tag.
 *
 * @param category - Free-text category name (e.g., "Air Conditioner")
 * @param orgShortName - Organization short name (e.g., "1XL")
 * @param existingTags - All current asset tags in the system
 * @param deletedTags - All deleted asset tags (to avoid reuse)
 * @param batch - Batch identifier (default "01")
 * @returns Generated tag like "ACR-1XL-01-001"
 */
export function generateAssetTag(
  category: string,
  orgShortName: string,
  existingTags: string[],
  deletedTags: string[],
  batch: string = '01'
): string {
  const abbrev = generateCategoryAbbrev(category);
  const org = orgShortName.toUpperCase();
  const prefix = `${abbrev}-${org}-${batch}-`;

  // Find max sequence among existing and deleted tags with the same prefix
  const allTags = [...existingTags, ...deletedTags];
  let maxSeq = 0;
  for (const tag of allTags) {
    const seq = extractSequence(tag, prefix);
    if (seq > maxSeq) maxSeq = seq;
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Check if an asset tag is available (not used by active or deleted assets).
 */
export function isTagAvailable(
  tag: string,
  existingTags: string[],
  deletedTags: string[]
): boolean {
  const upperTag = tag.toUpperCase();
  return (
    !existingTags.some(t => t.toUpperCase() === upperTag) &&
    !deletedTags.some(t => t.toUpperCase() === upperTag)
  );
}

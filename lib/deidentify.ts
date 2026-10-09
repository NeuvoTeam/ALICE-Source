/**
 * lib/deidentify.ts
 *
 * Client-side de-identification utility to scrub PII before transmission
 * to external LLM endpoints (APP 8 compliance).
 */

export interface DeidentifyOptions {
  knownNames?: string[];
}

export function deidentify(text: string, options?: DeidentifyOptions): { text: string; redactions: number } {
  if (!text) return { text, redactions: 0 };
  
  let scrubbed = text;
  let redactions = 0;
  
  // 1. Redact known names (case-insensitive, whole word match)
  if (options?.knownNames && options.knownNames.length > 0) {
    for (const name of options.knownNames) {
      if (!name || name.trim().length < 2) continue; // Skip very short or empty names
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      
      const prev = scrubbed;
      scrubbed = scrubbed.replace(regex, '[CLIENT]');
      
      // Count redactions (approximate by length diff if we didn't use a replacer fn, 
      // but simpler: just count matches before replace)
      const matches = prev.match(regex);
      if (matches) {
        redactions += matches.length;
      }
    }
  }

  // 2. Redact emails
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emailMatches = scrubbed.match(emailRegex);
  if (emailMatches) {
    redactions += emailMatches.length;
    scrubbed = scrubbed.replace(emailRegex, '[EMAIL]');
  }

  // 3. Redact AU phone numbers (basic matching)
  // E.g. 0412 345 678, 0412345678, +61 412 345 678
  const phoneRegex = /(?:\+?61|0)[ \-]?[2-478][ \-]?[0-9]{4}[ \-]?[0-9]{4}\b/g;
  const phoneMatches = scrubbed.match(phoneRegex);
  if (phoneMatches) {
    redactions += phoneMatches.length;
    scrubbed = scrubbed.replace(phoneRegex, '[PHONE]');
  }
  
  // 4. Redact Medicare-style numbers (10 digits)
  const medicareRegex = /\b\d{4}[ \-]?\d{5}[ \-]?\d{1}\b/g;
  const medicareMatches = scrubbed.match(medicareRegex);
  if (medicareMatches) {
    redactions += medicareMatches.length;
    scrubbed = scrubbed.replace(medicareRegex, '[MEDICARE]');
  }
  
  // 5. Redact DOB-like dates (DD/MM/YYYY or DD-MM-YYYY)
  const dateRegex = /\b(?:0[1-9]|[12][0-9]|3[01])[\/\-](?:0[1-9]|1[012])[\/\-](?:19|20)\d\d\b/g;
  const dateMatches = scrubbed.match(dateRegex);
  if (dateMatches) {
    redactions += dateMatches.length;
    scrubbed = scrubbed.replace(dateRegex, '[DATE]');
  }

  return { text: scrubbed, redactions };
}

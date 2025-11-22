/**
 * Privacy filter for AI-generated content.
 * Detects and redacts potentially identifying information from AI analysis results.
 */

import { PrivacyFilterResult, PRIVACY_VIOLATION_PATTERNS } from './ai-metadata';

/**
 * Check AI-generated content for privacy violations.
 *
 * @param content - The content to check (typically AI summary or tags)
 * @returns PrivacyFilterResult indicating if content is clean
 */
export function checkPrivacy(content: string): PrivacyFilterResult {
  const violations: PrivacyFilterResult['violations'] = [];

  // Check identity patterns
  for (const pattern of PRIVACY_VIOLATION_PATTERNS.identity) {
    if (pattern.test(content)) {
      violations.push({
        type: 'identity',
        description: `Detected potential identity marker: ${pattern}`,
      });
    }
  }

  // Check license plate patterns
  for (const pattern of PRIVACY_VIOLATION_PATTERNS.licensePlate) {
    if (pattern.test(content)) {
      violations.push({
        type: 'license-plate',
        description: `Detected potential license plate: ${pattern}`,
      });
    }
  }

  // Check specific person descriptions
  for (const pattern of PRIVACY_VIOLATION_PATTERNS.specificPerson) {
    if (pattern.test(content)) {
      violations.push({
        type: 'specific-person',
        description: `Detected specific person description: ${pattern}`,
      });
    }
  }

  // Check agency-specific markers
  for (const pattern of PRIVACY_VIOLATION_PATTERNS.agency) {
    if (pattern.test(content)) {
      violations.push({
        type: 'agency',
        description: `Detected agency-specific marker: ${pattern}`,
      });
    }
  }

  // If no violations, content is clean
  if (violations.length === 0) {
    return {
      isClean: true,
      violations: [],
    };
  }

  // Attempt redaction
  let cleanedContent = content;
  let redactionSuccessful = true;

  // Try to remove problematic phrases
  for (const pattern of [
    ...PRIVACY_VIOLATION_PATTERNS.identity,
    ...PRIVACY_VIOLATION_PATTERNS.licensePlate,
    ...PRIVACY_VIOLATION_PATTERNS.specificPerson,
    ...PRIVACY_VIOLATION_PATTERNS.agency,
  ]) {
    // Replace matched patterns with generic placeholder
    const replaced = cleanedContent.replace(pattern, '[REDACTED]');
    if (replaced !== cleanedContent) {
      cleanedContent = replaced;
    }
  }

  // Check if redacted content is still meaningful
  if (cleanedContent.includes('[REDACTED]')) {
    // Redaction partially successful, but content may be degraded
    redactionSuccessful = false;
  }

  return {
    isClean: false,
    violations,
    cleanedContent: redactionSuccessful ? cleanedContent : undefined,
  };
}

/**
 * Validate AI metadata for privacy compliance.
 * Checks summary and tags for violations.
 *
 * @param summary - AI-generated summary text
 * @param tags - AI-generated tags array
 * @returns Combined privacy check result
 */
export function validateAIMetadata(
  summary: string,
  tags: string[]
): PrivacyFilterResult {
  // Check summary
  const summaryCheck = checkPrivacy(summary);

  // Check all tags
  const tagCheck = checkPrivacy(tags.join(' '));

  // Combine results
  const allViolations = [...summaryCheck.violations, ...tagCheck.violations];

  if (allViolations.length === 0) {
    return {
      isClean: true,
      violations: [],
    };
  }

  // If either summary or tags have violations, metadata is not clean
  return {
    isClean: false,
    violations: allViolations,
    cleanedContent: summaryCheck.cleanedContent,
  };
}

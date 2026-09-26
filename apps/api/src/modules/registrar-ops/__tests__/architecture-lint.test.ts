/**
 * PrisNames — Architecture Lint Test
 *
 * Verifies that business modules DO NOT import @prisnames/registrar-dynadot.
 * Only the composition root (registrar.module.ts) is allowed to import the provider.
 *
 * Also verifies provider order IDs are never parsed as numbers in business code.
 *
 * Reference: Phase 6 Implementation Plan §15.1
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BUSINESS_MODULES_DIR = join(import.meta.dirname, '../..');
const ALLOWED_DYNADOT_IMPORTERS = [
  // The composition root is the ONLY place allowed to import @prisnames/registrar-dynadot
  'registrar/registrar.module.ts',
  // Webhook ingestion needs provider-specific signature verification
  'webhooks/webhook-ingestion.service.ts',
];

function collectTypeScriptFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && entry !== 'node_modules' && entry !== '__tests__') {
      collectTypeScriptFiles(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Architecture Boundary', () => {
  it('should not import @prisnames/registrar-dynadot in business modules', () => {
    const files = collectTypeScriptFiles(BUSINESS_MODULES_DIR);
    const violations: string[] = [];

    // Pattern matches actual import/require, not comments
    const importPattern = /(?:from\s+['"]@prisnames\/registrar-dynadot|require\s*\(\s*['"]@prisnames\/registrar-dynadot)/;

    for (const file of files) {
      const relativePath = relative(BUSINESS_MODULES_DIR, file);
      if (ALLOWED_DYNADOT_IMPORTERS.some(a => relativePath.endsWith(a))) continue;

      const content = readFileSync(file, 'utf-8');
      if (importPattern.test(content)) {
        violations.push(relativePath);
      }
    }

    expect(violations, `Business modules importing @prisnames/registrar-dynadot: ${violations.join(', ')}`).toHaveLength(0);
  });

  it('should not use parseInt/Number on provider order IDs in registrar-ops', () => {
    const opsDir = join(BUSINESS_MODULES_DIR, 'registrar-ops');
    const files = collectTypeScriptFiles(opsDir);
    const violations: string[] = [];

    const DANGEROUS_PATTERNS = [
      /parseInt\s*\(\s*(?:providerOrderId|provider_order_id)/,
      /Number\s*\(\s*(?:providerOrderId|provider_order_id)/,
      /\+\s*(?:providerOrderId|provider_order_id)/,
    ];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(relative(opsDir, file));
        }
      }
    }

    expect(violations, `Files using parseInt/Number on provider order IDs: ${violations.join(', ')}`).toHaveLength(0);
  });
});

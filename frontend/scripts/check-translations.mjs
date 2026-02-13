#!/usr/bin/env node

/**
 * Translation Coverage Checker
 *
 * This script compares translation files to ensure all keys exist in all locales.
 * It helps maintain translation parity across all supported languages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MESSAGES_DIR = path.join(__dirname, '../messages');
const LOCALES = ['en', 'pt-br'];
const BASE_LOCALE = 'en'; // The locale to compare against

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Recursively get all keys from a nested object
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Load translation file
 */
function loadTranslations(locale) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log(`Error loading ${locale}.json: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Check if a key exists in an object by dot notation path
 */
function hasKey(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return false;
    }
    current = current[key];
  }

  return true;
}

/**
 * Main function
 */
function main() {
  log('\n========================================', 'bright');
  log('  Translation Coverage Report', 'bright');
  log('========================================\n', 'bright');

  // Load all translation files
  const translations = {};
  const allKeys = {};

  for (const locale of LOCALES) {
    translations[locale] = loadTranslations(locale);
    allKeys[locale] = getAllKeys(translations[locale]);
    log(`✓ Loaded ${locale}.json (${allKeys[locale].length} keys)`, 'green');
  }

  console.log('');

  // Compare each locale against the base locale
  const baseKeys = allKeys[BASE_LOCALE];
  const issues = {
    missing: {},
    extra: {},
  };

  for (const locale of LOCALES) {
    if (locale === BASE_LOCALE) continue;

    issues.missing[locale] = [];
    issues.extra[locale] = [];

    // Find keys in base locale but missing in this locale
    for (const key of baseKeys) {
      if (!hasKey(translations[locale], key)) {
        issues.missing[locale].push(key);
      }
    }

    // Find keys in this locale but not in base locale
    for (const key of allKeys[locale]) {
      if (!hasKey(translations[BASE_LOCALE], key)) {
        issues.extra[locale].push(key);
      }
    }
  }

  // Report findings
  let hasIssues = false;

  for (const locale of LOCALES) {
    if (locale === BASE_LOCALE) continue;

    const missing = issues.missing[locale];
    const extra = issues.extra[locale];

    if (missing.length === 0 && extra.length === 0) {
      log(`✓ ${locale}: All translations match base locale`, 'green');
    } else {
      hasIssues = true;

      if (missing.length > 0) {
        log(`\n⚠ ${locale}: Missing ${missing.length} key(s) from ${BASE_LOCALE}:`, 'yellow');
        missing.forEach(key => {
          log(`  - ${key}`, 'yellow');
        });
      }

      if (extra.length > 0) {
        log(`\n⚠ ${locale}: Has ${extra.length} extra key(s) not in ${BASE_LOCALE}:`, 'cyan');
        extra.forEach(key => {
          log(`  - ${key}`, 'cyan');
        });
      }
    }
  }

  // Summary
  console.log('');
  log('========================================', 'bright');

  if (hasIssues) {
    log('  Status: Issues Found', 'red');
    log('========================================\n', 'bright');

    log('Recommendations:', 'yellow');
    log('1. Missing keys: Add translations to match base locale', 'yellow');
    log('2. Extra keys: Either add to base locale or remove if unused\n', 'yellow');

    process.exit(1);
  } else {
    log('  Status: All translations in sync! ✓', 'green');
    log('========================================\n', 'bright');
    process.exit(0);
  }
}

// Run the script
main();

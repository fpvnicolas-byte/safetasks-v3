# Internationalization (i18n) Guide

This project uses [next-intl](https://next-intl-docs.vercel.app/) for internationalization with Next.js 15.

## Configuration

### Centralized Config

All i18n configuration is centralized in [`i18n/config.ts`](./config.ts):

```typescript
// Supported locales
export const locales = ['en', 'pt-br'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'en';

// Locale display names and flags
export const localeNames: Record<Locale, string> = {
  en: 'English',
  'pt-br': 'Português BR',
};
```

This single source of truth is used by:
- Middleware
- Layout
- Language selector
- Request configuration

## Supported Languages

- 🇺🇸 English (`en`) - Default
- 🇧🇷 Portuguese Brazil (`pt-br`)

## Architecture

### URL Structure

All routes are prefixed with the locale:
- `/en/dashboard` - Dashboard in English
- `/pt-br/dashboard` - Dashboard in Portuguese
- `/en/auth/login` - Login page in English

The middleware enforces `localePrefix: 'always'`, ensuring every route has a locale.

### File Structure

```
frontend/
├── i18n/
│   ├── config.ts          # Centralized configuration
│   ├── request.ts         # Server-side config for next-intl
│   └── README.md          # This file
├── messages/
│   ├── en.json           # English translations (base)
│   └── pt-br.json        # Portuguese translations
├── middleware.ts          # Route and auth middleware with i18n
└── app/
    └── [locale]/         # Locale-aware routes
```

## Adding Translations

### 1. Update Translation Files

Add your keys to both `messages/en.json` and `messages/pt-br.json`:

```json
// en.json
{
  "dashboard": {
    "welcome": "Welcome, {email}!",
    "actions": {
      "newProject": {
        "title": "New Project",
        "desc": "Start a new film project"
      }
    }
  }
}
```

### 2. Use in Components

```typescript
'use client';

import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('dashboard');

  return (
    <div>
      <h1>{t('welcome', { email: user.email })}</h1>
      <button>{t('actions.newProject.title')}</button>
    </div>
  );
}
```

### 3. Multiple Namespaces

```typescript
const t = useTranslations('dashboard');
const tCommon = useTranslations('common');

return (
  <>
    <h1>{t('welcome')}</h1>
    <button>{tCommon('save')}</button>
  </>
);
```

## Locale-Aware Links

**Important:** All internal links must be locale-aware to maintain the current language.

### Use LocaleLink Component

```typescript
import { LocaleLink } from '@/components/LocaleLink';

<LocaleLink href="/dashboard">Dashboard</LocaleLink>
<LocaleLink href="/projects/new">New Project</LocaleLink>
```

The `LocaleLink` component automatically prefixes URLs with the current locale.

### For Navigation

```typescript
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

const locale = useLocale();
const router = useRouter();

// Navigate with locale
router.push(`/${locale}/dashboard`);
```

## Language Switching

The `LanguageSelector` component provides a dropdown for switching languages:

```typescript
import { LanguageSelector } from '@/components/LanguageSelector';

<Header>
  <LanguageSelector />
</Header>
```

It automatically:
- Shows the current language with flag
- Lists all available languages
- Preserves the current route when switching
- Refreshes to update server components

## Translation Coverage

### Check Translation Parity

Run the translation checker to ensure all keys exist in all locales:

```bash
npm run check-translations
```

This script:
- Compares all translation files against the base locale (English)
- Reports missing keys in each language
- Reports extra keys not in the base
- Exits with error if issues are found

### Example Output

```
✓ Loaded en.json (431 keys)
✓ Loaded pt-br.json (431 keys)
✓ pt-br: All translations match base locale

Status: All translations in sync! ✓
```

## Adding a New Language

1. **Add locale to config** (`i18n/config.ts`):
```typescript
export const locales = ['en', 'pt-br', 'es'] as const;

export const localeNames: Record<Locale, string> = {
  en: 'English',
  'pt-br': 'Português BR',
  es: 'Español',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  'pt-br': '🇧🇷',
  es: '🇪🇸',
};
```

2. **Create translation file** (`messages/es.json`):
```json
{
  "common": { ... },
  "auth": { ... },
  ...
}
```

3. **Test coverage**:
```bash
npm run check-translations
```

The middleware, layout, and language selector will automatically support the new locale.

## Best Practices

### 1. Use Semantic Keys

❌ Bad:
```json
{
  "button1": "Save",
  "text2": "Click here"
}
```

✅ Good:
```json
{
  "actions": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "messages": {
    "clickToView": "Click here to view details"
  }
}
```

### 2. Group Related Keys

```json
{
  "dashboard": {
    "welcome": "Welcome!",
    "actions": {
      "newProject": "New Project",
      "viewAll": "View All"
    }
  }
}
```

### 3. Support Interpolation

```json
{
  "greeting": "Hello, {name}!",
  "itemCount": "You have {count} items"
}
```

Usage:
```typescript
t('greeting', { name: 'Alice' })
t('itemCount', { count: 5 })
```

### 4. Keep Keys in Sync

Always run `npm run check-translations` before committing to ensure translation parity.

### 5. Use LocaleLink for Internal Navigation

❌ Bad:
```typescript
<Link href="/dashboard">Dashboard</Link>
```

✅ Good:
```typescript
<LocaleLink href="/dashboard">Dashboard</LocaleLink>
```

## Server Components

For server components, use the `getTranslations` function:

```typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('dashboard');

  return <h1>{t('title')}</h1>;
}
```

## Error Handling

The i18n configuration includes robust error handling:

1. **Invalid locale**: Falls back to default locale (English)
2. **Missing message file**: Attempts to load fallback locale
3. **Missing translation key**: Displays the key path (next-intl default)

## Testing

### Manual Testing

1. Switch language via LanguageSelector
2. Navigate between pages
3. Verify translations appear correctly
4. Check that locale persists in URL

### Automated Testing

```bash
# Check translation coverage
npm run check-translations

# Type check (includes locale types)
npm run type-check
```

## Troubleshooting

### Links Don't Preserve Locale

**Problem**: Clicking a link loses the current language

**Solution**: Use `LocaleLink` instead of Next.js `Link`:
```typescript
import { LocaleLink } from '@/components/LocaleLink';
<LocaleLink href="/page">Go to Page</LocaleLink>
```

### Translation Not Showing

**Problem**: `t('key')` shows the key instead of translation

**Solutions**:
1. Check if key exists in message file
2. Verify namespace matches: `useTranslations('namespace')`
3. Run `npm run check-translations`
4. Check for typos in key path

### Locale Not in URL

**Problem**: Routes don't have `/en/` or `/pt-br/` prefix

**Solution**: The middleware enforces `localePrefix: 'always'`. This is correct behavior.

## Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [Configuration File](./config.ts)
- [Translation Files](../messages/)

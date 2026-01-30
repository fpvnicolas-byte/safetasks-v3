'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { type Locale } from '@/i18n/config';
import { ComponentPropsWithoutRef } from 'react';

/**
 * Locale-aware Link component that automatically prefixes URLs with the current locale
 */
export function LocaleLink({ href, ...props }: ComponentPropsWithoutRef<typeof Link>) {
    const locale = useLocale() as Locale;

    // Convert href to string if it's an object
    const hrefString = typeof href === 'string' ? href : href.pathname || '/';

    // Build locale-prefixed path
    // Remove any leading slash and add it back with locale prefix
    const cleanPath = hrefString.startsWith('/') ? hrefString.slice(1) : hrefString;
    const localizedHref = `/${locale}/${cleanPath}`;

    return <Link href={localizedHref} {...props} />;
}

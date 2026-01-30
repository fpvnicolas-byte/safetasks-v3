'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { locales, localeNames, localeFlags, getLocaleFromPathname, type Locale } from '@/i18n/config';

export function LanguageSelector() {
    const locale = useLocale() as Locale;
    const router = useRouter();
    const pathname = usePathname();

    const handleLanguageChange = (newLocale: Locale) => {
        // Extract the current locale from pathname
        const currentLocaleFromPath = getLocaleFromPathname(pathname);

        // Remove current locale prefix and get the base path
        const pathWithoutLocale = currentLocaleFromPath
            ? pathname.replace(`/${currentLocaleFromPath}`, '')
            : pathname;

        // Ensure we have a leading slash
        const basePath = pathWithoutLocale || '/';

        // Build the new path with the new locale
        const newPath = `/${newLocale}${basePath}`;

        router.push(newPath);
        router.refresh();
    };

    // Build languages array from centralized config
    const languages = locales.map((loc) => ({
        code: loc,
        label: localeNames[loc],
        flag: localeFlags[loc],
    }));

    const currentLanguage = languages.find(lang => lang.code === locale) || languages[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentLanguage.flag} {currentLanguage.label}</span>
                    <span className="sm:hidden">{currentLanguage.flag}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {languages.map((language) => (
                    <DropdownMenuItem
                        key={language.code}
                        onClick={() => handleLanguageChange(language.code)}
                        className={locale === language.code ? 'bg-accent' : ''}
                    >
                        <span className="mr-2">{language.flag}</span>
                        {language.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

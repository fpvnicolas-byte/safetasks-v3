import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, getValidLocale, type Locale } from './config';

export default getRequestConfig(async (params) => {
    // In next-intl v3/v4, use requestLocale or params argument
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { requestLocale } = params as any;
    const requestedLocale = await requestLocale;

    // Use centralized validation and fallback logic
    const locale: Locale = getValidLocale(requestedLocale);

    try {
        // Dynamically import the locale's messages
        const messages = (await import(`../messages/${locale}.json`)).default;

        return {
            locale,
            messages,
        };
    } catch (error) {
        // If message file fails to load, try loading default locale
        console.error(`[i18n] Failed to load messages for locale "${locale}":`, error);

        if (locale !== defaultLocale) {
            console.warn(`[i18n] Falling back to default locale "${defaultLocale}"`);
            try {
                const fallbackMessages = (await import(`../messages/${defaultLocale}.json`)).default;
                return {
                    locale: defaultLocale,
                    messages: fallbackMessages,
                };
            } catch (fallbackError) {
                console.error(`[i18n] Failed to load fallback messages:`, fallbackError);
            }
        }

        // If all else fails, return 404
        notFound();
    }
});

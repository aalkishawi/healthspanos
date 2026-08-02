import en, { type Dictionary } from "./dictionaries/en";
import ar from "./dictionaries/ar";
import { DEFAULT_LOCALE, type Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

export type { Dictionary };
export * from "./config";

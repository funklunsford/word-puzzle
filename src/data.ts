/** The build's data version (see vite.config.ts). */
declare const __DATA_VERSION__: string;

/** URL of a data file in public/, versioned so a browser never pairs new code with old cached data. */
export const dataUrl = (file: string) => `${import.meta.env.BASE_URL}${file}?v=${__DATA_VERSION__}`;

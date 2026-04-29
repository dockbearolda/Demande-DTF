const DEV = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

export const logger = {
  warn: (...args: unknown[]) => {
    if (DEV) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (DEV) console.error(...args);
  },
  info: (...args: unknown[]) => {
    if (DEV) console.info(...args);
  },
};

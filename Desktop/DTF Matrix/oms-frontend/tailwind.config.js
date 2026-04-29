/** @type {import('tailwindcss').Config} */
//
// Token mapping for Tailwind utilities. Every value below MUST
// be a `var(--token)` reference into src/styles/design-tokens.css.
// New raw values do not belong here — extend the token file first.
//
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ----- Canonical palette (new, design-tokens.css backed) -----
        ink: {
          25:  "var(--ink-25)",
          50:  "var(--ink-50)",
          100: "var(--ink-100)",
          200: "var(--ink-200)",
          300: "var(--ink-300)",
          400: "var(--ink-400)",
          500: "var(--ink-500)",
          600: "var(--ink-600)",
          700: "var(--ink-700)",
          800: "var(--ink-800)",
          900: "var(--ink-900)",
        },
        accent: {
          50:  "var(--accent-50)",
          100: "var(--accent-100)",
          500: "var(--accent-500)",
          600: "var(--accent-600)",
          700: "var(--accent-700)",
        },
        positive: {
          100: "var(--positive-100)",
          500: "var(--positive-500)",
        },
        warning: {
          100: "var(--warning-100)",
          500: "var(--warning-500)",
        },
        danger: {
          DEFAULT: "var(--danger-500)",
          100: "var(--danger-100)",
          500: "var(--danger-500)",
        },

        // ----- Legacy aliases (preserved for existing markup) -----
        // Remap to canonical tokens — same color, two names.
        brand: {
          50:  "var(--accent-50)",
          100: "#CDD4CD",
          300: "var(--brand-duck-300)",
          500: "var(--accent-500)",
          600: "var(--accent-600)",
          700: "var(--accent-700)",
        },
        duck: {
          200: "var(--brand-duck-200)",
          300: "var(--brand-duck-300)",
          400: "var(--brand-duck-400)",
          500: "var(--accent-500)",
        },
        sage: {
          DEFAULT: "var(--brand-sage)",
          50:  "var(--brand-sage-50)",
          100: "var(--brand-sage-100)",
        },
        linen: "var(--brand-linen)",
        paper: {
          DEFAULT: "var(--brand-paper)",
          hi: "var(--brand-paper-hi)",
        },
        urgent: {
          DEFAULT: "var(--warning-500)",
          soft: "var(--warning-100)",
          ink: "var(--color-urgent-ink)",
        },
        fg: {
          1: "var(--ink-800)",
          2: "var(--ink-700)",
          3: "var(--ink-600)",
          4: "var(--ink-400)",
        },
      },

      // ----- Spacing (4pt scale, prefixed s-* to avoid colliding
      //               with Tailwind's default numeric scale) -----
      spacing: {
        "s-1":  "var(--s-1)",
        "s-2":  "var(--s-2)",
        "s-3":  "var(--s-3)",
        "s-4":  "var(--s-4)",
        "s-5":  "var(--s-5)",
        "s-6":  "var(--s-6)",
        "s-7":  "var(--s-7)",
        "s-8":  "var(--s-8)",
        "s-9":  "var(--s-9)",
        "s-10": "var(--s-10)",
        "s-11": "var(--s-11)",
        "s-12": "var(--s-12)",
        "s-13": "var(--s-13)",
        "s-14": "var(--s-14)",
        "s-15": "var(--s-15)",
        "s-16": "var(--s-16)",
        "s-17": "var(--s-17)",
        "s-18": "var(--s-18)",
        "s-19": "var(--s-19)",
        "s-20": "var(--s-20)",
      },

      borderRadius: {
        "r-1":   "var(--r-1)",
        "r-2":   "var(--r-2)",
        "r-3":   "var(--r-3)",
        "r-4":   "var(--r-4)",
        "r-5":   "var(--r-5)",
        "r-pill": "var(--r-pill)",
      },

      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        3: "var(--shadow-3)",
      },

      fontFamily: {
        display: "var(--font-display)",
        text:    "var(--font-text)",
        mono:    "var(--font-mono)",
        // Default sans kept so any unscoped Tailwind class still
        // resolves to the new text family.
        sans:    "var(--font-text)",
      },

      transitionTimingFunction: {
        snap: "var(--ease-snap)",
        "out-soft": "var(--ease-out)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        mid:  "var(--dur-mid)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      maxWidth: {
        "quote": "1320px",
      },
    },
  },
  plugins: [],
};

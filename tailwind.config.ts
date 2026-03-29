import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["DM Sans", "Inter", "system-ui", "sans-serif"],
        display: ["Syne", "DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.2)" },
          "50%": { boxShadow: "0 0 40px hsl(var(--primary) / 0.4)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-in-left": "slide-in-left 0.5s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: 'hsl(var(--foreground))',
            maxWidth: 'none',
            hr: {
              borderColor: 'hsl(var(--border))',
              marginTop: '3em',
              marginBottom: '3em',
            },
            'h1, h2, h3, h4': {
              color: 'hsl(var(--foreground))',
              fontWeight: '700',
              fontFamily: theme('fontFamily.display').join(', '),
              letterSpacing: '-0.02em',
              marginTop: '1.6em',
              marginBottom: '0.6em',
              lineHeight: '1.1',
            },
            h1: {
              fontSize: '2.25em',
            },
            h2: {
              fontSize: '1.875em',
              borderBottom: '1px solid hsl(var(--border) / 0.5)',
              paddingBottom: '0.4em',
            },
            h3: {
              fontSize: '1.5em',
            },
            p: {
              marginTop: '1.25em',
              marginBottom: '1.25em',
              lineHeight: '1.8',
              color: 'hsl(var(--muted-foreground))',
            },
            'ul, ol': {
              marginTop: '1.25em',
              marginBottom: '1.25em',
              paddingLeft: '1.5em',
            },
            li: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            'li > p': {
              marginTop: '0.25em',
              marginBottom: '0.25em',
            },
            strong: {
              color: 'hsl(var(--foreground))',
              fontWeight: '600',
            },
            a: {
              color: 'hsl(var(--primary))',
              textDecoration: 'none',
              fontWeight: '600',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            blockquote: {
              borderLeftColor: 'hsl(var(--primary))',
              backgroundColor: 'hsl(var(--muted) / 0.3)',
              padding: '1em 1.5em',
              borderRadius: theme('borderRadius.lg'),
              fontStyle: 'italic',
              color: 'hsl(var(--foreground))',
            },
          },
        },
        invert: {
          css: {
            color: 'hsl(var(--foreground))',
            'h1, h2, h3, h4, strong, blockquote': {
              color: 'hsl(var(--foreground))',
            },
            p: {
              color: 'hsl(var(--muted-foreground))',
            },
          },
        },
      }),
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
} satisfies Config;
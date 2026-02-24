import { definePreset } from "@primeuix/themes";
import Aura from "@primeuix/themes/aura";

// Tema personalizado basado en Aura con paleta de colores indigo/violeta
export const YegoPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: "#eef2ff",
      100: "#e0e7ff",
      200: "#c7d2fe",
      300: "#a5b4fc",
      400: "#818cf8",
      500: "#6366f1",
      600: "#4f46e5",
      700: "#4338ca",
      800: "#3730a3",
      900: "#312e81",
      950: "#1e1b4b",
    },
    colorScheme: {
      light: {
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        primary: {
          color: "{primary.600}",
          contrastColor: "#ffffff",
          hoverColor: "{primary.700}",
          activeColor: "{primary.800}",
        },
        highlight: {
          background: "{primary.50}",
          focusBackground: "{primary.100}",
          color: "{primary.700}",
          focusColor: "{primary.800}",
        },
        content: {
          background: "{surface.0}",
          hoverBackground: "{surface.50}",
          borderColor: "{surface.200}",
          color: "{surface.800}",
          hoverColor: "{surface.900}",
        },
        overlay: {
          background: "{surface.0}",
          borderColor: "{surface.200}",
          color: "{surface.800}",
        },
      },
      dark: {
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        primary: {
          color: "{primary.400}",
          contrastColor: "{surface.900}",
          hoverColor: "{primary.300}",
          activeColor: "{primary.200}",
        },
        highlight: {
          background: "color-mix(in srgb, {primary.500}, transparent 84%)",
          focusBackground: "color-mix(in srgb, {primary.500}, transparent 76%)",
          color: "rgba(255,255,255,.87)",
          focusColor: "rgba(255,255,255,.87)",
        },
        content: {
          background: "{surface.900}",
          hoverBackground: "{surface.800}",
          borderColor: "{surface.700}",
          color: "{surface.0}",
          hoverColor: "{surface.0}",
        },
        overlay: {
          background: "{surface.900}",
          borderColor: "{surface.700}",
          color: "{surface.0}",
        },
      },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: "0.75rem",
      },
    },
    card: {
      root: {
        borderRadius: "1rem",
      },
    },
    inputtext: {
      root: {
        borderRadius: "0.75rem",
      },
    },
    tag: {
      root: {
        borderRadius: "0.5rem",
      },
    },
    badge: {
      root: {
        borderRadius: "0.5rem",
      },
    },
    progressbar: {
      root: {
        borderRadius: "0.5rem",
      },
    },
    dialog: {
      root: {
        borderRadius: "1.25rem",
      },
    },
  },
});

// Configuración de PrimeVue - Forzar modo claro
export const primeVueConfig = {
  theme: {
    preset: YegoPreset,
    options: {
      prefix: "p",
      darkModeSelector: false, // Desactivar modo oscuro automático
      cssLayer: false,
    },
  },
  ripple: true,
  inputVariant: "outlined",
};

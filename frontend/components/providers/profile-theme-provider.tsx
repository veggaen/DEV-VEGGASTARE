'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { extractColorsFromImage } from '@/lib/color-extraction';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileThemeColors {
  primary: string;       // Main extracted color
  secondary: string;     // Second prominent color
  accent: string;        // Third/accent color
  contrast: string;      // Complementary color for CTA highlights
  // HSL components for CSS variable usage
  primaryHsl: string;    // "H S% L%" format for var() usage
  secondaryHsl: string;
  accentHsl: string;
  contrastHsl: string;
}

interface ProfileThemeContextValue {
  /** Current extracted colors (null when not on a tinted page) */
  colors: ProfileThemeColors | null;
  /** Whether colors are currently loading */
  isLoading: boolean;
  /** Apply theme colors from a banner image URL */
  applyFromBanner: (bannerUrl: string | null) => void;
  /** Apply theme colors from a hex color directly */
  applyFromColor: (hexColor: string) => void;
  /** Clear all theme overrides (return to neutral) */
  clearTheme: () => void;
  /** Whether theme tinting is currently active */
  isTinted: boolean;
}

const ProfileThemeContext = createContext<ProfileThemeContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Color Utilities
// ─────────────────────────────────────────────────────────────────────────────

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 50 };
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { 
    h: Math.round(h * 360), 
    s: Math.round(s * 100), 
    l: Math.round(l * 100) 
  };
}

function hslToHslString(hsl: { h: number; s: number; l: number }): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

function getComplementaryColor(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  const newH = (h + 180) % 360;
  // Boost saturation and adjust lightness for visibility
  const newS = Math.min(100, s * 1.2);
  const newL = l < 50 ? Math.min(75, l + 25) : Math.max(35, l - 20);
  
  // Convert back to hex
  const hslToRgb = (h: number, s: number, l: number) => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };
  
  return hslToRgb(newH, newS, newL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProfileThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ProfileThemeColors | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTinted, setIsTinted] = useState(false);

  // Apply CSS variables to document root
  useEffect(() => {
    if (!colors) {
      // Remove tinting
      document.documentElement.removeAttribute('data-theme-tinted');
      document.documentElement.style.removeProperty('--theme-accent');
      document.documentElement.style.removeProperty('--theme-accent-foreground');
      document.documentElement.style.removeProperty('--theme-accent-muted');
      document.documentElement.style.removeProperty('--theme-primary');
      document.documentElement.style.removeProperty('--theme-secondary');
      document.documentElement.style.removeProperty('--theme-contrast');
      setIsTinted(false);
      return;
    }

    // Apply tinting
    document.documentElement.setAttribute('data-theme-tinted', 'true');
    
    // Determine foreground based on theme and color brightness
    const primaryHsl = hexToHsl(colors.primary);
    const isDark = resolvedTheme === 'dark';
    const isColorDark = primaryHsl.l < 50;
    
    // For the accent foreground, ensure good contrast
    const accentForeground = isDark 
      ? (isColorDark ? '0 0% 98%' : '0 0% 4%')
      : (isColorDark ? '0 0% 98%' : '0 0% 9%');
    
    // Muted variant - desaturated and adjusted for mode
    const mutedL = isDark ? Math.max(15, primaryHsl.l - 30) : Math.min(95, primaryHsl.l + 30);
    const mutedS = Math.max(10, primaryHsl.s - 40);
    const accentMuted = `${primaryHsl.h} ${mutedS}% ${mutedL}%`;

    document.documentElement.style.setProperty('--theme-accent', colors.primaryHsl);
    document.documentElement.style.setProperty('--theme-accent-foreground', accentForeground);
    document.documentElement.style.setProperty('--theme-accent-muted', accentMuted);
    document.documentElement.style.setProperty('--theme-primary', colors.primaryHsl);
    document.documentElement.style.setProperty('--theme-secondary', colors.secondaryHsl);
    document.documentElement.style.setProperty('--theme-contrast', colors.contrastHsl);
    
    setIsTinted(true);
  }, [colors, resolvedTheme]);

  const applyFromColor = useCallback((hexColor: string) => {
    const primary = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
    const primaryHsl = hexToHsl(primary);
    
    // Generate secondary by shifting hue
    const secondaryH = (primaryHsl.h + 30) % 360;
    const secondary = `hsl(${secondaryH}, ${primaryHsl.s}%, ${primaryHsl.l}%)`;
    const secondaryHex = `#${[secondaryH, primaryHsl.s, primaryHsl.l].join('')}`; // Simplified
    
    // Generate accent by shifting hue the other way
    const accentH = (primaryHsl.h + 330) % 360;
    const accentHex = getComplementaryColor(primary); // Use complementary for contrast
    
    const contrast = getComplementaryColor(primary);
    const contrastHsl = hexToHsl(contrast);

    setColors({
      primary,
      secondary: secondaryHex,
      accent: accentHex,
      contrast,
      primaryHsl: hslToHslString(primaryHsl),
      secondaryHsl: `${secondaryH} ${primaryHsl.s}% ${primaryHsl.l}%`,
      accentHsl: `${accentH} ${primaryHsl.s}% ${primaryHsl.l}%`,
      contrastHsl: hslToHslString(contrastHsl),
    });
  }, []);

  const applyFromBanner = useCallback(async (bannerUrl: string | null) => {
    if (!bannerUrl) {
      setColors(null);
      return;
    }

    setIsLoading(true);
    try {
      const extracted = await extractColorsFromImage(bannerUrl);
      
      const primaryHsl = hexToHsl(extracted.primary);
      const secondaryHsl = hexToHsl(extracted.secondary);
      const accentHsl = hexToHsl(extracted.accent);
      const contrastHsl = hexToHsl(extracted.primaryContrast);

      setColors({
        primary: extracted.primary,
        secondary: extracted.secondary,
        accent: extracted.accent,
        contrast: extracted.primaryContrast,
        primaryHsl: hslToHslString(primaryHsl),
        secondaryHsl: hslToHslString(secondaryHsl),
        accentHsl: hslToHslString(accentHsl),
        contrastHsl: hslToHslString(contrastHsl),
      });
    } catch (err) {
      console.error('Failed to extract banner colors:', err);
      setColors(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearTheme = useCallback(() => {
    setColors(null);
  }, []);

  const value = useMemo<ProfileThemeContextValue>(() => ({
    colors,
    isLoading,
    applyFromBanner,
    applyFromColor,
    clearTheme,
    isTinted,
  }), [colors, isLoading, applyFromBanner, applyFromColor, clearTheme, isTinted]);

  return (
    <ProfileThemeContext.Provider value={value}>
      {children}
    </ProfileThemeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useProfileTheme(): ProfileThemeContextValue {
  const ctx = useContext(ProfileThemeContext);
  if (!ctx) {
    throw new Error('useProfileTheme must be used within ProfileThemeProvider');
  }
  return ctx;
}

/**
 * Hook to automatically apply profile theming when a banner URL changes.
 * Use this in profile pages to automatically tint the theme.
 * 
 * @example
 * function ProfilePage({ user }) {
 *   useProfileThemeFromBanner(user.banner);
 *   return <div>...</div>;
 * }
 */
export function useProfileThemeFromBanner(bannerUrl: string | null | undefined) {
  const { applyFromBanner, clearTheme } = useProfileTheme();
  
  useEffect(() => {
    if (bannerUrl) {
      applyFromBanner(bannerUrl);
    } else {
      clearTheme();
    }
    
    // Clear theme when unmounting
    return () => {
      clearTheme();
    };
  }, [bannerUrl, applyFromBanner, clearTheme]);
}

export default ProfileThemeProvider;


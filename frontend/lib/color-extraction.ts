'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface DominantColors {
  primary: string;
  secondary: string;
  accent: string;
  // Computed contrast colors
  primaryContrast: string;
  secondaryContrast: string;
  accentContrast: string;
  // Light/dark variants
  primaryLight: string;
  primaryDark: string;
  secondaryLight: string;
  // For backgrounds
  bgTint: string;
  bgGlow: string;
  isDark: boolean;
}

type ThemeMode = 'light' | 'dark';

/**
 * Convert hex to RGB values
 */
function hexToRgbValues(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 99, g: 102, b: 241 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
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
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
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
  return { r: r * 255, g: g * 255, b: b * 255 };
}

/**
 * Get complementary/contrast color (opposite on color wheel)
 */
function getContrastColor(hex: string): string {
  const { r, g, b } = hexToRgbValues(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  // Rotate hue by 180 degrees for complementary color
  const newH = (h + 180) % 360;
  // Boost saturation and adjust lightness for visibility
  const newS = Math.min(100, s * 1.2);
  const newL = l < 50 ? Math.min(80, l + 30) : Math.max(40, l - 20);
  const rgb = hslToRgb(newH, newS, newL);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Get a lighter version of a color
 */
function getLighterColor(hex: string, amount: number = 30): string {
  const { r, g, b } = hexToRgbValues(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const newL = Math.min(90, l + amount);
  const rgb = hslToRgb(h, s, newL);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Get a darker version of a color
 */
function getDarkerColor(hex: string, amount: number = 20): string {
  const { r, g, b } = hexToRgbValues(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const newL = Math.max(10, l - amount);
  const rgb = hslToRgb(h, s, newL);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Get a subtle background tint (very low opacity version)
 */
function getBgTint(hex: string): string {
  const { r, g, b } = hexToRgbValues(hex);
  const { h, s } = rgbToHsl(r, g, b);
  // Very dark, slightly saturated version for dark mode backgrounds
  const rgb = hslToRgb(h, Math.min(40, s), 8);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function getBgTintForMode(hex: string, mode: ThemeMode): string {
  if (mode === 'dark') return getBgTint(hex);

  const { r, g, b } = hexToRgbValues(hex);
  const { h, s } = rgbToHsl(r, g, b);
  // Very light, slightly saturated tint for light mode backgrounds
  const rgb = hslToRgb(h, Math.min(35, s), 96);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function applyModeToColors(base: DominantColors, mode: ThemeMode): DominantColors {
  // Treat extracted colors as the “true” palette, then derive mode-friendly variants.
  const primary = mode === 'light' ? getLighterColor(base.primary, 18) : getDarkerColor(base.primary, 18);
  const secondary = mode === 'light' ? getLighterColor(base.secondary, 18) : getDarkerColor(base.secondary, 18);
  const accent = mode === 'light' ? getLighterColor(base.accent, 18) : getDarkerColor(base.accent, 18);

  const primaryContrast = getContrastColor(primary);
  const secondaryContrast = getContrastColor(secondary);
  const accentContrast = getContrastColor(accent);

  const primaryBrightness = (() => {
    const rgb = hexToRgbValues(primary);
    return (rgb.r + rgb.g + rgb.b) / 3;
  })();

  return {
    primary,
    secondary,
    accent,
    primaryContrast,
    secondaryContrast,
    accentContrast,
    // Keep providing both variants for UI usage
    primaryLight: getLighterColor(primary, 18),
    primaryDark: getDarkerColor(primary, 18),
    secondaryLight: getLighterColor(secondary, 18),
    bgTint: getBgTintForMode(primary, mode),
    bgGlow: getGlowColor(primary),
    isDark: primaryBrightness < 128,
  };
}

/**
 * Get a glow color (bright, saturated)
 */
function getGlowColor(hex: string): string {
  const { r, g, b } = hexToRgbValues(hex);
  const { h } = rgbToHsl(r, g, b);
  // High saturation, medium-high lightness for glow effect
  const rgb = hslToRgb(h, 80, 60);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Extract dominant colors from an image URL
 * Uses canvas to sample pixels and find the most common colors
 */
export function extractColorsFromImage(imageUrl: string): Promise<DominantColors> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Scale down for performance
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Build color frequency map using color quantization
        const colorCounts: Map<string, { count: number; r: number; g: number; b: number; saturation: number }> = new Map();
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // Skip transparent or near-transparent pixels
          if (a < 128) continue;
          
          // Calculate saturation to prioritize vibrant colors
          const { s, l } = rgbToHsl(r, g, b);
          
          // Skip very dark (black) or very light (white) colors
          if (l < 15 || l > 90) continue;
          
          // Skip very desaturated colors (grays)
          if (s < 15) continue;
          
          // Quantize colors to reduce noise (round to nearest 16)
          const qr = Math.round(r / 16) * 16;
          const qg = Math.round(g / 16) * 16;
          const qb = Math.round(b / 16) * 16;
          
          const key = `${qr},${qg},${qb}`;
          const existing = colorCounts.get(key);
          
          // Weight by saturation - prefer vibrant colors
          const weight = 1 + (s / 100);
          
          if (existing) {
            existing.count += weight;
            // Average the actual colors for smoother result
            existing.r = (existing.r * (existing.count - weight) + r * weight) / existing.count;
            existing.g = (existing.g * (existing.count - weight) + g * weight) / existing.count;
            existing.b = (existing.b * (existing.count - weight) + b * weight) / existing.count;
            existing.saturation = Math.max(existing.saturation, s);
          } else {
            colorCounts.set(key, { count: weight, r, g, b, saturation: s });
          }
        }
        
        // Sort by frequency (weighted by saturation) and get top colors
        const sortedColors = Array.from(colorCounts.values())
          .sort((a, b) => (b.count * b.saturation) - (a.count * a.saturation))
          .slice(0, 15);
        
        if (sortedColors.length === 0) {
          // Fallback to default colors
          resolve(getDefaultColors());
          return;
        }
        
        // Get distinct colors by ensuring they're different enough
        const distinctColors: { r: number; g: number; b: number }[] = [];
        for (const color of sortedColors) {
          const isDifferent = distinctColors.every(existing => {
            const diff = Math.abs(existing.r - color.r) + 
                        Math.abs(existing.g - color.g) + 
                        Math.abs(existing.b - color.b);
            return diff > 80; // Minimum color difference
          });
          
          if (isDifferent) {
            distinctColors.push(color);
          }
          
          if (distinctColors.length >= 3) break;
        }
        
        // Fill in missing colors with variations
        while (distinctColors.length < 3) {
          const base = distinctColors[0];
          const { h, s, l } = rgbToHsl(base.r, base.g, base.b);
          // Create variations by shifting hue
          const newH = (h + 30 * distinctColors.length) % 360;
          const rgb = hslToRgb(newH, s, l);
          distinctColors.push(rgb);
        }
        
        // Convert to hex
        const primary = rgbToHex(distinctColors[0].r, distinctColors[0].g, distinctColors[0].b);
        const secondary = rgbToHex(distinctColors[1].r, distinctColors[1].g, distinctColors[1].b);
        const accent = rgbToHex(distinctColors[2].r, distinctColors[2].g, distinctColors[2].b);
        
        // Determine if the dominant color is dark
        const primaryBrightness = (distinctColors[0].r + distinctColors[0].g + distinctColors[0].b) / 3;
        
        resolve({
          primary,
          secondary,
          accent,
          primaryContrast: getContrastColor(primary),
          secondaryContrast: getContrastColor(secondary),
          accentContrast: getContrastColor(accent),
          primaryLight: getLighterColor(primary),
          primaryDark: getDarkerColor(primary),
          secondaryLight: getLighterColor(secondary),
          bgTint: getBgTint(primary),
          bgGlow: getGlowColor(primary),
          isDark: primaryBrightness < 128,
        });
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}

function getDefaultColors(): DominantColors {
  return {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#10b981',
    primaryContrast: '#f97316',
    secondaryContrast: '#84cc16',
    accentContrast: '#ec4899',
    primaryLight: '#60a5fa',
    primaryDark: '#1d4ed8',
    secondaryLight: '#a78bfa',
    bgTint: '#0c1929',
    bgGlow: '#3b82f6',
    isDark: false,
  };
}

/**
 * Hook to extract colors from a banner image
 */
export function useBannerColors(bannerUrl: string | null | undefined) {
  const [rawColors, setRawColors] = useState<DominantColors | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { resolvedTheme } = useTheme();

  // Dark-first default if theme hasn't resolved yet.
  const mode: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark';

  useEffect(() => {
    if (!bannerUrl) {
      return;
    }

    let mounted = true;
    const startTimeoutId = window.setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);

    extractColorsFromImage(bannerUrl)
      .then((extractedColors) => {
        if (mounted) {
          setRawColors(extractedColors);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setLoading(false);
          // Set default colors on error
          setRawColors(getDefaultColors());
        }
      });

    return () => {
      mounted = false;
      window.clearTimeout(startTimeoutId);
    };
  }, [bannerUrl]);

  const effectiveRawColors = bannerUrl ? rawColors : null;
  const colors = effectiveRawColors ? applyModeToColors(effectiveRawColors, mode) : null;
  return { colors, loading, error };
}

/**
 * Generate CSS custom properties for theming based on extracted colors
 */
export function generateColorStyles(colors: DominantColors | null): React.CSSProperties {
  if (!colors) {
    return {};
  }

  const primaryRgb = hexToRgbValues(colors.primary);
  const secondaryRgb = hexToRgbValues(colors.secondary);
  const accentRgb = hexToRgbValues(colors.accent);
  const contrastRgb = hexToRgbValues(colors.primaryContrast);

  return {
    '--theme-primary': colors.primary,
    '--theme-secondary': colors.secondary,
    '--theme-accent': colors.accent,
    '--theme-primary-contrast': colors.primaryContrast,
    '--theme-secondary-contrast': colors.secondaryContrast,
    '--theme-accent-contrast': colors.accentContrast,
    '--theme-primary-light': colors.primaryLight,
    '--theme-primary-dark': colors.primaryDark,
    '--theme-secondary-light': colors.secondaryLight,
    '--theme-bg-tint': colors.bgTint,
    '--theme-bg-glow': colors.bgGlow,
    '--theme-primary-rgb': `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`,
    '--theme-secondary-rgb': `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`,
    '--theme-accent-rgb': `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    '--theme-contrast-rgb': `${contrastRgb.r}, ${contrastRgb.g}, ${contrastRgb.b}`,
  } as React.CSSProperties;
}

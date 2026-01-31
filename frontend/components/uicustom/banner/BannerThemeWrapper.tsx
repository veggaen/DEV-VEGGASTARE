'use client';

import * as React from 'react';
import { useBannerColors, generateColorStyles } from '@/lib/color-extraction';

type Props = {
  bannerUrl?: string | null;
  children: React.ReactNode;
  className?: string;
};

export default function BannerThemeWrapper({ bannerUrl, children, className }: Props) {
  const { colors } = useBannerColors(bannerUrl);
  const themeStyles = generateColorStyles(colors);

  return (
    <div
      className={className ?? ''}
      style={{
        ...themeStyles,
        backgroundColor: colors?.bgTint || undefined,
      }}
    >
      {colors ? (
        <div
          className="fixed inset-0 pointer-events-none opacity-30"
          style={{
            background: `radial-gradient(ellipse at top, ${colors.primary}15, transparent 55%), radial-gradient(ellipse at bottom right, ${colors.secondary}10, transparent 45%)`,
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

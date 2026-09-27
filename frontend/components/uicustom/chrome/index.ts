/**
 * @fileOverview  App chrome kernel — the primitives every route shares. Import
 *                from here so pages never re-implement the header, rail, brand
 *                mark or background: `@/components/uicustom/chrome`.
 * @stability     evolving
 */
export { BrandMark, BRAND_NAME, type BrandMarkProps, type BrandMarkSize } from "./brand-mark";
export { AppRail, RailAction, type RailItem, type RailVariant } from "./app-rail";
export { AppHeader } from "./app-header";
export { Atmosphere, type AtmosphereVariant } from "./atmosphere";
export { ThemeToggle, runThemeCrossfade } from "./theme-toggle";
export { MobileDock } from "./mobile-dock";

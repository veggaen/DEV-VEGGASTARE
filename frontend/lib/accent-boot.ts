/**
 * @fileOverview  Parser-time accent bootstrap. Like the theme/consent boot
 *                scripts: read the saved accent preset from the UI preferences
 *                and stamp it on <html> before hydration so a user who picked
 *                "violet" never sees a sky/emerald flash. Mirrors the runtime
 *                logic in components/providers/ui-preferences.tsx (the provider
 *                stays the source of truth once mounted).
 * @stability     stable
 */
export const ACCENT_PRESET_IDS = ["sky", "emerald", "violet", "rose", "amber", "mono"] as const;

export const ACCENT_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("veggastare:uiPreferences")||"null");var a=p&&p.accent;if(${JSON.stringify(ACCENT_PRESET_IDS)}.indexOf(a)>=0)document.documentElement.setAttribute("data-accent",a)}catch(e){}})();`;

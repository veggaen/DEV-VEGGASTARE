/** Presentation only: never grants consent, writes storage or loads telemetry. */
export const CONSENT_VISIBILITY_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem("veggat:cookieConsent")||"null");if(c&&c.version===1&&typeof c.analytics==="boolean")document.documentElement.setAttribute("data-saved-consent","true")}catch(e){}})();`;

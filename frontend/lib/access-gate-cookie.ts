export function makeGateCookieValue(password: string | undefined | null): string {
  const safePassword = typeof password === "string" ? password : "";
  const base64 = base64EncodeUtf8(safePassword);
  // Keep this stable across runtimes (Edge + Node)
  return `granted_${base64.slice(0, 16)}`;
}

function base64EncodeUtf8(input: string): string {
  // Node.js / server runtime
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8").toString("base64");
  }

  // Edge / browser runtime
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

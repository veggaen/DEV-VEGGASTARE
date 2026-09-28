/**
 * @fileOverview  Detects "make me an image" requests typed casually into the
 *                chat so they can go to the image model instead of the text
 *                model. Deliberately conservative: a generation verb plus an
 *                image noun, or an explicit `/image` / `/imagine` command.
 *                Client-safe, no dependencies.
 * @stability     experimental
 */

const COMMAND = /^\s*\/(?:image|imagine|img)\s+([\s\S]{3,})$/i;
const VERB = "(?:generate|create|make|draw|paint|render|design|produce|illustrate|sketch|show me|give me|can you (?:generate|create|make|draw|paint|render|design)|please (?:generate|create|make|draw))";
const NOUN = "(?:image|picture|photo|photograph|illustration|artwork|art|logo|icon|poster|wallpaper|drawing|sketch|painting|banner|thumbnail|avatar|portrait|scene|render)";
const INTENT = new RegExp(`\\b${VERB}\\b[\\s\\S]{0,40}?\\b(?:an?|the|some|me an?|me a|me some)?\\s*${NOUN}s?\\b`, "i");

export type ImageIntent = { prompt: string };

/** Returns the prompt to send to the image model, or null when this is a normal chat message. */
export function detectImageIntent(text: string): ImageIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const command = COMMAND.exec(trimmed);
  if (command) return { prompt: command[1].trim() };
  if (trimmed.length > 1000) return null;
  if (!INTENT.test(trimmed)) return null;
  return { prompt: trimmed };
}

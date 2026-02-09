/**
 * Children slot fallback for /pulse layout.
 *
 * Required by Next.js parallel routes — when the active state of
 * the children slot can't be recovered (e.g. hard refresh on a
 * sub-route), this renders as the fallback.
 */
export default function PulseDefault() {
  return null
}

/**
 * Default slot for @modal — renders nothing when no pulse modal is open.
 * Required by Next.js parallel routes so the slot doesn't 404 on /pulse.
 */
export default function ModalDefault() {
  return null
}

/** @fileOverview Public legal text must remain readable even when hydration is unavailable. @stability stable */
// The root loading boundary otherwise sends a skeleton that needs JavaScript
// to reveal streamed content. This route is a synchronous, public publication:
// its fallback can safely show the same versioned text, never private data.
export { default } from './page';

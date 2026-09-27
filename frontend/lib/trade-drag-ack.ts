/**
 * @fileOverview  Drop-acceptance handshake for inventory → trade drags.
 *
 *                Native HTML drag-and-drop only tells the source whether *some*
 *                element set `dropEffect = "move"` — not whether that element
 *                actually took the item. The trade window sets "move" on every
 *                dragover, so releasing an item over it but outside a slot (or
 *                while the offer was locked/full) used to remove the item from
 *                the inventory with nowhere to go. Now a drop target explicitly
 *                acknowledges the payload it consumed, and the inventory only
 *                removes items that were acknowledged.
 * @stability     stable
 */

let acknowledged: string | null = null;

/** Called by a drop target right after it has actually placed the item. */
export function acknowledgeInventoryDrop(slotId: string) {
  acknowledged = slotId;
}

/** Called once by the drag source on dragend; returns true if that slot was taken. */
export function consumeInventoryDropAck(slotId: string): boolean {
  const ok = acknowledged === slotId;
  acknowledged = null;
  return ok;
}

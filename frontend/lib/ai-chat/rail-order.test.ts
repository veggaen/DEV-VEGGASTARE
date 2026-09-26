import { describe, expect, it } from 'vitest';
import { moveRail, orderRail, readRailOrder } from './rail-order';
describe('personal conversation order', () => {
  it('moves in either direction without dropping chats', () => { expect(moveRail(['a','b','c'], 'a', 'c')).toEqual(['b','c','a']); expect(moveRail(['a','b','c'], 'c', 'a')).toEqual(['c','a','b']); });
  it('ignores absent or identical targets', () => { expect(moveRail(['a','b'], 'x', 'b')).toEqual(['a','b']); expect(moveRail(['a','b'], 'a', 'a')).toEqual(['a','b']); });
  it('keeps new/unordered records in server order after custom ones', () => { expect(orderRail([{id:'x'},{id:'a'},{id:'y'},{id:'b'}], ['b','a']).map(row=>row.id)).toEqual(['b','a','x','y']); });
  it('validates, deduplicates and bounds stored IDs', () => { expect(readRailOrder('["a","a",3,"bad/id","b"]')).toEqual(['a','b']); expect(readRailOrder('{broken')).toEqual([]); expect(readRailOrder(JSON.stringify(Array.from({length:300},(_,i)=>`id-${i}`)))).toHaveLength(250); });
});

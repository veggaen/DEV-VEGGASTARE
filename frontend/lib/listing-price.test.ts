/** @fileOverview Listing-price typing and paste regressions. @stability stable */
import { describe, expect, it } from 'vitest';
import { listingPriceInputValue, parseListingPriceInput } from './listing-price';

describe('listing price input', () => {
  it.each([['0',0],['12',12],['12.',12],['12.34',12.34],['49,99',49.99],['.50',.5],[',50',.5],[' 49.99 ',49.99],['1000000',1000000]])('preserves %s as %s', (text,value)=>expect(parseListingPriceInput(text)).toBe(value));
  it.each(['','.',',','-1','1,234','1.234','1,234.56','12.3.4','€49.99','1e3','Infinity','1000000.01'])('rejects ambiguous or invalid %s without silently changing its amount',text=>expect(parseListingPriceInput(text)).toBeNaN());
  it('formats only finite values for the editable field',()=>{
    expect(listingPriceInputValue(49.99)).toBe('49.99');expect(listingPriceInputValue(0)).toBe('0');expect(listingPriceInputValue(NaN)).toBe('');
  });
});

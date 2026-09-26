import { expect, it } from 'vitest';
import { publicProductSpecifications, replacePublicProductSpecifications } from './product-specifications';

it.each([null, '{broken', {}, 42])('invalid specifications are not exposed: %j', value => {
  expect(publicProductSpecifications(value)).toBeNull();
});
it('keeps public facts and strips reserved keys from legacy JSON and arrays', () => {
  const specs = [{ key: '__repo_access', value: 'internal' }, { key: ' __private', value: 'internal' }, { key: 'Width', value: 42 }];
  for (const input of [specs, JSON.stringify(specs)]) expect(publicProductSpecifications(input)).toEqual([{ key: 'Width', value: '42' }]);
});
it('preserves internal settings while replacing public facts, rejecting injected settings', () => {
  expect(replacePublicProductSpecifications([{ key: '__repo_access', value: 'original' }, { key: 'Width', value: 42 }],
    [{ key: '__repo_access', value: 'injection' }, { key: 'Format', value: 'JPG' }]))
    .toEqual([{ key: 'Format', value: 'JPG' }, { key: '__repo_access', value: 'original' }]);
});

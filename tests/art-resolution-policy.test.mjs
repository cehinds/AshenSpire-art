import test from 'node:test';
import assert from 'node:assert/strict';
import { policyFor, twinDimensions } from '../tools/mobileart-policy.mjs';

test('landscape backgrounds retain 720p height, with portrait and small originals preserved', () => {
  const p = policyFor('bg/title-city-tower.webp');
  assert.deepEqual(twinDimensions({width:1920,height:1080},p),{width:1280,height:720});
  assert.deepEqual(twinDimensions({width:1024,height:1536},p),{width:480,height:720});
  assert.deepEqual(twinDimensions({width:600,height:400},p),{width:600,height:400});
  assert.equal(policyFor('environments/hollow-weald-map.webp').quality,p.quality);
});

test('four-scene atlases budget pixels per scene instead of shrinking each scene to 240p', () => {
  const p=policyFor('environments/hollow-weald-combat.webp');
  assert.deepEqual(twinDimensions({width:1536,height:1024},p),{width:1536,height:1024});
  assert.deepEqual(twinDimensions({width:3072,height:2048},p),{width:2160,height:1440});
  assert.deepEqual(twinDimensions({width:1536,height:1024},policyFor('environments/legacy/BS-ENV-01-background.webp')),{width:1080,height:720});
});

test('sprites stay at 480px with cheaper encoding, while cards retain their independent rule', () => {
  const p=policyFor('animations/bow/herald/BOW-01.webp');
  assert.deepEqual(twinDimensions({width:640,height:640},p),{width:480,height:480});
  assert.deepEqual(twinDimensions({width:200,height:100},p),{width:200,height:100});
  assert.ok(p.quality < 32);
  assert.equal(policyFor('cards/extended/card-strike-1024.webp').maxEdge,720);
  assert.equal(policyFor('cards/extended/card-strike-1024.webp').quality,44);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlugin, json } from './helpers.mjs';

test('anchor profile and works use verified website endpoints and paginate on scrolling', async () => {
  const { plugin } = await loadPlugin(({ url }) => {
    assert.equal(url.searchParams.get('uid'), '92');
    if (url.pathname === '/revision/user/basic') return json({ ret: 200, data: { uid: 92, nickName: 'Anchor', cover: '//imagev2.xmcdn.com/avatar.jpg', personalSignature: 'Introduction' } });
    if (url.pathname === '/revision/user/pub') return json({ ret: 200, data: { albumList: [{ id: 10, title: 'Show' }] } });
    assert.equal(url.pathname, '/revision/user/track');
    const page = Number(url.searchParams.get('page'));
    return json({ ret: 200, data: { page, maxCount: 31, trackList: Array.from({ length: page === 1 ? 30 : 1 }, (_, i) => ({ trackId: page * 100 + i, title: 'Episode', durationAsString: '21:09', anchorUid: 92 })) } });
  });
  const first = await plugin.artist({ id: '92' });
  assert.equal(first.artist.name, 'Anchor'); assert.equal(first.artist.description, 'Introduction');
  assert.equal(first.tracks[0].artists[0].id, '92'); assert.equal(first.tracks[0].duration, 1269000);
  assert.equal(first.shows[0].id, '10'); assert.equal(first.more, true);
  const next = await plugin.artist({ id: '92', offset: 30 });
  assert.equal(next.tracks[0].id, '200'); assert.equal(next.more, false); assert.deepEqual(next.shows, []);
  await assert.rejects(plugin.artist({ id: '../92' }), /ID/);
});

test('an optional anchor album request must not discard working profile and episodes', async () => {
  const { plugin } = await loadPlugin(({ url }) => {
    if (url.pathname.endsWith('/basic')) return json({ ret: 200, data: { uid: 92, nickName: 'Anchor' } });
    if (url.pathname.endsWith('/pub')) return json({ ret: 500 });
    return json({ ret: 200, data: { page: 1, maxCount: 1, trackList: [{ trackId: 100, title: 'Episode' }] } });
  });
  const result = await plugin.artist({ id: '92' });
  assert.equal(result.tracks.length, 1); assert.deepEqual(result.shows, []);
});

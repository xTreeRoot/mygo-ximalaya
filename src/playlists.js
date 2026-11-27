// 喜马拉雅官网的“我喜欢的声音”是账号同步列表；不把转载发布接口当作自建听单。
import { requireAccount } from './auth.js';
import { request } from './client.js';
import { epoch, assertCurrent } from './session.js';
import { toTrack } from './models.js';
import { PAGE_SIZE, idOf, offsetOf, fail } from './utils.js';

const target = { id: 'liked-tracks', name: '我喜欢的声音', mine: true, fixed: true, addable: true };
export async function playlists() { await requireAccount(); return [{ ...target }]; }

export async function liked({ offset = 0 } = {}) {
  offset = offsetOf(offset);
  if (offset % PAGE_SIZE || offset > 25000) throw new Error('喜欢列表分页已过期');
  await requireAccount();
  const pageNum = offset / PAGE_SIZE + 1;
  const { data } = await request('/revision/my/getLikeTracks', { pageNum, pageSize: PAGE_SIZE });
  if (!data || !Array.isArray(data.tracksList) || typeof data.hasMore !== 'boolean' ||
      (data.pageNum != null && Number(data.pageNum) !== pageNum)) throw new Error('喜马拉雅喜欢列表响应无效');
  if (data.hasMore && data.tracksList.length !== PAGE_SIZE) throw new Error('喜马拉雅喜欢列表不完整');
  return { tracks: data.tracksList.map(row => toTrack(row)), more: data.hasMore, nextOffset: offset + PAGE_SIZE };
}

export async function playlist({ id }) {
  if (id !== target.id) throw fail('unsupported', '没有这个喜马拉雅平台列表');
  const tracks = [], ids = new Set();
  for (let offset = 0; offset <= 25000; offset += PAGE_SIZE) {
    const page = await liked({ offset });
    for (const track of page.tracks) {
      if (ids.has(track.id)) throw new Error('喜马拉雅喜欢列表重复分页');
      ids.add(track.id); tracks.push(track);
    }
    if (!page.more) return { ...target, tracks };
  }
  throw new Error('喜欢列表超过可加载范围');
}

export async function isLiked({ ids }) {
  if (!Array.isArray(ids) || ids.length > 1000) throw new Error('无效的声音列表');
  const requested = ids.map(idOf);
  const saved = new Set((await playlist({ id: target.id })).tracks.map(track => track.id));
  return Object.fromEntries(requested.map(id => [id, saved.has(id)]));
}

export async function like({ id, on }) {
  id = idOf(id);
  if (typeof on !== 'boolean') throw new Error('无效的喜欢状态');
  await requireAccount();
  await request('/revision/like/' + (on ? 'setLikeTrack' : 'cancelLikeTrack'), {}, { body: { trackId: id } });
}
export const likeEpisode = like;

export async function addToPlaylist({ id, trackIds }) {
  if (id !== target.id) throw fail('unsupported', '只能添加到“我喜欢的声音”平台列表');
  if (!Array.isArray(trackIds) || !trackIds.length || trackIds.length > 100) throw new Error('无效的声音列表');
  const ids = [...new Set(trackIds.map(idOf))];
  await requireAccount();
  const generation = epoch();
  for (const trackId of ids) { assertCurrent(generation); await like({ id: trackId, on: true }); }
}

// Regress actual official website list and like contracts with synthetic sessions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPlugin, savedSession, profile, json } from './helpers.mjs';

test('platform target writes real liked-track forms and preserves account scoping', async()=>{
 const writes=[];
 const {plugin}=await loadPlugin(({url,init})=>{
  if(url.pathname==='/revision/main/getCurrentUser')return profile();
  if(url.pathname==='/revision/like/setLikeTrack' || url.pathname==='/revision/like/cancelLikeTrack'){
   assert.equal(init.method,'POST');assert.match(init.headers['Content-Type'],/urlencoded/);
   writes.push([url.pathname,new URLSearchParams(init.body).get('trackId')]);return json({ret:200});
  }
  assert.fail(url.pathname);
 },savedSession());
 const [target]=await plugin.playlists();assert.equal(target.mine,true);assert.equal(target.fixed,true);assert.equal(target.addable,true);
 await plugin.addToPlaylist({id:target.id,trackIds:['123','123']});
 await plugin.removeFromPlaylist({id:target.id,trackIds:['123']});
 assert.deepEqual(writes,[['/revision/like/setLikeTrack','123'],['/revision/like/cancelLikeTrack','123']]);
 await assert.rejects(plugin.addToPlaylist({id:'foreign',trackIds:['123']}),/我喜欢/);
 await assert.rejects(plugin.addToPlaylist({id:target.id,trackIds:['123','bad']}),/ID/);
 assert.equal(writes.length,2);
});

test('liked pages preserve official hasMore and refuse partial or repeated lists',async()=>{
 let broken=false;
 const {plugin}=await loadPlugin(({url})=>{
  if(url.pathname==='/revision/main/getCurrentUser')return profile();
  assert.equal(url.pathname,'/revision/my/getLikeTracks');
  const page=Number(url.searchParams.get('pageNum'));
  return json({ret:200,data:{pageNum:page,hasMore:page===1,tracksList:broken?[]:page===1?Array.from({length:30},(_,i)=>({trackId:100+i,title:'Track '+i})):[{trackId:999,title:'Tail'}]}});
 },savedSession());
 const first=await plugin.liked({offset:0});assert.equal(first.more,true);assert.equal(first.nextOffset,30);
 const tail=await plugin.liked({offset:30});assert.equal(tail.tracks[0].id,'999');assert.equal(tail.more,false);
 const list=await plugin.playlist({id:'liked-tracks'});assert.equal(list.tracks.length,31);
 assert.deepEqual(await plugin.isLiked({ids:['100','999','777']}),{'100':true,'999':true,'777':false});
 broken=true;await assert.rejects(plugin.liked(),/不完整/);
});

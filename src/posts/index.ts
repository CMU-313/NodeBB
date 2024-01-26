
import _ from 'lodash';

import db from '../database';
import utils from '../utils';
import user from '../user';
import privileges from '../privileges';
import plugins from '../plugins';

import {getPostsData} from './data';
import {parsePost} from './parse';
import {getPostSummaryByPids} from './summary';

export * from './data';
export * from './create';
export * from './delete';
export * from './edit';
export * from './user';
export * from './topics';
export * from './category';
export * from './summary';
export * from './recent';
export * from './tools';
export * from './votes';
export * from './bookmarks';
export * from './queue';
export * from './diffs';
export * from './uploads';

export * from '../promisify';


export async function exists(pids: number[]): Promise<boolean>{
    return await db.exists(
        Array.isArray(pids) ? pids.map(pid => `post:${pid}`) : `post:${pids}`
    );
}

export async function getPidsFromSet(set : any, start : number, stop : number, reverse : boolean): Promise<number[]>{
    if (isNaN(start) || isNaN(stop)){
        return [];
    }
    return await db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop);
}

export async function getPostsByPids(pids : number[], uid : number): Promise<any[]> {
    if (!Array.isArray(pids) || pids.length === 0) {
        return [];
    }

    let posts : any[] | null = await getPostsData(pids);
    posts = await Promise.all(posts.map(parsePost));

    const data : any = await plugins.hooks.fire('filter:post.getPosts', {posts: posts, uid: uid});

    if (!data || !Array.isArray(data.posts)){
        return [];
    }
    return data.posts.filter(Boolean);
}

export async function getPostSummariesFromSet(set : any, uid : number, start : number, stop : number): Promise<any> {
    let pids : any[] = await db.getSortedSetRevRange(set, start, stop);
    pids = await privileges.posts.filter('topics:read', pids, uid);

    const posts : any[] = await getPostSummaryByPids(pids, uid, {stripTags: false});

    return {posts: posts, nextStart: stop + 1};
}

export async function getPidIndex(pid : number, tid : number, topicPostSort : string): Promise<number> {
    const set : string = topicPostSort == 'most_votes' ? `tid:${tid}:posts:votes` : `tid:${tid}:posts`;
    const reverse : boolean = (topicPostSort === 'newest_to_oldest') || (topicPostSort === 'most_votes');
    const index : string = await db[reverse ? 'sortedSetRevRank' : 'sortedSetRank'](set, pid);

    if (utils.isNumber(index)){
        return parseInt(index, 10) + 1;
    }

    return 0;
}

export async function getPostIndices(posts: any[], uid: number): Promise<number[]> {
    if (posts.length === 0){
        return [];
    }

    const settings: any = await user.getSettings(uid);

    const byVotes: boolean = settings.topicPostSort === 'most_votes';
    let sets : any[] = posts.map(p => (byVotes ? `tid:${p.tid}:posts:votes` : `tid:${p.tid}:posts`));

    const reverse: boolean = (settings.topicPostSort === 'newest_to_oldest') || (settings.topicPostSort === 'most_votes');

    const uniqueSets = _.uniq(sets);
    let method: string = reverse ? 'sortedSetsRevRanks' : 'sortedSetsRanks';
    if (uniqueSets.length === 1){
        method = reverse ? 'sortedSetRevRanks' : 'sortedSetRanks';
        sets = uniqueSets[0];
    }

    const pids: number[] = posts.map(post => post.pid);
    const indices: string[] = await db[method](sets, pids);
    return indices.map(index => (utils.isNumber(index) ? parseInt(index, 10) + 1 : 0));
}

export async function modifyPostByPrivilege(post: any, privileges: any): Promise<void> {
    if (post && post.deleted && !(post.selfPost || privileges['posts:view_deleted'])) {
        post.content = '[[topic:post_is_deleted]]';
        if (post.user) {
            post.user.signature = '';
        }
    }
}

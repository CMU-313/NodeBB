import topics from '../topics';
import user from '../user';
import utils from '../utils';

type post={
    tid: boolean
}
type topicdata={
    mainPid: string,
    slug: number
}
type pid= string

type Posts ={
    getPostsFromSet: (set:string, start:string, stop:string, uid:string, reverse:boolean) => Promise<string[]>;
    getPidsFromSet: (set:string, start:string, stop:string, reverse:boolean) =>string[];
    getPostsByPids: (pids:pid[], uid:string) =>string[];
    getTopicFields: (id:pid, fields:string[]) =>Promise<topicdata[]>;
    isMain: (a: pid[]) => Promise<boolean>;
    getPostsFields: (pids:pid[], a:string[])=>Promise<post[]>;
    getPostField: (pid:pid, a:string)=>Promise<post>;
    generatePostPaths: (pid:pid[], uid:string) => Promise<string[]>;
    generatePostPath:(pid:pid, uid:string) => Promise<string>;
    getPostIndices: (postData:post[], uid:string)=>string[];

}
export = function Posts(Posts:Posts) {
    Posts.getPostsFromSet = async function (set:string, start:string,
        stop:string, uid:string, reverse:boolean):Promise<string[]> {
        const pids:string[] = Posts.getPidsFromSet(set, start, stop, reverse);
        const posts:string[] = Posts.getPostsByPids(pids, uid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await user.blocks.filter(uid, posts) as Promise<string[]>;
    };

    Posts.isMain = async function (pids: pid[]): Promise<boolean> {
        const postData: post[] = await Posts.getPostsFields(pids, ['tid']) as post[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const topicData:topicdata[] = await topics.getTopicsFields(postData.map(t => t.tid), ['mainPid']) as topicdata[];
        console.log(typeof pids);
        console.log('line 42');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result:boolean[] = pids.map((value, i) => parseInt(value, 10) === parseInt(topicData[i].mainPid, 10));
        return result[0];
    };

    Posts.getTopicFields = async function (pid: pid, fields: string[]): Promise<topicdata[]> {
        const tid: post = await Posts.getPostField(pid, 'tid') as post;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await topics.getTopicFields(tid, fields) as topicdata[];
    };

    Posts.generatePostPath = async function (pid:pid, uid:string) :Promise<string> {
        const paths:Promise<string[]> = Posts.generatePostPaths([pid], uid);
        return await paths[0] as Promise<string>;
    };

    Posts.generatePostPaths = async function (pids:pid[], uid:string) {
        const postData:post[] = await Posts.getPostsFields(pids, ['pid', 'tid']) as post[];
        const tids:boolean[] = postData.map(post => post && post.tid);
        const [indices, topicData]:[string[], topicdata[]] = await Promise.all([
            Posts.getPostIndices(postData, uid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topics.getTopicsFields(tids, ['slug']),
        ]) as [string[], topicdata[]];
        console.log(typeof pids);
        const paths: string[] = pids.map((pid, index) => {
            const slug:number = topicData[index] ? topicData[index].slug : null;
            const postIndex:number = utils.isNumber(indices[index]) ? parseInt(indices[index], 10) + 1 : null;

            if (slug && postIndex) {
                return `/topic/${slug}/${postIndex}`;
            }
            return null;
        });

        return paths;
    };
}

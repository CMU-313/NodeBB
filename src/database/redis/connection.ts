import nconf from 'nconf';
import Redis, { ChainableCommander, Cluster, ClusterNode, ClusterOptions, SentinelAddress } from 'ioredis';
import winston from 'winston';
import { Transaction } from 'ioredis/built/transaction';


type Options = {
    sentinels:Partial<SentinelAddress>[];
    cluster:ClusterNode[];
    host: string;
    options: ClusterOptions;
    password: string;
    database: number | string;
    port: number;
}

type Cxn = {
    batch : ChainableCommander;
    pipeline : ChainableCommander;
}

export default async function connect(options: Options):Promise<void> {
    return new Promise((resolve, reject) => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        options = options || nconf.get('redis');
        const redis_socket_or_host = options.host;

        let cxn: Cluster | Redis |Transaction|Cxn |void;
        if (options.cluster) {
            cxn = new Redis.Cluster(options.cluster, options.options);
        } else if (options.sentinels) {
            cxn = new Redis({
                sentinels: options.sentinels,
                ...options.options,
            });
        } else if (redis_socket_or_host && String(redis_socket_or_host).indexOf('/') >= 0) {
            // If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock
            cxn = new Redis({
                ...options.options,
                path: redis_socket_or_host,
                password: options.password,
                db: options.database as number,
            });
        } else {
            // Else, connect over tcp/ip
            cxn = new Redis({
                ...options.options,
                host: redis_socket_or_host,
                port: options.port,
                password: options.password,
                db: options.database as number,
            });
        }

        const dbIdx:number = parseInt(options.database as string, 10);
        if (!(dbIdx >= 0)) {
            throw new Error('[[error:no-database-selected]]');
        }

        (cxn as Cluster).on('error', (err) => {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-member-access
            winston.error(err.message);
            reject(err);
        });
        (cxn as Cluster).on('ready', () => {
            // back-compat with node_redis
            (cxn as Cxn).batch = (cxn as Cxn).pipeline;
            resolve(cxn as void);
        });

        if (options.password) {
            (cxn as Cluster).auth(options.password).catch(() => 'obligatory catch');
        }
    });
}



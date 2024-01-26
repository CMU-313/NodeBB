

import winston from 'winston';
import { CronJob } from 'cron';
import db from '../database';
import meta from '../meta';

interface Users {
  startJobs: () => void;
  stopJobs: () => void;
  reset: { clean: () => void; };
  digest: { execute: ({ interval }: {interval: string}) => Promise<void>; };
}

const jobs: {[key: string]: typeof CronJob} = {};
type CronJobFunction = () => Promise<void>;

export = function (User: Users): void {
    function startDigestJob(name: string, cronString: string, term: string): void {
        // The next line calls a function in a module that has not been updated to TS yet
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-call */
        jobs[name] = new CronJob(cronString, (async () => {
            winston.verbose(`[user/jobs] Digest job (${name}) started.`);
            try {
                if (name === 'digest.weekly') {
                    // The next line calls a function in a module that has not been updated to TS yet
                    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-call */
                    const counter: number = await db.increment('biweeklydigestcounter');
                    if (counter % 2) {
                        await User.digest.execute({ interval: 'biweek' });
                    }
                }
                await User.digest.execute({ interval: term });
            } catch (err) {
                if (err instanceof Error) winston.error(err.stack);
            }
        }) as CronJobFunction, null, true);
        winston.verbose(`[user/jobs] Starting job (${name})`);
    }

    User.startJobs = function () {
        winston.verbose('[user/jobs] (Re-)starting jobs...');

        let { digestHour }: Record<string, number> = meta.config;

        // Fix digest hour if invalid
        if (isNaN(digestHour)) {
            digestHour = 17;
        } else if (digestHour > 23 || digestHour < 0) {
            digestHour = 0;
        }

        User.stopJobs();

        startDigestJob('digest.daily', `0 ${digestHour} * * *`, 'day');
        startDigestJob('digest.weekly', `0 ${digestHour} * * 0`, 'week');
        startDigestJob('digest.monthly', `0 ${digestHour} 1 * *`, 'month');

        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-call */
        jobs['reset.clean'] = new CronJob('0 0 * * *', User.reset.clean, null, true);
        winston.verbose('[user/jobs] Starting job (reset.clean)');

        winston.verbose(`[user/jobs] jobs started`);
    };

    User.stopJobs = function (): void {
        let terminated = 0;
        // Terminate any active cron jobs
        for (const jobId of Object.keys(jobs)) {
            winston.verbose(`[user/jobs] Terminating job (${jobId})`);
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-call */
            jobs[jobId].stop();
            delete jobs[jobId];
            terminated += 1;
        }
        if (terminated > 0) {
            winston.verbose(`[user/jobs] ${terminated} jobs terminated`);
        }
    };
}

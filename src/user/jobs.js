"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston = __importStar(require("winston"));
const cron_1 = require("cron");
const db = __importStar(require("../database"));
const meta = __importStar(require("../meta"));
const jobs = {};
function cronJobFn(User) {
    function startDigestJob(name, cronString, term) {
        // The next line calls a function in a module that has not been updated to TS yet
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-call */
        jobs[name] = new cron_1.CronJob(cronString, () => __awaiter(this, void 0, void 0, function* () {
            winston.verbose(`[user/jobs] Digest job (${name}) started.`);
            try {
                if (name === 'digest.weekly') {
                    // The next line calls a function in a module that has not been updated to TS yet
                    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-call */
                    const counter = yield db.increment('biweeklydigestcounter');
                    if (counter % 2) {
                        yield User.digest.execute({ interval: 'biweek' });
                    }
                }
                yield User.digest.execute({ interval: term });
            }
            catch (err) {
                if (err instanceof Error)
                    winston.error(err.stack);
            }
        }), null, true);
        winston.verbose(`[user/jobs] Starting job (${name})`);
    }
    User.startJobs = function () {
        winston.verbose('[user/jobs] (Re-)starting jobs...');
        let { digestHour } = meta.config;
        // Fix digest hour if invalid
        if (isNaN(digestHour)) {
            digestHour = 17;
        }
        else if (digestHour > 23 || digestHour < 0) {
            digestHour = 0;
        }
        User.stopJobs();
        startDigestJob('digest.daily', `0 ${digestHour} * * *`, 'day');
        startDigestJob('digest.weekly', `0 ${digestHour} * * 0`, 'week');
        startDigestJob('digest.monthly', `0 ${digestHour} 1 * *`, 'month');
        jobs['reset.clean'] = new cron_1.CronJob('0 0 * * *', User.reset.clean, null, true);
        winston.verbose('[user/jobs] Starting job (reset.clean)');
        winston.verbose(`[user/jobs] jobs started`);
    };
    User.stopJobs = function () {
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
exports.default = cronJobFn;

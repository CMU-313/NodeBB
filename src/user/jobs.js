'use strict';

const winston = require('winston');
const cronJob = require('cron').CronJob;
const db = require('../database');
const meta = require('../meta');

const jobs = {};

function getDigesthour(dhour) {
	// Fix digest hour if invalid
	if (isNaN(dhour)) {
		return 17;
	}
	if (dhour > 23 || dhour < 0) {
		return 0;
	}
	return dhour;
}
	

function startResetCleanJob(User) {
	jobs['reset.clean'] = new cronJob('0 0 * * *', User.reset.clean, null, true);
	winston.verbose('[user/jobs] Starting job (reset.clean)');
}

module.exports = function (User) {
	User.startJobs = function () {
		winston.verbose('[user/jobs] (Re-)starting jobs...');
		console.log('Junkai Feng');

		const digestHour = getDigesthour(meta.config.digestHour);

		User.stopJobs();

		startDigestJob('digest.daily', `0 ${digestHour} * * *`, 'day');
		startDigestJob('digest.weekly', `0 ${digestHour} * * 0`, 'week');
		startDigestJob('digest.monthly', `0 ${digestHour} 1 * *`, 'month');
		startResetCleanJob(User);


		winston.verbose(`[user/jobs] jobs started`);
	};


	function startDigestJob(name, cronString, term) {
		jobs[name] = new cronJob(cronString, (async () => {
			winston.verbose(`[user/jobs] Digest job (${name}) started.`);
			try {
				if (name === 'digest.weekly') {
					const counter = await db.increment('biweeklydigestcounter');
					if (counter % 2) {
						await User.digest.execute({ interval: 'biweek' });
					}
				}
				await User.digest.execute({ interval: term });
			} catch (err) {
				winston.error(err.stack);
			}
		}), null, true);
		winston.verbose(`[user/jobs] Starting job (${name})`);
	}

	User.stopJobs = function () {
		let terminated = 0;
		// Terminate any active cron jobs
		for (const jobId of Object.keys(jobs)) {
			winston.verbose(`[user/jobs] Terminating job (${jobId})`);
			jobs[jobId].stop();
			delete jobs[jobId];
			terminated += 1;
		}
		if (terminated > 0) {
			winston.verbose(`[user/jobs] ${terminated} jobs terminated`);
		}
	};
};

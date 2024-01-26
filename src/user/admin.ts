// roughly 90% of thise code is from ChatGPT, i modifed small chunks of it

import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import * as validator from 'validator';

import { baseDir } from '../constants';
import * as db from '../database';
import * as plugins from '../plugins';
import * as batch from '../batch';

module.exports = function (User: any) {
    User.logIP = async function (uid: number, ip: string): Promise<void> {
        if (!(parseInt(uid.toString(), 10) > 0)) {
            return;
        }
        const now = Date.now();
        const bulk: [string, number, string][] = [
            [`uid:${uid}:ip`, now, ip || 'Unknown'],
        ];
        if (ip) {
            bulk.push([`ip:${ip}:uid`, now, uid.toString()]);
        }
        await db.sortedSetAddBulk(bulk);
    };

    User.getIPs = async function (uid: number, stop: number): Promise<string[]> {
        const ips = await db.getSortedSetRevRange(`uid:${uid}:ip`, 0, stop);
        return ips.map(ip => validator.escape(String(ip)));
    };

    User.getUsersCSV = async function (): Promise<string> {
        winston.verbose('[user/getUsersCSV] Compiling User CSV data');

        const data = await plugins.hooks.fire('filter:user.csvFields', { fields: ['uid', 'email', 'username'] });
        let csvContent = `${data.fields.join(',')}\n`;
        await batch.processSortedSet('users:joindate', async (uids: number[]) => {
            const usersData = await User.getUsersFields(uids, data.fields);
            csvContent += usersData.reduce((memo, user) => {
                memo += `${data.fields.map(field => user[field]).join(',')}\n`;
                return memo;
            }, '');
        }, {});

        return csvContent;
    };

    User.exportUsersCSV = async function (): Promise<void> {
        winston.verbose('[user/exportUsersCSV] Exporting User CSV data');

        const { fields, showIps } = await plugins.hooks.fire('filter:user.csvFields', {
            fields: ['email', 'username', 'uid'],
            showIps: true,
        });
        const fd = await fs.promises.open(
            path.join(baseDir, 'build/export', 'users.csv'),
            'w'
        );
        await fs.promises.appendFile(fd, `${fields.join(',')}${showIps ? ',ip' : ''}\n`);
        await batch.processSortedSet('users:joindate', async (uids: number[]) => {
            const usersData = await User.getUsersFields(uids, fields.slice());
            let userIPs = '';
            let ips: string[] = [];

            if (showIps) {
                ips = await db.getSortedSetsMembers(uids.map(uid => `uid:${uid}:ip`));
            }

            let line = '';
            usersData.forEach((user, index) => {
                line += `${fields.map(field => user[field]).join(',')}`;
                if (showIps) {
                    userIPs = ips[index] ? ips[index].join(',') : '';
                    line += `,"${userIPs}"\n`;
                } else {
                    line += '\n';
                }
            });

            await fs.promises.appendFile(fd, line);
        }, {
            batch: 5000,
            interval: 250,
        });
        await fd.close();
    };
};

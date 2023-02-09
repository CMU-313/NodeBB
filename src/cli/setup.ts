import winston from 'winston';
import path from 'path';
import nconf from 'nconf';

import { install as webInstall } from '../../install/web';
import { paths } from '../constants';
import install from '../install';
import build from '../meta/build';
import prestart from '../prestart';
import pkg from '../../package.json';

interface Data {
    username: string;
    password: string;
}

async function setup(initConfig: Data) {
    winston.info('NodeBB Setup Triggered via Command Line');

    console.log(`\nWelcome to NodeBB v${pkg.version}!`);
    console.log('\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.');
    console.log('Press enter to accept the default setting (shown in brackets).');

    install.values = initConfig;
    const data: Data = await install.setup() as Data;
    let configFile : string = paths.config;
    if (nconf.get('config')) {
        configFile = path.resolve(paths.baseDir, nconf.get('config') as string);
    }

    prestart.loadConfig(configFile);

    if (!nconf.get('skip-build')) {
        await build.buildAll();
    }

    let separator = '     ';
    if (process.stdout.columns > 10) {
        for (let x = 0, cols = process.stdout.columns - 10; x < cols; x += 1) {
            separator += '=';
        }
    }
    console.log(`\n${separator}\n`);

    if ('password' in data) {
        console.log('An administrative user was automatically created for you:');
        console.log(`    Username: ${(data as {username:string, password:string}).username}`);
        console.log(`    Password: ${(data as {username:string, password:string}).password}`);
        console.log('');
    }
    console.log('NodeBB Setup Completed. Run "./nodebb start" to manually start your NodeBB server.');

    // If I am a child process, notify the parent of the returned data before exiting (useful for notifying
    // hosts of auto-generated username/password during headless setups)
    if (process.send) {
        process.send(data);
    }
    process.exit();
}

export { setup, webInstall };

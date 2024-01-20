import winston from 'winston';
import path from 'path';
import nconf from 'nconf';

import { install } from '../../install/web';
import installModule from '../install';
import { paths } from '../constants';
import build from '../meta/build';
import prestart from '../prestart';
import pkg from '../../package.json';

interface InitConfig {
  url?: string;
  launchUrl? : string;
  skipGeneralSetup?: boolean;
  databases?: object;
  skipDatabaseSetup?: boolean;
  error?: boolean;
  success?: boolean;
  values: object;
  minimumPasswordLegth?: number;
  minimumPasswordStrength?: number;
  installing?: boolean;
}

interface SetupConfig {
  username?: string;
  password?: string;
}

export async function setup(initConfig: InitConfig) {
    winston.info('NodeBB Setup Triggered via Command Line');

    console.log(`\nWelcome to NodeBB v${pkg.version}!`);
    console.log(
        '\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.',
    );
    console.log('Press enter to accept the default setting (shown in brackets).');

    installModule.values = initConfig;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const data: SetupConfig = await installModule.setup() as SetupConfig;
    let configFile = paths.config;
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    if (data.hasOwnProperty('password')) {
        console.log('An administrative user was automatically created for you:');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.log(`    Username: ${data.username}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.log(`    Password: ${data.password}`);
        console.log('');
    }
    console.log(
        'NodeBB Setup Completed. Run "./nodebb start" to manually start your NodeBB server.',
    );

    // If I am a child process, notify the parent of the returned data before exiting (useful for notifying
    // hosts of auto-generated username/password during headless setups)
    if (process.send) {
        process.send(data);
    }
    process.exit();
}

export const webInstall = install;

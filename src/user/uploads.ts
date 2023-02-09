import path = require('path');
import nconf = require('nconf');
import winston = require('winston');
import local_crypto = require('crypto');
import archiver = require('archiver');

import db = require('../database');
import posts = require('../posts');
import file = require('../file');
import batch = require('../batch');

interface UserObject {
    associateUpload: (uid: string, relativePath: string[]) => Promise<void>;
    deleteUpload: (callerUid: string, uid: string, uploadNames) => Promise<void>;
    isAdminOrGlobalMod: (arg0: string) => Promise<boolean>;
    collateUploads: (uid: string, archive: archiver.Archiver) => Promise<void>;
}

const md5 = (filename: local_crypto.BinaryLike) => local_crypto.createHash('md5').update(filename).digest('hex');
const _getFullPath = (relativePath: string) => path.resolve((nconf.get('upload_path') as string), relativePath);
const _validatePath = async (relativePaths: string[]) => {
    if (typeof relativePaths === 'string') {
        relativePaths = [relativePaths];
    } else if (!Array.isArray(relativePaths)) {
        throw new Error(`[[error:wrong-parameter-type, relativePaths, ${typeof relativePaths}, array]]`);
    }

    const fullPaths = relativePaths.map((path: string) => _getFullPath(path));
    const exists = await Promise.all(fullPaths.map(async fullPath => file.exists(fullPath)));

    if (!fullPaths.every(fullPath => fullPath.startsWith((nconf.get('upload_path') as string))) || !exists.every(Boolean)) {
        throw new Error('[[error:invalid-path]]');
    }
};

module.exports = function (User: UserObject) {
    // Any type use is valid here
    // eslint-disable-next-line
    User.associateUpload = async (uid: string, relativePath: any) => {
        await _validatePath((relativePath as string[]));
        await Promise.all([
            // db cannot be typed
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetAdd(`uid:${uid}:uploads`, Date.now(), relativePath),
            // db cannot be typed
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setObjectField(`upload:${md5(relativePath as local_crypto.BinaryLike)}`, 'uid', uid),
        ]);
    };
    // Any type use is valid here
    // eslint-disable-next-line
    User.deleteUpload = async function (callerUid: string, uid: string, uploadNames: any) {
        if (typeof uploadNames === 'string') {
            uploadNames = [uploadNames];
        } else if (!Array.isArray(uploadNames)) {
            throw new Error(`[[error:wrong-parameter-type, uploadNames, ${typeof uploadNames}, array]]`);
        }

        await _validatePath((uploadNames as string[]));
        // isUsersUpload cannot be typed
        // eslint-disable-next-line
        const [isUsersUpload, isAdminOrGlobalMod] = await Promise.all([
            // db cannot be typed
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.isSortedSetMembers(`uid:${callerUid}:uploads`, uploadNames),
            User.isAdminOrGlobalMod(callerUid),
        ]);
        // isUsersUpload cannot be typed
        // eslint-disable-next-line max-len
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (!isAdminOrGlobalMod && !isUsersUpload.every(Boolean)) {
            throw new Error('[[error:no-privileges]]');
        }

        await batch.processArray(uploadNames, async (uploadNames: string[]) => {
            const fullPaths: string[] = uploadNames.map((path: string) => _getFullPath(path));

            await Promise.all(fullPaths.map(async (fullPath, idx) => {
                winston.verbose(`[user/deleteUpload] Deleting ${uploadNames[idx]}`);
                await Promise.all([
                    file.delete(fullPath),
                    file.delete(file.appendToFileName(fullPath, '-resized')),
                ]);
                await Promise.all([
                    // db cannot be typed
                    // eslint-disable-next-line max-len
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    db.sortedSetRemove(`uid:${uid}:uploads`, uploadNames[idx]),
                    // eslint-disable-next-line max-len
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    db.delete(`upload:${md5(uploadNames[idx])}`),
                ]);
            }));
            // db cannot be typed
            // Dissociate the upload from pids, if any
            // eslint-disable-next-line
            const pids = await db.getSortedSetsMembers(uploadNames.map(relativePath => `upload:${md5(relativePath)}:pids`));
            // eslint-disable-next-line
            await Promise.all(pids.map(async (pids: string[], idx: string | number) => Promise.all(
                // eslint-disable-next-line
                pids.map(async pid => posts.uploads.dissociate(pid, uploadNames[idx]))
            )));
        }, { batch: 50 });
    };

    User.collateUploads = async function (uid: string, archive: archiver.Archiver) {
        await batch.processSortedSet(`uid:${uid}:uploads`, (files: string[], next: () => void) => {
            files.forEach((file: string) => {
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                archive.file(_getFullPath(file), {
                    name: path.basename(file),
                });
            });

            setImmediate(next);
        }, { batch: 100 });
    };
};

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
// const sinon = require('sinon');
// const chalk = require('chalk');
const db = require('./mocks/databasemock');
const upgrade = require('../src/upgrade');

describe('Upgrade', () => {
    // describe('duplicate files test', () => {
    //     const upgradesDir1 = path.join(__dirname, '../src/upgrades/1.19.3');
    //     const upgradesDir2 = path.join(__dirname, '../src/upgrades/1.19.2');
    //     const testFileName = 'duplicateTestFile.js';

    //     before(async () => {
    //         // Create two duplicate files in the upgrades directory
    //         const testFilePath1 = path.join(upgradesDir1, testFileName);
    //         const testFilePath2 = path.join(upgradesDir2, testFileName);
    //         fs.writeFileSync(testFilePath1, 'console.log("Test file");');
    //         fs.writeFileSync(testFilePath2, 'console.log("Duplicate test file");');
    //     });

    //     it('should error on duplicate upgrade scripts', async () => {
    //         let err;
    //         try {
    //             await upgrade.getAll();
    //         } catch (_err) {
    //             err = _err;
    //         }
    //         assert.ok(err, 'An error should have been thrown');
    //         assert.equal(err.message, '[[error:duplicate-upgrade-scripts]]');
    //     });

    //     after(async () => {
    //         // Cleanup: Remove the test files
    //         const testFilePath1 = path.join(upgradesDir1, testFileName);
    //         const testFilePath2 = path.join(upgradesDir2, testFileName);
    //         if (fs.existsSync(testFilePath1)) {
    //             fs.unlinkSync(testFilePath1);
    //         }
    //         if (fs.existsSync(testFilePath2)) {
    //             fs.unlinkSync(testFilePath2);
    //         }
    //     });
    // });
    // it('should error on duplicate upgrade scripts', async () => {
    //     // used ChatGPT
    //     await upgrade.getAll();
    //     const duplicates = ['script1.js', 'script1.js'];
    //     const duplicateUpgrade = async () => duplicates;
    //     let err;
    //     try {
    //         await upgrade.getAll();
    //     } catch (_err) {
    //         console.error('Error caught:', _err);
    //         err = _err;
    //     }
    //     assert.ok(err, 'An error should have been thrown');
    //     assert.equal(err.message, '[[error:duplicate-upgrade-scripts]]');
    // });

    it('should get all upgrade scripts', async () => {
        const files = await upgrade.getAll();
        assert(Array.isArray(files) && files.length > 0);
    });

    it('should throw error', async () => {
        let err;
        try {
            await upgrade.check();
        } catch (_err) {
            err = _err;
        }
        assert.equal(err.message, 'schema-out-of-date');
    });

    // describe('Upgrade process test', function() {
    //     let originalSortedSetCard;

    //     before(function() {
    //         // Backup the original function
    //         originalSortedSetCard = db.sortedSetCard;

    //         // Replace the function with a mock that returns 0
    //         db.sortedSetCard = () => {
    //             console.log('Mocked sortedSetCard called');
    //             return Promise.resolve(0);
    //         }
    //     });

    //     // after(function() {
    //     //     // Restore the original function
    //     //     db.sortedSetCard = originalSortedSetCard;
    //     // });

    //     it.only('should write "skipped" for outdated scripts', async () => {
    //         // used ChatGPT
    //         // /* the script's timestamp, e.g., 1609459200000 for Jan 1, 2021 */
    //         // const scriptTimestamp = 1609459200000;
    //         // const laterSchemaDate = scriptTimestamp + 1000; // 1 second later

    //         // // Mock the db.get to return a timestamp that will cause the script to be skipped
    //         // sinon.stub(db, 'get').withArgs('schemaDate').resolves(scriptTimestamp);

    //         // // Mock a file representing an outdated upgrade script
    //         // const outdatedScript = {
    //         //     timestamp: laterSchemaDate,
    //         //     name: 'Outdated Script',
    //         //     method: () => {}
    //         // };

    //         // // Mock process.stdout.write to check if it gets called with 'skipped'
    //         // const stdoutSpy = sinon.spy(process.stdout, 'write');

    //         // // Call the process function with the mocked script
    //         // await upgrade.process([outdatedScript], 0);

    //         // // Assert that process.stdout.write was called with 'skipped'
    //         // sinon.assert.calledWith(stdoutSpy, chalk.grey(' skipped\n'));

    //         // // Restore the mocks
    //         // db.get.restore();
    //         // process.stdout.write.restore();
    //         const files = await upgrade.getAll();
    //         await db.set('schemaDate', 0);
    //         await upgrade.run(files, 0);
    //     });
    // });

    it('should run all upgrades', async () => {
        // for upgrade scripts to run
        await db.set('schemaDate', 1);
        await upgrade.run();
    });

    it('should run particular upgrades', async () => {
        const files = await upgrade.getAll();
        await db.set('schemaDate', 1);
        await upgrade.runParticular(files.slice(0, 2));
    });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNote = exports.appendNote = exports.update = exports.create = void 0;
const user = require("../user");
const flags = require("../flags");
async function create(caller, data) {
    const required = ['type', 'id', 'reason'];
    if (!required.every(prop => !!data[prop])) {
        throw new Error('[[error:invalid-data]]');
    }
    const { type, id, reason } = data;
    await flags.validate({
        uid: caller.uid,
        type: type,
        id: id,
    });
    const flagObj = await flags.create(type, id, caller.uid, reason);
    flags.notify(flagObj, caller.uid)
        .then()
        .catch(err => console.log(err));
    return flagObj;
}
exports.create = create;
async function update(caller, data) {
    const allowed = await user.isPrivileged(caller.uid);
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    const { flagId } = data;
    delete data.flagId;
    await flags.update(flagId, caller.uid, data);
    return await flags.getHistory(flagId);
}
exports.update = update;
async function appendNote(caller, data) {
    const allowed = await user.isPrivileged(caller.uid);
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    if (data.datetime && data.flagId) {
        try {
            const note = await flags.getNote(data.flagId, data.datetime);
            if (note.uid !== caller.uid) {
                throw new Error('[[error:no-privileges]]');
            }
        }
        catch (e) {
            // Okay if not does not exist in database
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (e.message !== '[[error:invalid-data]]') {
                throw e;
            }
        }
    }
    await flags.appendNote(data.flagId, caller.uid, data.note, data.datetime);
    const [notes, history] = await Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]);
    return { notes: notes, history: history };
}
exports.appendNote = appendNote;
async function deleteNote(caller, data) {
    const note = await flags.getNote(data.flagId, data.datetime);
    if (note.uid !== caller.uid) {
        throw new Error('[[error:no-privileges]]');
    }
    await flags.deleteNote(data.flagId, data.datetime);
    await flags.appendHistory(data.flagId, caller.uid, {
        notes: '[[flags:note-deleted]]',
        datetime: Date.now(),
    });
    const [notes, history] = await Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]);
    return { notes: notes, history: history };
}
exports.deleteNote = deleteNote;

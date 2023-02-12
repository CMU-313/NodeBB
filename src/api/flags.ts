import user = require('../user');
import flags = require('../flags');

interface dataType {
    type: string,
    id: number,
    reason: string,
    flagId: number,
    note: string,
    datetime: Date
}

interface flagObjType {
    state: string,
    assignee: null,
    datetimeISO: Date['toISOString'],
    notes: string,
    reports: string
}

interface callerType {
    uid: number
}

interface historyType {
    uid: number,
    fields: string,
    datetime: Date,
    datetimeISO: Date['toISOString']
}

interface noteType {
    uid: number
}

type noteHistory = noteType | historyType;

export async function create(caller: callerType, data: dataType): Promise<flagObjType> {
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

    const flagObj:flagObjType = await flags.create(type, id, caller.uid, reason) as flagObjType;
    flags.notify(flagObj, caller.uid)
        .then()
        .catch(err => console.log(err));

    return flagObj;
}

export async function update(caller: callerType, data: dataType): Promise<historyType> {
    const allowed:boolean = await user.isPrivileged(caller.uid) as boolean;
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    const { flagId } = data;
    delete data.flagId;

    await flags.update(flagId, caller.uid, data);
    return await flags.getHistory(flagId) as historyType;
}

export async function appendNote(caller: callerType, data: dataType): Promise<unknown> {
    const allowed:boolean = await user.isPrivileged(caller.uid) as boolean;
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }

    if (data.datetime && data.flagId) {
        try {
            const note:noteType = await flags.getNote(data.flagId, data.datetime) as noteHistory;
            if (note.uid !== caller.uid) {
                throw new Error('[[error:no-privileges]]');
            }
        } catch (e) {
            // Okay if not does not exist in database
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (e.message as string !== '[[error:invalid-data]]') {
                throw e;
            }
        }
    }
    await flags.appendNote(data.flagId, caller.uid, data.note, data.datetime);
    const [notes, history] = await Promise.all([
        flags.getNotes(data.flagId) as noteType,
        flags.getHistory(data.flagId) as historyType,
    ]);
    return { notes: notes, history: history };
}

export async function deleteNote(caller: callerType, data: dataType): Promise<unknown> {
    const note:noteType = await flags.getNote(data.flagId, data.datetime) as noteType;
    if (note.uid !== caller.uid) {
        throw new Error('[[error:no-privileges]]');
    }

    await flags.deleteNote(data.flagId, data.datetime);

    await flags.appendHistory(data.flagId, caller.uid, {
        notes: '[[flags:note-deleted]]',
        datetime: Date.now(),
    });

    const [notes, history] = await Promise.all([
        flags.getNotes(data.flagId) as noteType,
        flags.getHistory(data.flagId) as historyType,
    ]);
    return { notes: notes, history: history };
}

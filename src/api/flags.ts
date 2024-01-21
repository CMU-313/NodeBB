import user from '../user';
import flags from '../flags';

import { Note, FlagObject, FlagHistoryObject } from '../types/flag';
import { UserObject } from '../types';

export async function create(caller: UserObject, data: {
    type: string;
    id: number;
    reason: string;
}): Promise<FlagObject> {
    const required: string[] = ['type', 'id', 'reason'];
    if (!required.every(prop => !!data[prop])) {
        throw new Error('[[error:invalid-data]]');
    }

    const { type, id, reason } = data;

    await flags.validate({
        uid: caller.uid,
        type: type,
        id: id,
    });

    const flagObj: FlagObject = await flags.create(type, id, caller.uid, reason) as FlagObject;
    await flags.notify(flagObj, caller.uid);

    return flagObj;
}

export async function update(caller: UserObject, data: { flagId: number }): Promise<FlagHistoryObject> {
    const allowed: boolean = await user.isPrivileged(caller.uid) as boolean;
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }

    const { flagId } = data;
    delete data.flagId;

    await flags.update(flagId, caller.uid, data);
    return await flags.getHistory(flagId) as Promise<FlagHistoryObject>;
}

export async function appendNote(caller: UserObject, data: {
    datetime: number;
    flagId: number;
    note: Note;
}): Promise<{notes: Note[], history: FlagHistoryObject}> {
    const allowed: boolean = await user.isPrivileged(caller.uid) as boolean;
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    if (data.datetime && data.flagId) {
        try {
            const note = await flags.getNote(data.flagId, data.datetime) as Note;
            if (note.uid !== caller.uid) {
                throw new Error('[[error:no-privileges]]');
            }
        } catch (e: unknown) {
            // Okay if not does not exist in database
            if (e instanceof Error && e.message !== '[[error:invalid-data]]') {
                throw e;
            }
        }
    }
    await flags.appendNote(data.flagId, caller.uid, data.note, data.datetime);
    const [notes, history] : [Note[], FlagHistoryObject] = await Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]) as [Note[], FlagHistoryObject];
    return { notes: notes, history: history };
}

export async function deleteNote(caller: UserObject, data: {
    flagId: number;
    datetime: number;
}) : Promise<{notes: Note[], history: FlagHistoryObject}> {
    const note : Note = await flags.getNote(data.flagId, data.datetime) as Note;
    if (note.uid !== caller.uid) {
        throw new Error('[[error:no-privileges]]');
    }

    await flags.deleteNote(data.flagId, data.datetime);
    await flags.appendHistory(data.flagId, caller.uid, {
        notes: '[[flags:note-deleted]]',
        datetime: Date.now(),
    });

    const [notes, history] : [Note[], FlagHistoryObject] = await Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]) as [Note[], FlagHistoryObject];
    return { notes: notes, history: history };
}

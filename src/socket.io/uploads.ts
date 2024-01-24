'use strict';

import * as socketUser from './user';
import * as socketGroup from './groups';
import * as image from '../image';
import * as meta from '../meta';

interface Socket {
    uid: string;
    id: string;
    // Add other properties as needed
}

interface Data {
    chunk: string;
    params: {
        method: string;
        size: number;
        // Add other properties as needed
    };
    // Add other properties as needed
}

interface MethodToFunc {
    [key: string]: (socket: Socket, params: any) => Promise<any>;
}

interface SocketUploads {
    [key: string]: {
        imageData: string;
    };
}

const inProgress: { [key: string]: SocketUploads } = {};

const uploads: { upload: (socket: Socket, data: Data) => Promise<any>, clear: (sid: string) => void } = {
    upload: async function (socket: Socket, data: Data): Promise<any> {
        const methodToFunc: MethodToFunc = {
            'user.uploadCroppedPicture': socketUser.uploadCroppedPicture,
            'user.updateCover': socketUser.updateCover,
            'groups.cover.update': socketGroup.cover.update,
        };

        if (!socket.uid || !data || !data.chunk ||
            !data.params || !data.params.method || !methodToFunc.hasOwnProperty(data.params.method)) {
            throw new Error('[[error:invalid-data]]');
        }

        inProgress[socket.id] = inProgress[socket.id] || Object.create(null);
        const socketUploads: SocketUploads = inProgress[socket.id];
        const { method } = data.params;

        socketUploads[method] = socketUploads[method] || { imageData: '' };
        socketUploads[method].imageData += data.chunk;

        try {
            const maxSize = data.params.method === 'user.uploadCroppedPicture' ?
                meta.config.maximumProfileImageSize : meta.config.maximumCoverImageSize;
            const size = image.sizeFromBase64(socketUploads[method].imageData);

            if (size > maxSize * 1024) {
                throw new Error(`[[error:file-too-big, ${maxSize}]]`);
            }
            if (socketUploads[method].imageData.length < data.params.size) {
                return;
            }
            data.params.imageData = socketUploads[method].imageData;
            const result = await methodToFunc[data.params.method](socket, data.params);
            delete socketUploads[method];
            return result;
        } catch (err) {
            delete inProgress[socket.id];
            throw err;
        }
    },

    clear: function (sid: string): void {
        delete inProgress[sid];
    }
};

export = uploads;

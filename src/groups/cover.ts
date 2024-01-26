'use strict';
import path from 'path';
import nconf from 'nconf';
import db from '../database';
import image from '../image';
import file from '../file';

interface GroupData {
  groupName: string;
  imageData: string;
  file: MulterFile;
  position: string;
}
interface MulterFile {
  path : string;
  mimetype : string;
}

interface UploadData {
  url: string;
}

interface Groups {
  setGroupField(groupName: string, field: string, value: string): Promise<void>;
  getGroupFields(
    groupName: string,
    fields: string[]
  ): Promise<Record<string, string>>;
  updateCoverPosition(groupName: string, position: string): Promise<void>;
  updateCover(uid: number, data: GroupData): Promise<{ url: string }>;
  removeCover(data: GroupData): Promise<void>;
}

export default function (Groups: Groups) {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/bmp'];

    Groups.updateCoverPosition = async function (
        groupName: string,
        position: string
    ): Promise<void> {
        if (!groupName) {
            throw new Error('[[error:invalid-data]]');
        }
        await Groups.setGroupField(groupName, 'cover:position', position);
    };

    Groups.updateCover = async function (
        uid: number,
        data: GroupData
    ): Promise<{ url: string }> {
        let tempPath: string = data.file ? data.file.path : '';
        try {
            if (!data.imageData && !data.file && data.position) {
                await Groups.updateCoverPosition(data.groupName, data.position);
                return { url: '' }; // Return a default or placeholder URL
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const s : string = image.mimeFromBase64(data.imageData);
            const type : string = data.file?.mimetype ?? s;
            if (!type || !allowedTypes.includes(type)) {
                throw new Error('[[error:invalid-image]]');
            }

            if (!tempPath) {
                tempPath = await image.writeImageDataToTempFile(data.imageData);
            }

            const filename = `groupCover-${data.groupName}${path.extname(tempPath)}`;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const uploadData: UploadData = await image.uploadImage(
                filename,
                'files',
                {
                    path: tempPath,
                    uid,
                    name: 'groupCover',
                }
            );

            await Groups.setGroupField(data.groupName, 'cover:url', uploadData.url);

            await image.resizeImage({
                path: tempPath,
                width: 358,
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const thumbUploadData: UploadData = await image.uploadImage(
                `groupCoverThumb-${data.groupName}${path.extname(tempPath)}`,
                'files',
                {
                    path: tempPath,
                    uid,
                    name: 'groupCover',
                }
            );

            await Groups.setGroupField(
                data.groupName,
                'cover:thumb:url',
                thumbUploadData.url
            );

            if (data.position) {
                await Groups.updateCoverPosition(data.groupName, data.position);
            }

            return { url: uploadData.url };
        } catch {

        } finally {
            if (tempPath) {
                await file.delete(tempPath);
            }
        }
    };

    Groups.removeCover = async function (data: GroupData): Promise<void> {
        const fields = ['cover:url', 'cover:thumb:url'];
        const values = await Groups.getGroupFields(data.groupName, fields);

        await Promise.all(
            fields.map(async (field) => {
                if (
                    values[field] &&
          values[field].startsWith(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `${nconf.get('relative_path')}/assets/uploads/files/`
          )
                ) {
                    const filename = values[field].split('/').pop() || '';
                    const filePath = path.join(
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        nconf.get('upload_path'),
                        'files',
                        filename
                    );
                    await file.delete(filePath);
                }
            })
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.deleteObjectFields(`group:${data.groupName}`, [
            'cover:url',
            'cover:thumb:url',
            'cover:position',
        ]);
    };
}

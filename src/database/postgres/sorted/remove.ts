import { Pool, QueryResult } from 'pg';
import { valueToString } from '../helpers';

interface DBModule {
    pool: Pool;
    sortedSetRemove: (key: string | string[], value: string | string[]) => Promise<void>;
    sortedSetsRemove: (keys: string[], value: string) => Promise<void>;
    sortedSetsRemoveRangeByScore: (keys: string[], min: number | null, max: number | null) => Promise<void>;
    sortedSetRemoveBulk: (data: [string, string][]) => Promise<void>;
}

const dbmodule: DBModule = {
    pool: new Pool(), // Adjust this to your actual Pool configuration

    sortedSetRemove: async function (key, value) {
        if (!key) {
            return;
        }
        const isValueArray = Array.isArray(value);
        if (!value || (isValueArray && !value.length)) {
            return;
        }

        if (!Array.isArray(key)) {
            key = [key];
        }

        if (!isValueArray) {
            value = [value as string];
        } else {
            value = value as string[];
        }
        
        value = value.map(valueToString);
        await this.pool.query({
            name: 'sortedSetRemove',
            text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = ANY($2::TEXT[])`,
            values: [key, value],
        });
    },

    sortedSetsRemove: async function (keys, value) {
        if (!Array.isArray(keys) || !keys.length) {
            return;
        }

        value = valueToString(value);

        await this.pool.query({
            name: 'sortedSetsRemove',
            text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = $2::TEXT`,
            values: [keys, value],
        });
    },

    sortedSetsRemoveRangeByScore: async function (keys, min, max) {
        if (!Array.isArray(keys) || !keys.length) {
            return;
        }

        if (min === -Infinity) {
            min = null;
        }
        if (max === Infinity) {
            max = null;
        }
        

        await this.pool.query({
            name: 'sortedSetsRemoveRangeByScore',
            text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND ("score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
   AND ("score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)`,
            values: [keys, min, max],
        });
    },

    sortedSetRemoveBulk: async function (data) {
        if (!Array.isArray(data) || !data.length) {
            return;
        }
        const keys = data.map(d => d[0]);
        const values = data.map(d => d[1]);

        await this.pool.query({
            name: 'sortedSetRemoveBulk',
            text: `
    DELETE FROM "legacy_zset"
    WHERE (_key, value) IN (
        SELECT k, v
        FROM UNNEST($1::TEXT[], $2::TEXT[]) vs(k, v)
        )`,
            values: [keys, values],
        });
    },
};

export = dbmodule;

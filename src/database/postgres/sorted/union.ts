import { Pool, QueryResult } from 'pg';

interface Module {
    pool: Pool;
    sortedSetUnionCard: (keys: string[]) => Promise<number>;
    getSortedSetUnion: (params: SortedSetParams) => Promise<SortedSetResult[]>;
    getSortedSetRevUnion: (params: SortedSetParams) => Promise<SortedSetResult[]>;
}

interface SortedSetParams {
    sets: string[];
    start?: number;
    stop?: number;
    weights?: number[];
    aggregate?: string;
    sort: number;
    withScores?: boolean;
}

interface SortedSetResult {
    value: string;
    score?: number;
}

export = function (module: Module): void {
    module.sortedSetUnionCard = async function (keys: string[]): Promise<number> {
        if (!Array.isArray(keys) || !keys.length) {
            return 0;
        }

        const res: QueryResult = await module.pool.query({
            name: 'sortedSetUnionCard',
            text: `
SELECT COUNT(DISTINCT z."value") c
FROM "legacy_object_live" o
INNER JOIN "legacy_zset" z
ON o."_key" = z."_key"
AND o."type" = z."type"
WHERE o."_key" = ANY($1::TEXT[])`,
            values: [keys],
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return res.rows[0]?.c as number;
    };



    async function getSortedSetUnion(params: SortedSetParams): Promise<SortedSetResult[]> {
        const { sets } = params;
        const start = params.start || 0;
        const stop = params.stop || -1;
        let weights = params.weights || [];
        const aggregate = params.aggregate || 'SUM';

        if (sets.length < weights.length) {
            weights = weights.slice(0, sets.length);
        }
        while (sets.length > weights.length) {
            weights.push(1);
        }

        let limit = stop - start + 1;
        if (limit <= 0) {
            limit = null;
        }

        const res: QueryResult = await module.pool.query({
            name: `getSortedSetUnion${aggregate}${params.sort > 0 ? 'Asc' : 'Desc'}WithScores`,
            text: `
WITH A AS (SELECT z."value",
${aggregate}(z."score" * k."weight") "score"
FROM UNNEST($1::TEXT[], $2::NUMERIC[]) k("_key", "weight")
INNER JOIN "legacy_object_live" o
ON o."_key" = k."_key"
INNER JOIN "legacy_zset" z
ON o."_key" = z."_key"
AND o."type" = z."type"
GROUP BY z."value")
SELECT A."value",
A."score"
FROM A
ORDER BY A."score" ${params.sort > 0 ? 'ASC' : 'DESC'}
LIMIT $4::INTEGER
OFFSET $3::INTEGER`,
            values: [sets, weights, start, limit],
        });

        return res.rows.map(r => ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            value: r.value as string,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            score: params.withScores ? Number(r.score) : undefined,
        }));
    }
    module.getSortedSetUnion = async function (params: SortedSetParams): Promise<SortedSetResult[]> {
        params.sort = 1;
        return await getSortedSetUnion(params);
    };

    module.getSortedSetRevUnion = async function (params: SortedSetParams): Promise<SortedSetResult[]> {
        params.sort = -1;
        return await getSortedSetUnion(params);
    };
};

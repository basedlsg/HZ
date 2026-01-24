import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

export const config = {
    runtime: 'edge',
};

// Initialize S3 Client
const R2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

export default async function handler(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return new Response(
            JSON.stringify({ error: 'Missing ID parameter' }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    try {
        // Check for the existence of metadata/{id}.json
        const command = new HeadObjectCommand({
            Bucket: process.env.R2_BUCKET || 'hotzones',
            Key: `metadata/${id}.json`,
        });

        await R2.send(command);

        // If HeadObject succeeds, the object exists
        return new Response(
            JSON.stringify({
                exists: true,
                queriedId: id,
                message: "Record verified in secure storage."
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                },
            }
        );

    } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            return new Response(
                JSON.stringify({
                    exists: false,
                    queriedId: id
                }),
                {
                    status: 200, // Return 200 even for not found logic, as the check itself succeeded
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        console.error("Query Error:", error);
        return new Response(
            JSON.stringify({ error: 'Internal Query Error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}

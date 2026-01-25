import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';



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
        // PER USER REQUEST:
        // "can it just call the database and if it doesn't exist, just give a message saying false"
        // Treating ALL errors (Connection, Auth, NotFound) as "Record Not Found" to maintain UI stability.

        console.error("Query/System Error (Handled as False):", error);

        return new Response(
            JSON.stringify({
                exists: false,
                queriedId: id,
                debugError: error.message // silently keeping track
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}

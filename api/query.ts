
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
    const start = Date.now();
    let id: string | null = null;
    let safeId: string = '';

    try {
        const url = new URL(request.url);
        id = url.searchParams.get('id') || url.searchParams.get('name');
        if (!id) throw new Error('Missing ID');
        safeId = id.replace(/[^a-zA-Z0-9\-\._\s,]/g, '').trim();
    } catch (e) {
        return new Response(JSON.stringify({ exists: false, error: 'Invalid Request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // --- Configuration ---
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET || 'hotzones';

    if (!accessKeyId || !secretAccessKey || !endpoint) {
        return new Response(JSON.stringify({ exists: false, error: 'Misconfigured Server' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Initialize S3 Client (Lightweight enough for Edge if imports are minimal)
    const client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        credentials: {
            accessKeyId,
            secretAccessKey
        },
    });

    // --- Helper: Check existence ---
    const checkExists = async (keyId: string): Promise<{ exists: boolean, id: string, status?: number }> => {
        try {
            const command = new HeadObjectCommand({
                Bucket: bucket,
                Key: `metadata/${keyId}.json`
            });
            const response = await client.send(command);
            return { exists: response.$metadata.httpStatusCode === 200, id: keyId, status: response.$metadata.httpStatusCode };
        } catch (error: any) {
            return { exists: false, id: keyId, status: error.$metadata?.httpStatusCode || 500 };
        }
    };

    // --- Search Logic ---
    let targetIds = [safeId];

    // If no comma is present, try to permute "First Last" -> "Last, First"
    if (!safeId.includes(',')) {
        const parts = safeId.split(/\s+/).filter(p => p.length > 0);
        if (parts.length > 1) {
            // Heuristic 1: Last token is surname (e.g. "Tiffany Abraham" -> "Abraham, Tiffany")
            const last = parts[parts.length - 1];
            const rest = parts.slice(0, parts.length - 1).join(' ');
            targetIds.push(`${last}, ${rest}`);

            // Heuristic 2: First token is surname (swap space for comma) - less common but possible
            // Not implementing complex Dutch/Spanish heuristics yet to avoid over-fetching
        }
    }

    try {
        // Run checks in parallel
        const results = await Promise.all(targetIds.map(id => checkExists(id)));

        // Find first positive match
        const match = results.find(r => r.exists);

        if (match) {
            return new Response(JSON.stringify({
                exists: true,
                queriedId: match.id, // Return the actual matched ID so UI can show it
                message: "Record verified.",
                debug: {
                    status: match.status,
                    latency: Date.now() - start,
                    method: match.id === safeId ? 'direct' : 'fuzzy'
                }
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, max-age=0'
                }
            });
        }

        // If no match found
        return new Response(JSON.stringify({
            exists: false,
            queriedId: safeId,
            message: "Not found.",
            debug: {
                status: 404,
                checked: targetIds,
                latency: Date.now() - start
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({
            exists: false,
            debug: {
                error: error.message || 'Error',
                latency: Date.now() - start
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

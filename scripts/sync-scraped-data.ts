
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const SCRAPED_FILE = path.resolve(process.cwd(), 'data/scraped_data.jsonl');

// Initialize S3 Client
const R2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

async function uploadToR2(key: string, data: any) {
    // Sanitize key: remove slashes, special chars that might break paths, keep somewhat searching friendly
    const safeKey = key.replace(/[^a-zA-Z0-9\-\._\s,]/g, '').trim();
    if (!safeKey) return;

    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET || 'hotzones',
        Key: `metadata/${safeKey}.json`,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
    });

    try {
        await R2.send(command);
        console.log(`✅ Uploaded: ${safeKey}`);
    } catch (error: any) {
        console.error(`❌ Failed ${safeKey}: ${error.message}`);
    }
}

async function main() {
    if (!fs.existsSync(SCRAPED_FILE)) {
        console.error("No scraped data found. Run scraping script first.");
        return;
    }

    console.log(`Reading scraped data from ${SCRAPED_FILE}...`);
    const fileContent = fs.readFileSync(SCRAPED_FILE, 'utf-8');
    const lines = fileContent.split('\n');
    console.log(`Found ${lines.length} lines (potential entities).`);

    let count = 0;

    // Process in batches
    const BATCH_SIZE = 20;

    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batch = lines.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (line) => {
            if (!line.trim()) return;
            try {
                const entity = JSON.parse(line);

                // 1. Upload by Name
                if (entity.name) {
                    await uploadToR2(entity.name, { ...entity, queryMatch: 'name' });
                }

                // 2. Upload by Badge Number
                const badge = entity.badgeNumber || entity.raw?.['badge'] || entity.raw?.['badge #'] || entity.raw?.['id'];
                if (badge) {
                    await uploadToR2(badge, { ...entity, queryMatch: 'badge' });
                }

                // 3. Upload by License Plate
                if (entity.licensePlate) {
                    await uploadToR2(entity.licensePlate, { ...entity, queryMatch: 'plate' });
                }
            } catch (e) {
                console.error("Failed to parse line:", line.substring(0, 50));
            }
        });

        await Promise.all(promises);
        count += batch.length;
        if (count % 100 === 0) console.log(`Processed ${count} lines...`);
        // Small delay to be nice to R2 API limits if needed, but R2 is fast
        await new Promise(r => setTimeout(r, 50));
    }

    console.log("Sync complete.");
}

main();

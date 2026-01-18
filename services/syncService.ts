import { FeedItem, SyncStatus } from '../types';
import { db } from './db';

const UPLOAD_DELAY_MS = 2500;

export const uploadItem = async (item: FeedItem): Promise<void> => {
    if (!item.encryptedForensics) {
        console.log(`[Sync] Item ${item.id} has no forensic data to sync.`);
        return;
    }

    // Only upload user-generated content that hasn't been synced
    if (!item.isUserGenerated || item.syncStatus === SyncStatus.SYNCED) return;

    try {
        console.log(`[Sync] Starting cloud upload for ${item.id}...`);
        await db.updateSyncStatus(item.id, SyncStatus.UPLOADING);

        // 1. Get raw video blob from DB
        const blob = await db.getVideoBlob(item.id);
        if (!blob) {
            throw new Error("Video file not found in local DB");
        }

        // 2. Request Presigned URL from Serverless API
        const filename = `${item.id}.mp4`; // Assuming mp4/webm based on blob
        const res = await fetch('/api/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename,
                contentType: blob.type
            })
        });

        if (!res.ok) throw new Error('Failed to get upload URL');

        const { uploadUrl, key } = await res.json();

        // 3. Upload to R2 directly
        const upload = await fetch(uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': blob.type
            }
        });

        if (!upload.ok) throw new Error('R2 Upload failed');

        // 4. Update FeedItem with Public URL
        const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-0e691fa72ff24b868e4bb11469764443.r2.dev';
        const publicUrl = `${R2_PUBLIC_URL}/${key}`;

        console.log(`[Sync] Upload complete: ${publicUrl}`);

        // 5. Update DB
        await db.updateSyncStatus(item.id, SyncStatus.SYNCED);

        // Update the item strictly with the remote URL? 
        // For now, keep local serving (speed) but mark as synced.
        // Eventually we can swap videoUrl to remote to save space.

    } catch (error) {
        console.error(`[Sync] Upload failed for ${item.id}`, error);
        await db.updateSyncStatus(item.id, SyncStatus.FAILED);
    }
};

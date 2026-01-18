import Dexie, { Table } from 'dexie';
import { FeedItem } from '../types';

// Safari/iOS doesn't support storing Blobs directly in IndexedDB.
// We store ArrayBuffer + mimeType instead.
export interface VideoRecord {
  id: string;
  buffer: ArrayBuffer;
  mimeType: string;
}

export class OmbrixaDB extends Dexie {
  feedItems!: Table<FeedItem>;
  videos!: Table<VideoRecord>;

  constructor() {
    super('OmbrixaDB');
    // Version 3: Migrate Base64 strings out of feedItems to prevent iOS Memory Crashes
    this.version(3).stores({
      feedItems: 'id, timestamp, isUserGenerated',
      videos: 'id'
    }).upgrade(async tx => {
      // Fetch all feed items
      const items = await tx.table('feedItems').toArray();
      const videoTable = tx.table('videos');
      const feedTable = tx.table('feedItems');

      for (const item of items) {
        if (item.videoUrl && item.videoUrl.startsWith('data:')) {
          try {
            // Extract Base64 and convert to ArrayBuffer
            const match = item.videoUrl.match(/^data:([^;]+);base64,(.*)$/);
            if (match) {
              const mimeType = match[1];
              const base64 = match[2];
              const binaryString = atob(base64);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }

              // Save to videos table
              await videoTable.put({
                id: item.id,
                buffer: bytes.buffer,
                mimeType: mimeType
              });

              // Update feed item to remove the heavy string
              item.videoUrl = undefined;
              await feedTable.put(item);
              console.log(`Migrated item ${item.id} to lazy storage`);
            }
          } catch (e) {
            console.error(`Failed to migrate item ${item.id}`, e);
          }
        }
      }
    });
  }

  async saveRecording(item: FeedItem, blob: Blob) {
    // Convert Blob to ArrayBuffer for Safari compatibility
    const buffer = await blob.arrayBuffer();
    const mimeType = blob.type || 'video/webm';

    // Ensure we don't save the heavy URL in the lightweight feed table
    const itemToSave = { ...item };
    delete itemToSave.videoUrl;

    await this.transaction('rw', this.feedItems, this.videos, async () => {
      await this.feedItems.add(itemToSave);
      await this.videos.add({ id: item.id, buffer, mimeType });
    });
  }

  async getFeed(): Promise<FeedItem[]> {
    return await this.feedItems.orderBy('timestamp').reverse().toArray();
  }

  async getVideoBlob(id: string): Promise<Blob | undefined> {
    const record = await this.videos.get(id);
    if (record) {
      return new Blob([record.buffer], { type: record.mimeType });
    }
    return undefined;
  }

  async deleteItem(id: string) {
    await this.transaction('rw', this.feedItems, this.videos, async () => {
      await this.feedItems.delete(id);
      await this.videos.delete(id);
    });
  }

  async updateSyncStatus(id: string, status: any) {
    await this.feedItems.update(id, { syncStatus: status });
  }
}

export const db = new OmbrixaDB();

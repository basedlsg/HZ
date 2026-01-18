export enum AppPhase {
  CHECK_IN = 'CHECK_IN',
  CAMERA = 'CAMERA',
  FEED = 'FEED',
}

export interface VehicleDetail {
  description: string;
  make?: string;
  model?: string;
  type?: string;
  color?: string;
  licensePlate?: string;
  agency?: string; // e.g. "NYPD", "FBI"
}

export interface PersonDetail {
  description: string;
  isUniformed: boolean;
  uniformType?: string;
  badgeVisible: boolean;
  badgeText?: string;
  badgeNumber?: string;
  agency?: string;
  rank?: string;
  precinct?: string;
  isArmed?: boolean;
}

export interface AnalysisResult {
  summary: string;
  detectedCivicDetails: string[];
  vehicles?: string[];
  vehicleDetails?: VehicleDetail[];
  uniforms?: string[];
  peopleDetails?: PersonDetail[];
  safetyScore: number; // 1-100, estimated tension level
}

export enum SyncStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED'
}

export interface FeedItem {
  id: string;
  timestamp: number;
  location: { lat: number; lng: number }; // Relative coordinates or obfuscated
  videoUrl?: string; // In a real app, this is a blob URL
  thumbnailUrl?: string; // Captured frame
  analysis?: AnalysisResult;
  encryptedForensics?: string; // AES-GCM encrypted FaceAPI data
  iv?: string; // Initialization Vector for decryption
  isProcessing: boolean;
  isUserGenerated: boolean;
  syncStatus?: SyncStatus;
  userVotes?: Record<string, number>; // Sentiment Analysis: { "🚨": 10, "👁️": 5 }
}

export enum RecorderState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  ANALYZING = 'ANALYZING'
}

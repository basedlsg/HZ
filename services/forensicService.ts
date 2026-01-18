import * as faceapi from 'face-api.js';

// --- ENCRYPTION (Web Crypto API) ---

const ALG = "AES-GCM";
const KEY_USAGE: KeyUsage[] = ["encrypt", "decrypt"];

// Generate a symmetric key (In a real app, this would be derived from user password or stored in secure enclave)
export const generateKey = async (): Promise<CryptoKey> => {
    return window.crypto.subtle.generateKey(
        { name: ALG, length: 256 },
        true,
        KEY_USAGE
    );
};

// Export key to string for storage (DEMO ONLY - In production, keep key in memory or use proper Key Management)
export const exportKey = async (key: CryptoKey): Promise<string> => {
    const exported = await window.crypto.subtle.exportKey("jwk", key);
    return JSON.stringify(exported);
};

export const importKey = async (jwkStr: string): Promise<CryptoKey> => {
    const jwk = JSON.parse(jwkStr);
    return window.crypto.subtle.importKey("jwk", jwk, { name: ALG }, true, KEY_USAGE);
};

export const encryptData = async (data: object, key: CryptoKey): Promise<{ cipherText: string, iv: string }> => {
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

    const encrypted = await window.crypto.subtle.encrypt(
        { name: ALG, iv: iv },
        key,
        encoded
    );

    return {
        cipherText: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv)
    };
};

export const decryptData = async (cipherText: string, iv: string, key: CryptoKey): Promise<any> => {
    const encryptedData = base64ToArrayBuffer(cipherText);
    const ivData = base64ToArrayBuffer(iv);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: ALG, iv: ivData },
        key,
        encryptedData
    );

    const decoded = new TextDecoder().decode(decrypted);
    return JSON.parse(decoded);
};

// Utilities
const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
    let binary = '';
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};


// --- FACE API ---

// Use a CDN for models to avoid downloading huge files to repo
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export const loadModels = async () => {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL); // To get the descriptor (embedding)
        console.log("FaceAPI Models Loaded");
    } catch (e) {
        console.error("Failed to load FaceAPI models", e);
    }
};

export interface ForensicResult {
    faceCount: number;
    encryptedBiometrics: string; // The encrypted JSON blob of face descriptors
    iv: string;
}

export const analyzeFaces = async (imageElement: HTMLImageElement | HTMLVideoElement): Promise<ForensicResult | null> => {
    // Detect faces, landmarks, and compute descriptors (128-float arrays)
    const detections = await faceapi.detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

    if (!detections || detections.length === 0) return null;

    // Extract raw descriptors (The "Biometric Data")
    const biometrics = detections.map(d => ({
        descriptor: Array.from(d.descriptor), // Convert Float32Array to normal array for JSON serialization
        landmarks: d.landmarks.positions
    }));

    // Generate a session key for encryption (In reality, retrieve user's key)
    const key = await generateKey();

    // Encrypt the biometric payload
    const encrypted = await encryptData({ biometrics, timestamp: Date.now() }, key);

    return {
        faceCount: detections.length,
        encryptedBiometrics: encrypted.cipherText,
        iv: encrypted.iv
    };
};

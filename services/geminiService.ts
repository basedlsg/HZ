import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "../types";

// Use environment variable for the API key
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper: Compress image to reduce payload size (max 1024px, 0.7 quality)
const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Resize if too big
      const MAX_SIZE = 1024;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      // Export as JPEG with 0.7 quality
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = base64Str;
  });
};

// Helper: Sleep for backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeFootage = async (input: string | string[]): Promise<AnalysisResult> => {
  const images = Array.isArray(input) ? input : [input];

  try {
    // 1. COMPRESS IMAGES
    const compressedImages = await Promise.all(images.map(img => compressImage(img)));

    // Prepare image parts for Gemini
    const imageParts = compressedImages.map(img => {
      const base64Data = img.split(',')[1] || img;
      return {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      };
    });

    const prompt = `
      ROLE: You are an elite Tactical Safety Analyst system (Ombrixa AI) assessing real-time situational awareness from a sequence of video frames.

      TASK: Perform a deep analysis of the 5 extracted frames (0.5s intervals). You must extract text FIRST to ensure accuracy before forming a high-level summary.

      PROCESS (CHAIN OF THOUGHT):
      1.  OCR & TEXT EXTRACTION: Scan every pixel for potential text. Read license plates, street signs, badges, and logos.
          - If text is ambiguous (e.g. '0' vs 'O', '2' vs 'Z'), list alternatives.
          - Example: "Plate appears to be XY2-1234, possibly XYZ-1234".
      2.  OBJECT IDENTIFICATION: Identify specific vehicles (Make/Model/Year) and uniforms (Agency/Rank).
      3.  SCENE CONTEXT: Combine these details to assess the situation.
      4.  SAFETY SCORING: Assign a score based on the evidence.

      OUTPUT FORMAT: Return ONLY a raw JSON object (no markdown).

      JSON STRUCTURE:
      {
        "summary": "SITREP: [Concise factual summary. Mention specific text/plates found].",
        "detectedCivicDetails": ["tag_in_snake_case", "tag_two"], 
        "vehicles": [],
        "vehicleDetails": [
           { "color": "White", "make": "Ford", "model": "Explorer", "type": "SUV", "licensePlate": "XYZ-1234", "agency": "NYPD" }
        ],
        "uniforms": [], 
        "peopleDetails": [
           { "isUniformed": true, "uniformType": "Police", "agency": "SFPD", "rank": "Officer", "badgeText": "SMITH", "badgeNumber": "123", "precinct": "Central" }
        ],
        "safetyScore": [INTEGER 1-100]
      }

      SCORING MATRIX (safetyScore):
      1-20:  SAFE (Routine, calm, empty)
      21-50: CAUTION (Crowds, traffic, minor disorder)
      51-80: WARNING (Aggression, smoke, hazard)
      81-100: DANGER (Weapons, violence, active emergency)

      CRITICAL INSTRUCTIONS:
      - BE METICULOUS WITH TEXT. If you see a license plate, you MUST attempt to read it.
      - REPORT UNCERTAINTY. If a digit is blurry, say "Unclear" or give best guess.
      - AGGEGRATE FRAMES. Use all 5 images to build the complete picture. Valid text in Frame 3 is just as good as Frame 1.
    `;

    // 2. RETRY LOGIC (Exponential Backoff)
    // Try up to 3 times (0s wait, 1s wait, 2s wait)
    const MAX_RETRIES = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                ...imageParts
              ],
            },
          ],
        });

        const text = response.text || "";
        console.log("Gemini Raw Response:", text);

        // Clean up markdown code blocks if Gemini adds them
        const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        try {
          return JSON.parse(cleanJson) as AnalysisResult;
        } catch (parseError) {
          console.error("JSON Parse Error:", parseError, "Raw text:", cleanJson);
          return {
            summary: text.substring(0, 100) || "Scene analyzed",
            detectedCivicDetails: [],
            vehicles: [],
            uniforms: [],
            safetyScore: 25
          };
        }

      } catch (error: any) {
        lastError = error;
        const isRetryable = error?.message?.includes('429') || error?.message?.includes('503') || error?.status === 429 || error?.status === 503;

        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const waitTime = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          console.warn(`Gemini API Error (Attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${waitTime}ms...`);
          await delay(waitTime);
          continue;
        }

        // If not retryable or max retries hit, throw to outer catch
        throw error;
      }
    }

    throw lastError; // Should not reach here if successful

  } catch (error: any) {
    console.error("Gemini Analysis Failed (Final):", error);
    console.error("Error details:", error?.message, error?.status, error?.statusText);

    // More specific error message
    let errorMsg = "Analysis Error";
    if (error?.message) {
      errorMsg = `Error: ${error.message}`;
      if (error.message.includes("429")) errorMsg = "API Quota Exceeded (429)";
      if (error.message.includes("400")) errorMsg = "Bad Request (400) - Payload?";
      if (error.message.includes("API_KEY")) errorMsg = "Invalid API Key";
      if (error.message.includes("fetch")) errorMsg = "Network/Fetch Error";
    }

    return {
      summary: `${errorMsg} - Check console for details`,
      detectedCivicDetails: [],
      vehicles: [],
      uniforms: [],
      safetyScore: 0
    };
  }
};
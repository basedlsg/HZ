import { AnalysisResult } from "../types";

/**
 * Official Meta Llama API Service
 * Endpoint: https://api.llama.com/v1/chat/completions
 * Docs: https://llama.developer.meta.com/docs/overview/
 */

// Llama API Key provided by user
const API_KEY = "LLM|2123794251718333|tjiu41FVH1XFbjl3lyq_4Zz7VXQ";
const API_URL = "https://api.llama.com/v1/chat/completions";

// Vision-capable model for multimodal analysis
// Options: Llama-4-Maverick-17B-128E-Instruct-FP8, Llama-4-Scout-17B-16E-Instruct-FP8, Llama-3.2-11B-Vision-Instruct
const MODEL = "Llama-4-Maverick-17B-128E-Instruct-FP8";

export const analyzeFootage = async (input: string | string[]): Promise<AnalysisResult> => {
    try {
        const images = Array.isArray(input) ? input : [input];

        const prompt = `
ROLE: You are an elite Tactical Safety Analyst system (Ombrixa AI) assessing real-time situational awareness.

TASK: Analyze the provided SEQUENCE OF FRAMES (0.5s intervals) from a video feed. Aggregate observations across all frames to detect movement, behavior changes, and transient details that might be missed in a single shot.

OUTPUT FORMAT: Return ONLY a raw JSON object (absolutely no markdown, no \`\`\`json blocks).

JSON STRUCTURE IS REQUIRED:
{
  "summary": "SITREP: [Concise, factual description of scene, focus on activity/safety]",
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
1-20:  SAFE / ROUTINE
21-50: CAUTION
51-80: WARNING
81-100: DANGER

INSTRUCTIONS:
- "summary": Combine insights from ALL frames. FORMAT: "Subject [Details] at [Location]. Observed [Action]. [DATA: Plate #, Officer #, etc.]"
- CRITICAL: Read ALL text on vehicles/uniforms. 
- CRITICAL: Return ALL uniformed personnel visible across ALL frames.
- "detectedCivicDetails": Use specific tags like: "high_foot_traffic", "loitering", "peaceful_assembly", "commercial_zone".
- BE DECISIVE.
`;

        // Build content array with text and images (official Llama API format)
        const contentArray: any[] = [
            { type: "text", text: prompt }
        ];

        // Add images - Llama API accepts image_url with base64 data URLs
        images.forEach(img => {
            contentArray.push({
                type: "image_url",
                image_url: {
                    url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
                }
            });
        });

        const requestBody = {
            model: MODEL,
            messages: [
                {
                    role: "user",
                    content: contentArray
                }
            ],
            max_tokens: 1000,
            temperature: 0.1
        };

        console.log("[Llama] Sending request to:", API_URL);
        console.log("[Llama] Model:", MODEL);
        console.log("[Llama] Image count:", images.length);

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("[Llama] API Error Response:", errorBody);
            throw new Error(`Llama API Error (${response.status}): ${errorBody.substring(0, 200)}`);
        }

        const data = await response.json();
        console.log("[Llama] Raw Response:", JSON.stringify(data).substring(0, 500));

        const text = data.choices?.[0]?.message?.content || "";

        // Clean up markdown if present
        const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(cleanJson) as AnalysisResult;
        } catch (parseError) {
            console.error("[Llama] JSON Parse Error:", parseError, "Raw text:", cleanJson);
            return {
                summary: text.substring(0, 100) || "Scene analyzed",
                detectedCivicDetails: [],
                vehicles: [],
                uniforms: [],
                safetyScore: 25
            };
        }

    } catch (error: any) {
        console.error("[Llama] Analysis Failed:", error);
        return {
            summary: `Analysis Error: ${error?.message || 'Unknown error'}`,
            detectedCivicDetails: [],
            vehicles: [],
            uniforms: [],
            safetyScore: 0
        };
    }
};

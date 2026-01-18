import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "../types";

// Use environment variable for the API key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const analyzeFootage = async (input: string | string[]): Promise<AnalysisResult> => {
  try {
    const images = Array.isArray(input) ? input : [input];

    // Prepare image parts for Gemini
    const imageParts = images.map(img => {
      const base64Data = img.split(',')[1] || img;
      return {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      };
    });

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
           { "color": "White", "make": "Ford", "model": "Explorer", "type": "SUV", "licensePlate": "XYZ-1234", "agency": "NYPD" },
           { "color": "Black", "make": "Dodge", "model": "Charger", "type": "Sedan", "licensePlate": "ABC-5678", "agency": "NYPD" }
        ],
        "uniforms": [], 
        "peopleDetails": [
           { "isUniformed": true, "uniformType": "Police", "agency": "SFPD", "rank": "Officer", "badgeText": "SMITH", "badgeNumber": "123", "precinct": "Central" },
           { "isUniformed": true, "uniformType": "Police", "agency": "SFPD", "rank": "Sergeant", "badgeText": "JONES", "badgeNumber": "592", "precinct": "Central" },
           { "isUniformed": false, "uniformType": null, "agency": null, "rank": null, "badgeText": null, "badgeNumber": null, "precinct": null }
        ],
        "safetyScore": [INTEGER 1-100]
      }

      SCORING MATRIX (safetyScore):
      1-20:  SAFE / ROUTINE (Empty street, domestic interior, calm nature, normal business)
      21-50: CAUTION (Heavy traffic, large crowds, minor disorder, visible loitering)
      51-80: WARNING (Heated arguments, aggressive behavior, smoke, potential hazard)
      81-100: DANGER (Weapons visible, active fire, physical violence, panic, medical emergency)

      INSTRUCTIONS:
      - "summary": Combine insights from ALL frames. If a vehicle or person appears in ANY frame, log them. 
      - FORMAT: "Subject [Details] at [Location]. Observed [Action]. [DATA: Plate #, Officer #, etc.]"
      - EXAMPLE SUMMARY: "SITREP: Black Ford Explorer observed entering intersections. Subject identified as NYPD Patrol. [DATA: Plate XYZ-1234, Officer Jones #592, 1st Precinct]."
      - CRITICAL: Read ALL text on vehicles/uniforms. Handle different fonts/states for License Plates. Do not auto-correct unique codes.
      - EXTRACT: Agency Name, Officer Name, Badge Number, Precinct, Vehicle Make/Model/Plate.
      - CRITICAL: Return ALL uniformed personnel visible across ALL frames. Do NOT limit to one entry. If you see 5 officers, return 5 objects in peopleDetails.
      - CRITICAL: Return ALL vehicles visible across ALL frames. Do NOT limit to one entry.
      - "detectedCivicDetails": Use specific tags like: "high_foot_traffic", "loitering", "peaceful_assembly", "commercial_zone".
      - BE DECISIVE.
    `;

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
    console.error("Gemini Analysis Failed:", error);
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
import * as functions from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import * as admin from "firebase-admin";

admin.initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const geminiSearch = functions.https.onCall(
  {secrets: [geminiApiKey]},
  async (req, context) => {
    const data = req.data || req; // Handle v1 or v2 signatures

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "unavailable",
        "Gemini API key is not configured on the server."
      );
    }

    const {categories, coverageArea} = data;
    if (!categories?.length || !!coverageArea === false) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing categories or coverageArea."
      );
    }

    try {
      const {GoogleGenAI, Type} = await import("@google/genai");
      const ai = new GoogleGenAI({apiKey});

      /* eslint-disable max-len */
      const prompt = `Search for real, popular, and highly-rated businesses in the following categories: ${categories.join(", ")}.
The search area is ${coverageArea.location_name} (Latitude: ${coverageArea.latitude}, Longitude: ${coverageArea.longitude}) within a ${coverageArea.radius}km radius.
Use Google Search to find the most accurate and up-to-date information.
Return a list of businesses with their real names, verified addresses, coordinates, ratings, and descriptions.`;
      /* eslint-enable max-len */

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: {type: Type.STRING},
                address: {type: Type.STRING},
                latitude: {type: Type.NUMBER},
                longitude: {type: Type.NUMBER},
                rating: {type: Type.NUMBER},
                description: {type: Type.STRING},
                category: {type: Type.STRING},
                phone: {type: Type.STRING},
                website: {type: Type.STRING},
              },
              required: ["name", "address", "latitude", "longitude"],
            },
          },
        },
      });

      const items = JSON.parse(response.text || "[]");
      return items;
    } catch (err) {
      console.error("Gemini search error:", err);
      throw new functions.https.HttpsError("internal", "Gemini search failed.");
    }
  });

export const ogImage = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }

  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({imageUrl: null, error: "Missing url parameter"});
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({imageUrl: null, error: "Invalid URL"});
    return;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    // eslint-disable-next-line max-len
    res.status(400).json({imageUrl: null, error: "Only http/https URLs are allowed"});
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {"User-Agent": "Lalela-Bot/1.0 (OG Image Fetcher)"},
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.json({imageUrl: null});
      return;
    }

    const html = await response.text();
    // eslint-disable-next-line max-len
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      // eslint-disable-next-line max-len
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch?.[1]) {
      res.json({imageUrl: new URL(ogMatch[1], url).href});
      return;
    }

    // eslint-disable-next-line max-len
    const touchMatch = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);
    if (touchMatch?.[1]) {
      res.json({imageUrl: new URL(touchMatch[1], url).href});
      return;
    }

    res.json({imageUrl: null});
  } catch {
    res.json({imageUrl: null});
  }
});

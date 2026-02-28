import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req) {
  try {
    const { question, answer } = await req.json();

    const prompt = `
You are an interview boss in a game.

Question:
${question}

Player Answer:
${answer}

Score from 1-10:
- confidence
- clarity
- technical_depth

Return ONLY valid JSON:
{
  "confidence": number,
  "clarity": number,
  "technical_depth": number,
  "boss_reaction": "string"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const text = response.text;

    return Response.json({ result: text });
  } catch (error) {
    console.error("Gemini Error:", error);
    return Response.json({ error: "Gemini failed" }, { status: 500 });
  }
}
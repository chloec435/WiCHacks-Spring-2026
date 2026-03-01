import { GoogleGenAI } from "@google/genai";

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { question, answer, field } = await req.json();

    const prompt = `
You are an ${field} interview boss in real life.

Question:
${question}

Player Answer:
${answer}

Score from 1-10:
- communication
- clarity
- technical_depth

If needed, ask them to elaborate. If they already have a detailed response, generate a follow-up question.

Return ONLY valid JSON:
{
  "communication": number,
  "clarity": number,
  "technical_depth": number,
  "boss_reaction": "string",
  "follow_up": "string"
}
`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const model = "models/gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const text = response?.text ?? JSON.stringify(response);

    return new Response(
      JSON.stringify({ result: text, model }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Gemini failed", details: error?.message ?? String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
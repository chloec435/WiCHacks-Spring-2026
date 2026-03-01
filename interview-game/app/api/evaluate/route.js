import { GoogleGenAI } from "@google/genai";

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { history, question, answer, field } = await req.json();

    const prompt = `
    You are an ${field} interview boss in real life.
    If needed, ask them to elaborate. If they already have a detailed response, generate a follow-up question.

    If the answer is non-sensical or shows a lack of understanding, the boss will react negatively. If the answer is good, the boss will react positively. The boss's reaction should be concise.

    Return ONLY valid JSON:
    {
      "communication": number,
      "clarity": number,
      "technical_depth": number,
      "boss_reaction": "string"
    }`;

    const contents = [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
      ...history,
      {
        role: "user",
        parts: [{ text: `Question: ${question}\nPlayer Answer: ${answer}` }],
      }
    ];

//     const prompt = `
// You are an ${field} interview boss in real life.

// Question:
// ${question}

// Player Answer:
// ${answer}

// Score from 1-10:
// - communication
// - clarity
// - technical_depth

// If needed, ask them to elaborate. If they already have a detailed response, generate a follow-up question.

// If the answer is non-sensical or shows a lack of understanding, the boss will react negatively. If the answer is good, the boss will react positively. The boss's reaction should be concise.

// Return ONLY valid JSON:
// {
//   "communication": number,
//   "clarity": number,
//   "technical_depth": number,
//   "boss_reaction": "string"
// }
// `;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const model = "models/gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model,
      contents,
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
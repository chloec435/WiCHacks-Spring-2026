import { GoogleGenAI } from "@google/genai";

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // support JSON with an optional `pdf` field containing base64 data
    let history, question, answer, field, pdfBase64, questionCount;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      history = body.history;
      question = body.question;
      answer = body.answer;
      field = body.field;
      pdfBase64 = body.pdf; // may be undefined
      questionCount = body.questionCount || 0; // track how many questions asked
    } else if (contentType.includes("multipart/form-data")) {
      // future-proof: parse form data if client switches to FormData
      const form = await req.formData();
      history = JSON.parse(form.get("history") || "[]");
      question = form.get("question");
      answer = form.get("answer");
      field = form.get("field");
      questionCount = parseInt(form.get("questionCount") || "0");
      const file = form.get("pdf");
      if (file && file.arrayBuffer) {
        const buf = await file.arrayBuffer();
        pdfBase64 = Buffer.from(buf).toString("base64");
      }
    }

    // Model to use
    const model = "models/gemini-2.5-flash";

    const prompt = `
    You are an ${field} interview boss in real life.
    
    If the answer is non-sensical or shows a lack of understanding, the boss will react negatively. If the answer is good, the boss will react positively. The boss's reaction should be concise (1-2 sentences).

    You MUST rate the answer on three dimensions on a scale of 1-10:
    - communication: how well did they communicate their thoughts?
    - clarity: how clear and understandable was their answer?
    - technical_depth: how deep/detailed was their technical knowledge shown?

    Return ONLY valid JSON. Required keys:
    {
      "communication": number (1-10),
      "clarity": number (1-10),
      "technical_depth": number (1-10),
      "boss_reaction": "string"
    }

    DO NOT include a "follow_up" key. DO NOT ask follow-up questions.
    `;

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

    // Accepts a base64-encoded PDF string. Calls Gemini and asks it to
    // read the document and return four interview questions based on its
    // contents. Returns the raw text response from the model.
    async function analyzePDF(base64) {
      if (!base64) return null;
      const aiForPdf = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const pdfPart = {
        inlineData: {
          data: base64,
          mimeType: "application/pdf",
        },
      };

      const pdfPrompt = `You are an interview assistant. A PDF document is
attached; please read it and generate exactly four interview questions
that you could ask a candidate based on the PDF's content. Return the
questions as a JSON array of strings, e.g. ["question1","question2",...].`;

      const pdfContents = [
        {
          role: "user",
          parts: [{ text: pdfPrompt }],
        },
        {
          role: "user",
          parts: [pdfPart],
        },
      ];

      const res = await aiForPdf.models.generateContent({
        model,
        contents: pdfContents,
      });
      return res?.text;
    }


    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model,
      contents,
    });

    const text = response?.text ?? JSON.stringify(response);

    // try to parse model output server-side (strip markdown fences if present)
    let resultJson = null;
    try {
      const cleaned = (text || "").replace(/```json|```/g, "").trim();
      resultJson = JSON.parse(cleaned);
    } catch (e) {
      // ignore parse errors — client will handle fallback
    }

    // if we were given a PDF file, analyze it separately and include the
    // questions in the response object so the client can show them.
    let pdfQuestions = null;
    if (pdfBase64) {
      try {
        const pdfText = await analyzePDF(pdfBase64);
        // the model should return a JSON array, but we'll return raw text so
        // the client can display/parse it however desired.
        pdfQuestions = pdfText;
      } catch (e) {
        console.error("PDF analysis error", e);
      }
    }

    return new Response(
      JSON.stringify({ result: text, resultJson, model, pdfQuestions }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Gemini failed", details: error?.message ?? String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
"use client";
import { useState } from "react";

export default function Home() {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);

  const question = "Tell me a story.";

  async function handleSubmit() {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        answer,
      }),
    });

    const data = await res.json();

    if (!data.result) {
      console.error("No result:", data);
      return;
    }

    const cleaned = data.result.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    setResult(parsed);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Interview Boss</h1>

      <p><strong>Question:</strong> {question}</p>

      <textarea
        rows={4}
        style={{ width: "100%" }}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />

      <button onClick={handleSubmit}>Submit</button>

      {result && (
        <div style={{ marginTop: 20 }}>
          <p>Confidence: {result.confidence}</p>
          <p>Clarity: {result.clarity}</p>
          <p>Technical Depth: {result.technical_depth}</p>
          <p>{result.boss_reaction}</p>
        </div>
      )}
    </div>
  );
}
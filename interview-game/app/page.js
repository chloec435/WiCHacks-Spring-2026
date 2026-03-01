// ...existing code...
"use client";
import { useState } from "react";
import './page.css';

// ElevenLabs calls will be proxied through a server-side API so the key
// remains secret.  The client component only fetches from /api/tts.

export default function Home() {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [field, setField] = useState("");
  const [history, setHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");

  // helper that sends text to our server API and plays the returned audio
  async function speak(text) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        console.error("TTS request failed", await res.text());
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
    } catch (e) {
      console.error("speak error", e);
    }
  }

  const question = "Tell me about yourself.";

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const newHistory = [
        ...history,
        { role: "user", parts: [{ text: answer }] }
      ];
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          history: newHistory,
          question,
          answer,
          field,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? data.details ?? "API error");
        setLoading(false);
        return;
      }
      
      setHistory([
        ...newHistory,
        { role: "model", parts: [{ text: data.result }] }
      ]);

      const text = data.result || "";
      const cleaned = text.replace(/```json|```/g, "").trim();

      try {
        const parsed = JSON.parse(cleaned);
        setResult(parsed);
        if (parsed.boss_reaction) await speak(parsed.boss_reaction);
        if (parsed.follow_up) await speak(parsed.follow_up);
      } catch (e) {
        // If parsing fails, show raw text so you can inspect what the model returned
        const fallback = { boss_reaction: cleaned, follow_up: cleaned, parsingError: e.message };
        setResult(fallback);
        await speak(cleaned);
      }
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }

  }

  return (
    <div className="app-background">
      <h1>Interview Boss</h1>

      <p>
        <strong>Field:</strong> {field}
      </p>

      <textarea rows={1} style={{ width: "20%" }} value={field} onChange={(e) => setField(e.target.value)} />

      <p style={{ marginTop: "46vh", textAlign: "center", color: "black", backgroundColor: "rgba(163, 217, 234, 0.8).8)" }}>
        <strong>Question: {question} </strong>
      </p>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <textarea rows={5} style={{ width: "80%" , marginTop: "1vh"}} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
      {/* rgba(244, 247, 190, 0.8) }*/}

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <button onClick={handleSubmit} disabled={loading} style={{ marginTop: 8 }}>
            {loading ? "Checking..." : "Submit"}
        </button>
      </div>

      {error && <div style={{ color: "red", marginTop: 12 }}>Error: {error}</div>}

      {result && (
        <div>
          <div style={{ marginTop: 20, position: "absolute", top: 130, bottom: 310, left: 180, right: 620, backgroundColor: "rgba(255,255,255,0.8)", 
          padding: 12, borderRadius: 8, color: "black", fontSize: "14px"}}>
            <p>Communication: {result.communication ?? "n/a"}</p>
            <p>Clarity: {result.clarity ?? "n/a"}</p>
            <p>Technical Depth: {result.technical_depth ?? "n/a"}</p>
          </div>
          <div style={{ marginTop: 20, position: "absolute", top: 10, bottom: 250, left: 600, right: 20, backgroundColor: "rgba(255,255,255,0.8)", 
          padding: 12, borderRadius: 8, color: "black", fontSize: "14px"}}>
            <p>{result.boss_reaction ?? result.bossReaction ?? result.message ?? "No reaction"}</p>
            {result.parsingError && <small style={{ color: "orange" }}>Parsing error: {result.parsingError}</small>}
          </div>
        </div>
      )}
    </div>
  );
}
// ...existing code...

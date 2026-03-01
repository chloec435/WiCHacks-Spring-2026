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
  const [pdfFile, setPdfFile] = useState(null);
  // hold base64 string for transmission
  const [pdfBase64, setPdfBase64] = useState("");
  const [pdfQuestions, setPdfQuestions] = useState(null);

  // show only one question at a time
  const [questions, setQuestions] = useState(["Tell me about yourself."]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Track all scores for final summary
  const [allScores, setAllScores] = useState([]);

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

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if(file && file.type == "application/pdf"){
      setPdfFile(file);
    }
    else{
      alert("Select a valid file format!")
    }
  };

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    setPdfQuestions(null);

    // Check if we've already completed 5 questions
    if (currentQuestionIndex >= 5) {
      setLoading(false);
      return;
    }

    try {
      let pdfString;
      if (pdfFile) {
        // convert file to base64 for JSON transport
        pdfString = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = reader.result.split(",")[1] || "";
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(pdfFile);
        });
        setPdfBase64(pdfString);
      }

      const currentQuestion = questions[currentQuestionIndex] || "Tell me about yourself.";

      const body = {
        history: [],
        question: currentQuestion,
        answer,
        field,
        questionCount: currentQuestionIndex,
      };
      if (pdfString) body.pdf = pdfString;

      const newHistory = [
        ...history,
        { role: "user", parts: [{ text: answer }], question: currentQuestion }
      ];

      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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

      // save PDF questions if present AND not yet loaded
      // if (data.pdfQuestions && questions.length === 1) {
      //   try {
      //     const cleaned = data.pdfQuestions.replace(/```json|```/g, "").trim();
      //     const parsedQuestions = JSON.parse(cleaned);
      //     if (Array.isArray(parsedQuestions)) {
      //       // Replace the initial question with the PDF questions
      //       setQuestions(parsedQuestions);
      //     }
      //   } catch (e) {
      //     console.log("Could not parse PDF questions:", e);
      //   }
      // }
      if (data.pdfQuestions && questions.length === 1) {
        try {
          const cleanedPdf = (typeof data.pdfQuestions === "string" ? data.pdfQuestions.replace(/```json|```/g, "").trim() : JSON.stringify(data.pdfQuestions));
          const parsedPdf = JSON.parse(cleanedPdf);
          if (Array.isArray(parsedPdf) && parsedPdf.length > 0) {
            setQuestions(parsedPdf);
            setPdfQuestions(parsedPdf);
            // ensure "Tell me about yourself." is the first question and avoid duplicates
            const normalized = parsedPdf.map(q => (typeof q === "string" ? q.trim() : "")).filter(Boolean);
            const finalQuestions = ["Tell me about yourself.",...normalized.filter(q => q.toLowerCase() !== "tell me about yourself.")];
            setQuestions(finalQuestions);
            setPdfQuestions(finalQuestions);
            // show the first PDF question
            setCurrentQuestionIndex(0);
            // clear answer for next question
            setAnswer("");
            // do not continue to handle follow_up from the evaluation response
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log("Could not parse PDF questions:", e);
          // fall through to handle normal response
        }
      }

      const text = data.result || "";
      const cleaned = text.replace(/```json|```/g, "").trim();

      try {
        const parsed = JSON.parse(cleaned);
        setResult(parsed);
        
        // Collect scores
        const newScores = [...allScores, {
          communication: parsed.communication,
          clarity: parsed.clarity,
          technical_depth: parsed.technical_depth
        }];
        setAllScores(newScores);
        
        if (parsed.boss_reaction) await speak(parsed.boss_reaction);
        
        // Move to next question (don't use follow_up, just increment)
        setCurrentQuestionIndex(idx => idx + 1);
        
        // clear the answer input for next question
        setAnswer("");
        
      } catch (e) {
        // If parsing fails, show raw text so you can inspect what the model returned
        const fallback = { boss_reaction: cleaned, parsingError: e.message };
        setResult(fallback);
        setAnswer("");
        await speak(cleaned);
      }
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }

  }

  const currentQuestion = questions[currentQuestionIndex];
  
  // Calculate summary when 5 questions are done
  const interviewComplete = currentQuestionIndex >= 5;
  let summaryData = null;
  let passed = false;
  
  if (interviewComplete && allScores.length > 0) {
    const avgCommunication = (allScores.reduce((sum, s) => sum + (s.communication || 0), 0) / allScores.length).toFixed(1);
    const avgClarity = (allScores.reduce((sum, s) => sum + (s.clarity || 0), 0) / allScores.length).toFixed(1);
    const avgTechnicalDepth = (allScores.reduce((sum, s) => sum + (s.technical_depth || 0), 0) / allScores.length).toFixed(1);
    
    passed = (parseFloat(avgCommunication) >= 7 && parseFloat(avgClarity) >= 7 && parseFloat(avgTechnicalDepth) >= 7);
    
    summaryData = {
      communication: avgCommunication,
      clarity: avgClarity,
      technical_depth: avgTechnicalDepth,
      passed
    };
  }

  return (
    <div className="app-background">
      <h1>Interview Boss</h1>

      <p>
        <strong>Field:</strong> {field}
      </p>

      <textarea rows={1} style={{ width: "20%" }} value={field} onChange={(e) => setField(e.target.value)} />


      <p style={{ marginTop: "46vh", textAlign: "center", color: "black", backgroundColor: "rgba(163, 217, 234, 0.8)" }}>
        <strong>Question: {currentQuestion} </strong>
      </p>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <textarea rows={5} style={{ width: "80%" , marginTop: "1vh"}} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
      {/* rgba(244, 247, 190, 0.8) }*/}

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
        <div style={{ margin: "1rem 0" }}>
          <label>
            Upload PDF:&nbsp;
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
            />
          </label>
          {pdfFile && <span> {pdfFile.name} selected</span>}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={{ marginTop: 8 }}>
            {loading ? "Checking..." : "Submit"}
        </button>
      </div>

      {error && <div style={{ color: "red", marginTop: 12 }}>Error: {error}</div>}

      {interviewComplete && summaryData ? (
        <div>
          <div style={{ marginTop: 20, position: "absolute", top: 130, bottom: 290, left: 180, right: 620, backgroundColor: "rgba(255,255,255,0.8)", 
          padding: 12, borderRadius: 8, color: "black", fontSize: "14px"}}>
            <h3 style={{ marginTop: 0 }}>Overall Scores</h3>
            <p>Communication: {summaryData.communication}/10</p>
            <p>Clarity: {summaryData.clarity}/10</p>
            <p>Technical Depth: {summaryData.technical_depth}/10</p>
          </div>
          <div style={{ marginTop: 20, position: "absolute", top: 10, bottom: 250, left: 600, right: 20, backgroundColor: "rgba(255,255,255,0.8)", 
          padding: 12, borderRadius: 8, color: "black", fontSize: "14px"}}>
            <h3 style={{ marginTop: 0, color: summaryData.passed ? "green" : "red", fontSize: "20px" }}>
              {summaryData.passed ? "PASSED ✓" : "FAILED ✗"}
            </h3>
            <p>{summaryData.passed 
              ? "Congratulations! All scores are 7 or above."
              : "At least one category scored below 7."}</p>
          </div>
        </div>
      ) : result ? (
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
      ) : null}
    </div>
  )
}
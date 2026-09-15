# Audit Report: vignette-generator.tsx

Path: `D:\Work\Neuvo\ALICE\Source\components\vignette-generator.tsx`

### Analysis and Recommendations

#### 1. Logic Defects, Edge Cases, and Unhandled Promise/Async Failures

**Issue:**
- The `handleAnalyzeAndGenerate` function does not handle cases where `saveSessionContent` might fail. If `saveSessionContent` throws an error, the state will not be updated correctly, and the user will not be informed.

**Recommendation:**
- Add error handling for `saveSessionContent` to ensure that the state is updated even if the save fails.

```typescript
const handleAnalyzeAndGenerate = async () => {
  console.log("🚀 GENERATE CLICK", {
    clientId,
    caseId,
    sessionId,
    step,
    notesLength: sessionInput.length,
  });

  if (!sessionInput) {
    console.warn("⛔ GENERATE BLOCKED: session notes are empty");
    return;
  }

  setIsProcessing(true);
  setDegradedWarning(null);
  try {
    // 1. Analyze
    const analyzeUrl = `${API_BASE}/analyze/session`;
    const analyzePayload = {
      sessionNotes: sessionInput,
      clientId,
      sessionId,
    };

    console.log("➡️ POST", analyzeUrl, analyzePayload);

    const analyzeRes = await fetch(analyzeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyzePayload),
    });
    const analyzeData = await analyzeRes.json();

    console.log("⬅️ RESPONSE", analyzeUrl, analyzeRes.status, analyzeData);
    if (!analyzeRes.ok) {
      throw new Error(
        analyzeData?.detail || analyzeData?.error || "Analysis failed"
      );
    }

    setAnalysis(analyzeData);

    if (analyzeData?.degraded) {
      setDegradedWarning(analyzeData.warning || "AI analysis was unavailable.");
    }

    // 2. Generate Practice Package
    const genUrl = `${API_BASE}/generate/practice-package`;
    const genPayload = {
      sessionNotes: sessionInput,
      modality: analyzeData?.inferredModality,
      clientId,
      sessionId,
    };

    console.log("➡️ POST", genUrl, genPayload);

    const genRes = await fetch(genUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(genPayload),
    });
    const genData = await genRes.json();

    console.log("⬅️ RESPONSE", genUrl, genRes.status, genData);
    if (!genRes.ok) {
      throw new Error(
        genData?.detail ||
          genData?.error ||
          "Practice package generation failed"
      );
    }

    setPracticePackage(genData);

    if (genData?.degraded) {
      setDegradedWarning(genData.warning || "AI generation was unavailable.");
    }

    setStep(3);

    // 3. Save practice package to session
    try {
      await saveSessionContent(caseId, sessionId, {
        sessionNotes: sessionInput,
        analysis: analyzeData,
        practicePackage: genData,
        modality: analyzeData?.inferredModality,
      });
    } catch (saveErr) {
      console.error("Failed to save session content:", saveErr);
      alert("Failed to save session content. Please try again later.");
    }
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : "Failed to generate practice package");
  } finally {
    setIsProcessing(false);
  }
};
```

#### 2. Race Conditions, State Mutation Bugs, or Memory Leaks

**Issue:**
- The `useEffect` hook is not properly cleaning up the `colorScratchEl` when the component unmounts. This could lead to memory leaks if the component is re-mounted multiple times.

**Recommendation:**
- Add a cleanup function to the `useEffect` hook to remove the `colorScratchEl` when the component unmounts.

```typescript
useEffect(() => {
  setDegradedWarning(null);

  const session = useClientNavStore
    .getState()
    .client?.cases.find((c) => c.id === caseId)
    ?.sessions.find((sess) => sess.id === sessionId);

  if (!session) {
    setStep(1);
    setSessionInput("");
    setAnalysis(null);
    setPracticePackage(null);
    return;
  }

  setSessionInput(session.sessionNotes || "");

  const storedAnalysis = session.analysis as AnalysisResult | null;
  setAnalysis(storedAnalysis);

  if (storedAnalysis?.rationale === PLACEHOLDER_RATIONALE) {
    setDegradedWarning(
      "This session still holds a placeholder analysis from an earlier failed run — regenerate to replace it."
    );
  }

  // Try to load practice package if in session (from GET /sessions/:id)
  if (session.practicePackage) {
    setPracticePackage(session.practicePackage);
    setStep(3);
  } else {
    setPracticePackage(null);
    setStep(1);
  }

  return () => {
    if (colorScratchEl) {
      document.body.removeChild(colorScratchEl);
      colorScratchEl = null;
    }
  };
}, [sessionId, caseId]);
```

#### 3. Security Flaws

**Issue:**
- The code does not sanitize user input before sending it to the backend. This could lead to security vulnerabilities such as Cross-Site Scripting (XSS) or SQL Injection.

**Recommendation:**
- Sanitize user input before sending it to the backend. This can be done using libraries like `DOMPurify` for HTML content or parameterized queries for database operations.

```typescript
const sanitizeInput = (input: string) => {
  return DOMPurify.sanitize(input);
};

const handleAnalyzeAndGenerate = async () => {
  const sanitizedInput = sanitizeInput(sessionInput);

  setIsProcessing(true);
  setDegradedWarning(null);
  try {
    // 1. Analyze
    const analyzeUrl = `${API_BASE}/analyze/session`;
    const analyzePayload = {
      sessionNotes: sanitizedInput,
      clientId,
      sessionId,
    };

    console.log("➡️ POST", analyzeUrl, analyzePayload);

    const analyzeRes = await fetch(analyzeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyzePayload),
    });
    const analyzeData = await analyzeRes.json();

    console.log("⬅️ RESPONSE", analyzeUrl, analyzeRes.status, analyzeData);
    if (!analyzeRes.ok) {
      throw new Error(
        analyzeData?.detail || analyzeData?.error || "Analysis failed"
      );
    }

    setAnalysis(analyzeData);

    if (analyzeData?.degraded) {
      setDegradedWarning(analyzeData.warning || "AI analysis was unavailable.");
    }

    // 2. Generate Practice Package
    const genUrl = `${API_BASE}/generate/practice-package`;
    const genPayload = {
      sessionNotes: sanitizedInput,
      modality: analyzeData?.inferredModality,
      clientId,
      sessionId,
    };

    console.log("➡️ POST", genUrl, genPayload);

    const genRes = await fetch(genUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(genPayload),
    });
    const genData = await genRes.json();

    console.log("⬅️ RESPONSE", genUrl, genRes.status, genData);
    if (!genRes.ok) {
      throw new Error(
        genData?.detail ||
          genData?.error ||
          "Practice package generation failed"
      );
    }

    setPracticePackage(genData);

    if (genData?.degraded) {
      setDegradedWarning(genData.warning || "AI generation was unavailable.");
    }

    setStep(3);

    // 3. Save practice package to session
    try {
      await saveSessionContent(caseId, sessionId, {
        sessionNotes: sanitizedInput,
        analysis: analyzeData,
        practicePackage: genData,
        modality: analyzeData?.inferredModality,
      });
    } catch (saveErr) {
      console.error("Failed to save session content:", saveErr);
      alert("Failed to save session content. Please try again later.");
    }
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : "Failed to generate practice package");
  } finally {
    setIsProcessing(false);
  }
};
```

### Summary

- **Logic Defects:** Added error handling for `saveSessionContent`.
- **Race Conditions:** Added cleanup function to `useEffect` to remove `colorScratchEl`.
- **Security Flaws:** Sanitized user input before sending it to the backend.

These changes should improve the robustness and security of the `VignetteGenerator` component.

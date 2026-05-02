import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionNotes, clientId } = body;

    if (!sessionNotes) {
      return NextResponse.json({ error: "Missing sessionNotes" }, { status: 400 });
    }

    // Attempt to connect to Ollama
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "llama3", 
        prompt: `Analyze these clinical notes: ${sessionNotes}`,
        stream: false,
      }),
    });

    // Check if the fetch itself failed (e.g., Ollama is down)
    if (!response.ok) {
      console.error("Ollama connection failed with status:", response.status);
      return NextResponse.json({ error: "Ollama service unreachable" }, { status: 502 });
    }

    // Now it is safe to parse the JSON
    const data = await response.json();
    return NextResponse.json({ vignette: data.response });

  } catch (error: any) {
    // This logs the actual JS error (like "fetch failed") to your terminal
    console.error("!!! BACKEND CRASH !!!", error);
    
    return NextResponse.json({ 
      error: "Internal Server Error: " + error.message 
    }, { status: 500 });
  }
}
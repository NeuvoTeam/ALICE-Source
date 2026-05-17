export async function getContext() {
    return {
      system: "ALICE mental health platform",
  
      modules: [
        "client management",
        "session notes",
        "assessments"
      ],
  
      supabase: {
        tables: ["clients", "sessions", "notes"]
      },
  
      rules: [
        "trauma-informed language",
        "non-diagnostic by default"
      ]
    };
  }
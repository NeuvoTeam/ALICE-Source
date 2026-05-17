export const tools = [
    {
      name: "get_client",
      description: "Fetch a client record",
      input_schema: {
        type: "object",
        properties: {
          client_id: { type: "string" }
        }
      }
    }
  ];
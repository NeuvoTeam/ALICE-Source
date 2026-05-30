"use client"

import { useEffect, useState } from "react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"
import { Client } from "@/types";

export default function ClientLanding({
  onSelectClient,
}: {
  onSelectClient: (client: Client) => void;
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${API_BASE}/clients`)
        
        if (!res.ok) {
          throw new Error("Failed to fetch clients")
        }

        const data = await res.json()

        console.log("✅ Clients from Worker:", data) // ✅ debug

        setClients(data)
      } catch (err) {
        console.error("❌ Client fetch failed:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchClients()
  }, [])

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">Select Client</h1>

      {loading ? (
        <p>Loading clients...</p>
      ) : clients.length === 0 ? (
        <p className="text-gray-500">No clients found</p>
      ) : (
        clients.map((client) => (
          <div
            key={client.id}
            onClick={() => {
                console.log("CLICKED CLIENT:", client);
                onSelectClient(client);
            }}
            className="p-3 border rounded cursor-pointer hover:bg-gray-100"
          >
            {client.name}
          </div>
        ))
      )}
    </div>
  )
}

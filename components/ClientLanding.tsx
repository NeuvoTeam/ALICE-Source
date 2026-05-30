import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Client = {
    id: number;
    name: string;
};

export default function ClientLanding({
    onSelectClient,
  }: {
    onSelectClient: (client: Client) => void;
  }) {
    const [clients, setClients] = useState<Client[]>([
        { id: 1, name: "Jane Smith" },
        { id: 2, name: "John Doe" },
        { id: 3, name: "Client A" },
      ]);
  
  const [search, setSearch] = useState("");

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  
  const handleSelect = (client: Client) => {
    onSelectClient(client);
  };

  const handleAddClient = () => {
    const newName = prompt("Enter new client name:");
    if (!newName) return;

    setClients([
      ...clients,
      { id: Date.now(), name: newName }
    ]);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Select a Client</h1>

      <Input
        placeholder="Search clients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />

      <div className="grid gap-3">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="cursor-pointer hover:bg-gray-50"
            onClick={() => handleSelect(client)}
          >
            <CardContent className="p-4 text-lg">
              {client.name}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={handleAddClient} className="mt-4 w-full">
        + New Client
      </Button>
    </div>
  );
}
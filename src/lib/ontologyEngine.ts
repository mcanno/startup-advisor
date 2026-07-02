const BASE_URL = process.env.ONTOLOGY_ENGINE_URL!;

export async function describeConcept(conceptId: string) {
  const res = await fetch(`${BASE_URL}/concepts/${conceptId}`);
  if (!res.ok) throw new Error(`ontology-engine: ${res.status}`);
  return res.json();
}

export async function validateStartup(startupId: string) {
  const res = await fetch(`${BASE_URL}/startups/${startupId}/validate`);
  if (!res.ok) throw new Error(`ontology-engine: ${res.status}`);
  return res.json();
}

const BASE_URL = process.env.ONTOLOGY_ENGINE_URL!;
const TIMEOUT_MS = 8_000;

async function request(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`ontology-engine: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function describeConcept(conceptId: string) {
  return request(`/concepts/${conceptId}`);
}

export async function validateStartup(startupId: string) {
  return request(`/startups/${startupId}/validate`);
}

export async function getStartupGraph(startupId: string) {
  return request(`/startups/${startupId}/graph`);
}

export async function getSubclasses(conceptId: string): Promise<string[]> {
  const result = await request(`/concepts/${conceptId}/subclasses`);
  return result.subclasses as string[];
}

export async function createIndividual(
  startupId: string,
  individual: {
    id: string;
    concept_id: string;
    label: string;
    attributes?: Record<string, unknown>;
  },
) {
  return request(`/startups/${startupId}/individuals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(individual),
  });
}

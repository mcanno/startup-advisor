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

export async function getSubclasses(conceptId: string): Promise<string[]> {
  const result = await request(`/concepts/${conceptId}/subclasses`);
  return result.subclasses as string[];
}

// Shape real de GET /concepts/{id}/prerequisitos (ontology-engine): {concept_id,
// prerequisitos: [{concept_id, relacion, distancia}]} — prerequisitos: [] tanto
// si no hay precedentes como si el concept_id no existe, nunca un error.
export type Prerequisito = { concept_id: string; relacion: string; distancia: number };

export async function getPrerequisitos(conceptId: string): Promise<Prerequisito[]> {
  try {
    const result = await request(`/concepts/${conceptId}/prerequisitos`);
    return result.prerequisitos as Prerequisito[];
  } catch {
    return [];
  }
}

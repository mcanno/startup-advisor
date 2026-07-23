"""
main.py — microservicio FastAPI del ontology-engine. TBox puro (Lean
Startup, Osterwalder/Blank/Ries): sin ABox de ninguna startup real (ver
diseno_ontology_engine_solo_consulta.md en startup-next). Este servicio
ya no persiste ni expone hechos de ninguna startup — solo el esquema de
la ontología.

Endpoints:
  GET  /health
  GET  /concepts                                  -> lista el TBox completo
  GET  /concepts/{concept_id}                      -> describe() de un concepto
  GET  /concepts/{concept_id}/subclasses           -> subclasses_of()
  GET  /concepts/{concept_id}/prerequisitos         -> precedents_of() (TBox abstracto)

Variables de entorno:
  DATABASE_URL   -- Postgres, usado solo para cargar el TBox una vez al
                    arrancar el proceso (ver lifespan). Ningún endpoint
                    hace queries por request — no hay ABox que consultar.
"""

import os
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, HTTPException

from graph import load_tbox, OntologyGraph

DATABASE_URL = os.environ.get("DATABASE_URL")

tbox_cache: OntologyGraph | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tbox_cache
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL no está definida")
    with psycopg.connect(DATABASE_URL) as conn:
        tbox_cache = load_tbox(conn)
    yield


app = FastAPI(title="ontology-engine", lifespan=lifespan)


def get_tbox() -> OntologyGraph:
    if tbox_cache is None:
        raise HTTPException(status_code=503, detail="TBox aún no cargado")
    return tbox_cache


# ---------------------------------------------------------------- health
@app.get("/health")
def health():
    return {"status": "ok", "tbox_conceptos": len(get_tbox().concepts())}


# ---------------------------------------------------------------- TBox
@app.get("/concepts")
def list_concepts():
    og = get_tbox()
    return [
        {"id": n, **{k: v for k, v in og.g.nodes[n].items() if k != "node_type"}}
        for n in og.concepts()
    ]


@app.get("/concepts/{concept_id}")
def get_concept(concept_id: str):
    og = get_tbox()
    if concept_id not in og.g or og.g.nodes[concept_id].get("node_type") != "concept":
        raise HTTPException(status_code=404, detail=f"Concepto '{concept_id}' no existe")
    return {"id": concept_id, "description": og.describe(concept_id),
            **og.g.nodes[concept_id]}


@app.get("/concepts/{concept_id}/subclasses")
def get_subclasses(concept_id: str):
    og = get_tbox()
    if concept_id not in og.g:
        raise HTTPException(status_code=404, detail=f"Concepto '{concept_id}' no existe")
    return {"concept_id": concept_id, "subclasses": og.subclasses_of(concept_id)}


@app.get("/concepts/{concept_id}/prerequisitos")
def get_prerequisitos(concept_id: str):
    # A propósito, sin 404: [] tanto si no hay precedentes como si
    # concept_id no existe (razonamiento abstracto sobre el TBox, no
    # hechos de una startup — un id desconocido no es un error del
    # caller, sección de diseño acordada).
    og = get_tbox()
    return {"concept_id": concept_id, "prerequisitos": og.precedents_of(concept_id)}

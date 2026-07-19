"""
main.py — microservicio FastAPI del ontology-engine.

Endpoints:
  GET  /health
  GET  /concepts                                  -> lista el TBox completo
  GET  /concepts/{concept_id}                      -> describe() de un concepto
  GET  /concepts/{concept_id}/subclasses           -> subclasses_of()
  GET  /concepts/{concept_id}/prerequisitos         -> precedents_of() (TBox abstracto, sin ABox)
  GET  /startups/{startup_id}/graph                -> ABox completo (debug)
  GET  /startups/{startup_id}/neighbors/{node_id}?relation=X  -> neighbors_via()
  GET  /startups/{startup_id}/validate             -> validate() (motor de reglas)
  POST /startups/{startup_id}/individuals          -> registrar una instancia (Fase 2)
  POST /startups/{startup_id}/facts                -> registrar una relación entre instancias (Fase 2)

Variables de entorno:
  DATABASE_URL   -- misma cadena de conexión Postgres que usa el resto de la app
"""

import os
import json
from contextlib import asynccontextmanager

import psycopg
from psycopg.errors import ForeignKeyViolation
from psycopg_pool import ConnectionPool
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from graph import load_tbox, load_startup_graph, OntologyGraph
from rules import validate as run_validate

DATABASE_URL = os.environ.get("DATABASE_URL")

pool: ConnectionPool | None = None
tbox_cache: OntologyGraph | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool, tbox_cache
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL no está definida")
    # check=check_connection: valida la conexion (ping real) antes de
    # entregarla del pool, y la descarta/reconecta si Neon ya la cerro del
    # lado servidor (autosuspend/idle timeout) -- sin esto, una conexion
    # pooled obsoleta fallaba con "SSL connection has been closed
    # unexpectedly" en la primera request tras un periodo de inactividad.
    pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=5, check=ConnectionPool.check_connection)
    with pool.connection() as conn:
        tbox_cache = load_tbox(conn)
    yield
    pool.close()


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


# ---------------------------------------------------------------- ABox (lectura)
@app.get("/startups/{startup_id}/graph")
def get_startup_graph(startup_id: str):
    with pool.connection() as conn:
        og = load_startup_graph(conn, get_tbox(), startup_id)
    return {
        "stats": og.stats(),
        "individuals": [
            {"id": n, **{k: v for k, v in og.g.nodes[n].items() if k != "node_type"}}
            for n in og.individuals()
        ],
    }


@app.get("/startups/{startup_id}/neighbors/{node_id}")
def get_neighbors(startup_id: str, node_id: str, relation: str):
    with pool.connection() as conn:
        og = load_startup_graph(conn, get_tbox(), startup_id)
    if node_id not in og.g:
        raise HTTPException(status_code=404, detail=f"Nodo '{node_id}' no existe para esta startup")
    return {"node_id": node_id, "relation": relation, "neighbors": og.neighbors_via(node_id, relation)}


@app.get("/startups/{startup_id}/validate")
def validate_startup(startup_id: str):
    with pool.connection() as conn:
        og = load_startup_graph(conn, get_tbox(), startup_id)
    return run_validate(og)


# ---------------------------------------------------------------- ABox (escritura, para Fase 2)
class IndividualIn(BaseModel):
    id: str
    concept_id: str
    label: str
    attributes: dict = {}


class FactIn(BaseModel):
    source_id: str
    relation: str
    target_id: str
    attributes: dict = {}


@app.post("/startups/{startup_id}/individuals", status_code=201)
def create_individual(startup_id: str, body: IndividualIn):
    og = get_tbox()
    if body.concept_id not in og.g or og.g.nodes[body.concept_id].get("node_type") != "concept":
        raise HTTPException(status_code=400, detail=f"concept_id '{body.concept_id}' no existe en el TBox")
    try:
        with pool.connection() as conn:
            conn.execute(
                "INSERT INTO startup_individuals (startup_id, id, concept_id, label, attributes) "
                "VALUES (%s, %s, %s, %s, %s) "
                "ON CONFLICT (startup_id, id) DO UPDATE SET "
                "concept_id = EXCLUDED.concept_id, label = EXCLUDED.label, attributes = EXCLUDED.attributes;",
                (startup_id, body.id, body.concept_id, body.label, json.dumps(body.attributes)),
            )
            conn.commit()
    except ForeignKeyViolation:
        # fk_startup_individuals_startup (startup_id -> startups.id) -- ver
        # HANDOFF.md de este servicio. Antes esto llegaba al caller como un
        # 500 sin detalle (excepción no manejada); startup_id inexistente en
        # la tabla `startups` de la app es un error del caller, no un fallo
        # interno del servicio.
        raise HTTPException(
            status_code=404,
            detail=f"startup_id '{startup_id}' no existe en la tabla startups -- registrala primero del lado de la app.",
        )
    return {"ok": True}


@app.post("/startups/{startup_id}/facts", status_code=201)
def create_fact(startup_id: str, body: FactIn):
    try:
        with pool.connection() as conn:
            conn.execute(
                "INSERT INTO startup_facts (startup_id, source_id, relation, target_id, attributes) "
                "VALUES (%s, %s, %s, %s, %s);",
                (startup_id, body.source_id, body.relation, body.target_id, json.dumps(body.attributes)),
            )
            conn.commit()
    except ForeignKeyViolation:
        # Mismo patrón que create_individual: source_id/target_id deben
        # referenciar individuals ya creados para esta misma startup_id.
        raise HTTPException(
            status_code=404,
            detail=(
                f"source_id '{body.source_id}' o target_id '{body.target_id}' no existen como "
                f"individuals de startup_id '{startup_id}' -- creá los individuals primero."
            ),
        )
    return {"ok": True}

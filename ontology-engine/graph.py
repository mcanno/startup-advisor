"""
graph.py — reconstruye, para una startup concreta, el mismo tipo de grafo
(`networkx.MultiDiGraph`) que usábamos en el notebook, pero leyendo el
TBox y el ABox desde Postgres en lugar de tenerlos hardcodeados en Python.

Estrategia de carga:
  - El TBox (conceptos+relaciones) cambia poco: se carga una vez por
    proceso y se cachea en memoria (`load_tbox`, con lru_cache manual).
  - El ABox (hechos de una startup) se carga bajo demanda, por startup_id,
    en cada request — el volumen por startup es pequeño (decenas de
    nodos), así que no hace falta cachear.

La clase `OntologyGraph` es funcionalmente idéntica a la del notebook
(mismos métodos: describe, subclasses_of, neighbors_via, stats), para que
el motor de reglas en rules.py sea un copy-paste literal del notebook.
"""

from __future__ import annotations

import networkx as nx
# psycopg se importa de forma perezosa dentro de load_tbox/load_startup_graph
# (no a nivel de módulo) para que OntologyGraph + las reglas de rules.py se
# puedan testear sin tener psycopg instalado ni una Postgres real disponible.


class OntologyGraph:
    def __init__(self):
        self.g = nx.MultiDiGraph()

    # ---------- TBox ----------
    def load_concepts_from_rows(self, rows):
        for row in rows:
            self.g.add_node(row["id"], node_type="concept", label=row["label"],
                             definition=row["definition"], source=row["source"])
            if row["parent_id"]:
                self.g.add_edge(row["id"], row["parent_id"], relation="es_subclase_de")

    def load_relations_from_rows(self, rows):
        for row in rows:
            if row["domain_concept_id"] in self.g and row["range_concept_id"] in self.g:
                self.g.add_edge(row["domain_concept_id"], row["range_concept_id"],
                                 relation=row["id"], label=row["label"],
                                 definition=row["definition"], cardinality=row["cardinality"])

    # ---------- ABox ----------
    def load_individuals_from_rows(self, rows):
        for row in rows:
            self.g.add_node(row["id"], node_type="individual", label=row["label"],
                             concept_id=row["concept_id"], **(row.get("attributes") or {}))
            self.g.add_edge(row["id"], row["concept_id"], relation="es_instancia_de")

    def load_facts_from_rows(self, rows):
        for row in rows:
            self.g.add_edge(row["source_id"], row["target_id"], relation=row["relation"],
                             **(row.get("attributes") or {}))

    # ---------- consultas (idénticas al notebook) ----------
    def concepts(self):
        return [n for n, d in self.g.nodes(data=True) if d.get("node_type") == "concept"]

    def individuals(self):
        return [n for n, d in self.g.nodes(data=True) if d.get("node_type") == "individual"]

    def neighbors_via(self, node_id: str, relation: str):
        out = []
        for _, tgt, data in self.g.out_edges(node_id, data=True):
            if data.get("relation") == relation:
                out.append(tgt)
        return out

    def subclasses_of(self, concept_id: str):
        return [n for n, tgt, d in self.g.in_edges(concept_id, data=True)
                if d.get("relation") == "es_subclase_de"]

    def ancestors(self, concept_id: str):
        seen = set()
        frontier = [concept_id]
        while frontier:
            current = frontier.pop()
            for _, tgt, d in self.g.out_edges(current, data=True):
                if d.get("relation") == "es_subclase_de" and tgt not in seen:
                    seen.add(tgt)
                    frontier.append(tgt)
        return seen

    def describe(self, node_id: str) -> str:
        d = self.g.nodes[node_id]
        base = f"{node_id} ({d.get('label')}): {d.get('definition', '')}"
        if d.get("source"):
            base += f" [Fuente: {d['source']}]"
        return base

    def stats(self):
        return {
            "conceptos": len(self.concepts()),
            "individuos": len(self.individuals()),
            "relaciones_totales": self.g.number_of_edges(),
        }


def load_tbox(conn) -> OntologyGraph:
    """Carga SOLO el esquema (conceptos + relaciones). Llamar una vez y
    cachear en memoria de proceso (ver main.py). `conn` es una
    psycopg.Connection; no se tipa explícitamente para no forzar la
    importación de psycopg en contextos de test sin BD."""
    from psycopg.rows import dict_row

    og = OntologyGraph()
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, label, definition, source, parent_id FROM ontology_concepts;")
        og.load_concepts_from_rows(cur.fetchall())

        cur.execute("SELECT id, label, domain_concept_id, range_concept_id, definition, cardinality "
                    "FROM ontology_relations;")
        og.load_relations_from_rows(cur.fetchall())
    return og


def load_startup_graph(conn, tbox: OntologyGraph, startup_id: str) -> OntologyGraph:
    """Combina el TBox ya cargado (pasado por referencia, se copia) con el
    ABox de una startup concreta. Se llama en cada request que necesite
    razonar sobre los hechos de esa startup."""
    from psycopg.rows import dict_row

    og = OntologyGraph()
    og.g = tbox.g.copy()

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, concept_id, label, attributes FROM startup_individuals WHERE startup_id = %s;",
            (startup_id,),
        )
        og.load_individuals_from_rows(cur.fetchall())

        cur.execute(
            "SELECT source_id, relation, target_id, attributes FROM startup_facts WHERE startup_id = %s;",
            (startup_id,),
        )
        og.load_facts_from_rows(cur.fetchall())

    return og

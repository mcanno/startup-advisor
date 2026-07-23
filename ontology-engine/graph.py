"""
graph.py — TBox puro (Lean Startup, Osterwalder/Blank/Ries) como
`networkx.MultiDiGraph`, leído desde Postgres (ver diseno_ontology_engine_solo_consulta.md
en startup-next: ontology-engine ya no carga ni expone ABox de ninguna
startup real).

El TBox (conceptos+relaciones) cambia poco: se carga una vez por proceso
en el arranque (`load_tbox`, ver main.py) y se cachea en memoria.

La clase `OntologyGraph` conserva los mismos métodos de consulta que
tenía en el notebook de diseño (describe, subclasses_of, precedents_of,
concepts), para que siga siendo la misma fuente de verdad del TBox.
"""

from __future__ import annotations

import networkx as nx
# psycopg se importa de forma perezosa dentro de load_tbox (no a nivel de
# módulo) para que OntologyGraph se pueda testear sin tener psycopg
# instalado ni una Postgres real disponible.


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
                                 definition=row["definition"], cardinality=row["cardinality"],
                                 is_sequential=row.get("is_sequential", False))

    # ---------- consultas (idénticas al notebook) ----------
    def concepts(self):
        return [n for n, d in self.g.nodes(data=True) if d.get("node_type") == "concept"]

    def subclasses_of(self, concept_id: str):
        return [n for n, tgt, d in self.g.in_edges(concept_id, data=True)
                if d.get("relation") == "es_subclase_de"]

    def precedents_of(self, concept_id: str) -> list[dict]:
        """BFS hacia atrás (in_edges) sobre aristas is_sequential=True,
        arrancando del TBox que ya carga load_tbox() — sin ABox, sin
        tocar Postgres de nuevo. Devuelve [] tanto si concept_id no
        existe como si no tiene precedentes: este endpoint no debe
        fallar por un id desconocido (ver main.py).

        Nota de desviación respecto al pedido original: la firma pedida
        era `-> list[Concept]` (el dataclass de domain_ontology.py), pero
        el contrato del endpoint necesita, por cada precedente, la
        relación que lo conecta y la distancia en saltos — datos que
        Concept no tiene y que graph.py no puede reconstruir sin
        importar domain_ontology.py (hoy deliberadamente desacoplado de
        él, ver docstring del módulo). Devuelve dicts con
        concept_id/relacion/distancia en su lugar, que es exactamente
        lo que el endpoint expone.
        """
        if concept_id not in self.g:
            return []

        results: list[dict] = []
        seen = {concept_id}
        frontier = [concept_id]
        distancia = 0
        while frontier:
            distancia += 1
            next_frontier = []
            for node in frontier:
                for src, _, d in self.g.in_edges(node, data=True):
                    if d.get("is_sequential") and src not in seen:
                        seen.add(src)
                        results.append({"concept_id": src, "relacion": d.get("relation"), "distancia": distancia})
                        next_frontier.append(src)
            frontier = next_frontier
        return results

    def describe(self, node_id: str) -> str:
        d = self.g.nodes[node_id]
        base = f"{node_id} ({d.get('label')}): {d.get('definition', '')}"
        if d.get("source"):
            base += f" [Fuente: {d['source']}]"
        return base


def load_tbox(conn) -> OntologyGraph:
    """Carga SOLO el esquema (conceptos + relaciones). Llamar una vez al
    arrancar el proceso y cachear en memoria (ver main.py). `conn` es una
    psycopg.Connection; no se tipa explícitamente para no forzar la
    importación de psycopg en contextos de test sin BD."""
    from psycopg.rows import dict_row

    og = OntologyGraph()
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, label, definition, source, parent_id FROM ontology_concepts;")
        og.load_concepts_from_rows(cur.fetchall())

        cur.execute("SELECT id, label, domain_concept_id, range_concept_id, definition, cardinality, "
                    "is_sequential FROM ontology_relations;")
        og.load_relations_from_rows(cur.fetchall())
    return og

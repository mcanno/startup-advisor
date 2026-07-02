"""
rules.py — motor de reglas de validación, portado literalmente de la
sección 10 del notebook (07_use_case_reasoning.py). Misma lógica, mismos
IDs de regla — así el informe/agente validador de fases posteriores puede
referenciar "R1_hipotesis_sin_experimento" y significa lo mismo en todas
partes (notebook de diseño, microservicio, tests).
"""

from graph import OntologyGraph


class Rule:
    def __init__(self, id_, description, check_fn):
        self.id = id_
        self.description = description
        self.check_fn = check_fn

    def run(self, og: OntologyGraph):
        return self.check_fn(og)


def rule_hypothesis_has_experiment(og: OntologyGraph):
    violations = []
    for ind_id in og.individuals():
        concept_id = og.g.nodes[ind_id].get("concept_id")
        if concept_id:
            is_hyp = concept_id == "Hypothesis" or "Hypothesis" in og.ancestors(concept_id)
            if is_hyp:
                tested = og.neighbors_via(ind_id, "se_testea_con")
                if not tested:
                    violations.append(f"'{ind_id}' es una hipótesis sin experimento asociado.")
    return violations


def rule_pivot_needs_validated_learning(og: OntologyGraph):
    violations = []
    for ind_id in og.individuals():
        concept_id = og.g.nodes[ind_id].get("concept_id")
        if concept_id and (concept_id == "Pivot" or "Pivot" in og.ancestors(concept_id)):
            backers = [src for src, tgt, d in og.g.in_edges(ind_id, data=True)
                       if d.get("relation") == "informa_decision_pivot"]
            if not backers:
                violations.append(f"'{ind_id}' es un pivote sin aprendizaje validado que lo respalde.")
    return violations


def rule_metric_should_be_actionable(og: OntologyGraph):
    warnings = []
    for ind_id in og.individuals():
        if og.g.nodes[ind_id].get("concept_id") == "VanityMetric":
            if og.neighbors_via(ind_id, "genera_aprendizaje"):
                warnings.append(f"'{ind_id}' es una métrica de vanidad usada para generar aprendizaje: revisar.")
    return warnings


def rule_startup_has_founder(og: OntologyGraph):
    violations = []
    for ind_id in og.individuals():
        if og.g.nodes[ind_id].get("concept_id") == "Startup":
            if not og.neighbors_via(ind_id, "tiene_fundador"):
                violations.append(f"'{ind_id}' es una startup sin fundador registrado.")
    return violations


RULES = [
    Rule("R1_hipotesis_sin_experimento", "Toda hipótesis debe tener un experimento", rule_hypothesis_has_experiment),
    Rule("R2_pivote_sin_aprendizaje", "Todo pivote debe estar respaldado por aprendizaje validado", rule_pivot_needs_validated_learning),
    Rule("R3_metrica_de_vanidad", "Advertir si se usa una métrica de vanidad para decidir", rule_metric_should_be_actionable),
    Rule("R4_startup_sin_fundador", "Toda startup debe tener fundador", rule_startup_has_founder),
]


def validate(og: OntologyGraph) -> dict:
    report = {}
    for rule in RULES:
        report[rule.id] = {"descripcion": rule.description, "hallazgos": rule.run(og)}
    return report

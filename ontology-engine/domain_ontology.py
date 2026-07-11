"""
Fuente de verdad del TBox (conceptos y relaciones de la ontología Lean
Startup). Este archivo es una copia 1:1 del contenido validado en el
notebook `lean_startup_ontology.ipynb` (sección 4), reempaquetado como
módulo importable por el microservicio y por `seed.py`.

Si en el futuro amplías la ontología (nuevos conceptos, nuevas fuentes),
edítalo AQUÍ y vuelve a correr `seed.py` — es la única fuente de verdad,
tanto para el notebook de diseño como para producción.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class RelationCardinality(str, Enum):
    ONE_TO_ONE = "1:1"
    ONE_TO_MANY = "1:N"
    MANY_TO_MANY = "N:M"


@dataclass
class Concept:
    id: str
    label: str
    definition: str
    source: str
    parent: Optional[str] = None
    examples: list[str] = field(default_factory=list)


@dataclass
class Relation:
    id: str
    label: str
    domain: str
    range: str
    definition: str
    cardinality: RelationCardinality = RelationCardinality.ONE_TO_MANY
    # True si domain precede a range en el tiempo/metodología (no solo una
    # asociación estructural). Verificado a mano contra la definición de
    # cada una de las 9 relaciones marcadas — todas consistentes en la
    # misma dirección (domain precede a range). R1/R2 de rules.py ya
    # trataban se_testea_con/informa_decision_pivot como precedencia sobre
    # hechos reales; esto lo formaliza en el TBox.
    is_sequential: bool = False


CONCEPTS: list[Concept] = [
    Concept("Startup", "Startup", "Institución humana diseñada para crear un nuevo producto o "
            "servicio bajo condiciones de incertidumbre extrema.", "Ries"),
    Concept("Founder", "Fundador/Emprendedor", "Persona que lidera la búsqueda de un modelo de "
            "negocio repetible y escalable.", "Blank"),

    Concept("BusinessModelCanvas", "Business Model Canvas", "Herramienta visual de una página que "
            "describe cómo una organización crea, entrega y captura valor, mediante 9 bloques.", "Osterwalder"),
    Concept("CustomerSegment", "Segmento de clientes", "Grupos de personas u organizaciones distintos "
            "que la empresa busca alcanzar y servir.", "Osterwalder", parent="BusinessModelCanvas"),
    Concept("ValueProposition", "Propuesta de valor", "Conjunto de beneficios que una empresa ofrece "
            "a un segmento de clientes para resolver un problema o satisfacer una necesidad.", "Osterwalder",
            parent="BusinessModelCanvas"),
    Concept("Channel", "Canal", "Cómo la empresa se comunica y alcanza a sus segmentos de clientes "
            "para entregar la propuesta de valor.", "Osterwalder", parent="BusinessModelCanvas"),
    Concept("CustomerRelationship", "Relación con clientes", "Tipo de relación que la empresa "
            "establece con cada segmento de clientes.", "Osterwalder", parent="BusinessModelCanvas"),
    Concept("RevenueStream", "Flujo de ingresos", "Efectivo que una empresa genera a partir de cada "
            "segmento de clientes.", "Osterwalder", parent="BusinessModelCanvas"),
    Concept("KeyResource", "Recursos clave", "Activos más importantes requeridos para que el modelo "
            "de negocio funcione.", "Osterwalder", parent="BusinessModelCanvas"),
    Concept("KeyActivity", "Actividades clave", "Acciones más importantes que una empresa debe "
            "realizar para operar con éxito.", "Osterwalder", parent="BusinessModelCanvas"),
    Concept("KeyPartnership", "Socios clave", "Red de proveedores y socios que hacen funcionar el "
            "modelo de negocio.", "Osterwalder", parent="BusinessModelCanvas"),
    Concept("CostStructure", "Estructura de costos", "Todos los costos incurridos para operar el "
            "modelo de negocio.", "Osterwalder", parent="BusinessModelCanvas"),

    Concept("CustomerDiscovery", "Descubrimiento de clientes", "Fase 1: convertir las hipótesis del "
            "fundador en hechos, saliendo a hablar con clientes reales.", "Blank"),
    Concept("CustomerValidation", "Validación de clientes", "Fase 2: probar que se ha encontrado un "
            "modelo de negocio repetible y escalable.", "Blank"),
    Concept("CustomerCreation", "Creación de clientes", "Fase 3: generar demanda del usuario final y "
            "dirigirla al canal de ventas de la empresa.", "Blank"),
    Concept("CompanyBuilding", "Construcción de la empresa", "Fase 4: transición de una organización "
            "informal de aprendizaje a un departamento formal con procesos.", "Blank"),
    Concept("Hypothesis", "Hipótesis", "Suposición no probada sobre el negocio que debe validarse "
            "con datos reales, no con opiniones.", "Blank/Ries"),
    Concept("ProblemHypothesis", "Hipótesis de problema", "Suposición sobre qué problema tiene el "
            "cliente y cuán importante es para él.", "Blank", parent="Hypothesis"),
    Concept("ValueHypothesis", "Hipótesis de valor", "Suposición sobre si un producto realmente "
            "entrega valor a los clientes una vez lo usan.", "Ries", parent="Hypothesis"),
    Concept("GrowthHypothesis", "Hipótesis de crecimiento", "Suposición sobre cómo nuevos clientes "
            "descubrirán un producto o servicio.", "Ries", parent="Hypothesis"),
    Concept("EarlyEvangelist", "Cliente evangelista temprano", "Cliente visionario que percibe el "
            "problema, ha buscado una solución activamente y está dispuesto a comprar un producto "
            "incompleto.", "Blank"),
    Concept("GetOutOfTheBuilding", "Salir del edificio", "Principio central de Customer Development: "
            "los hechos sobre el negocio están fuera de la oficina, no en suposiciones internas.", "Blank"),

    Concept("MVP", "Producto Mínimo Viable", "Versión de un producto con el mínimo esfuerzo que "
            "permite ejecutar un ciclo completo de Construir-Medir-Aprender con el mínimo esfuerzo.", "Ries"),
    Concept("Experiment", "Experimento", "Prueba diseñada para validar o invalidar una hipótesis "
            "de negocio de forma científica.", "Ries"),
    Concept("BuildMeasureLearnLoop", "Ciclo Construir-Medir-Aprender", "Bucle central de Lean "
            "Startup: convertir ideas en productos, medir cómo responden los clientes, y aprender "
            "si pivotar o perseverar.", "Ries"),
    Concept("Metric", "Métrica", "Dato usado para evaluar el progreso del negocio.", "Ries"),
    Concept("ActionableMetric", "Métrica accionable", "Métrica que demuestra claras relaciones de "
            "causa y efecto y es reproducible.", "Ries", parent="Metric"),
    Concept("VanityMetric", "Métrica de vanidad", "Métrica que hace sentir bien pero no informa "
            "decisiones (ej. registros totales acumulados).", "Ries", parent="Metric"),
    Concept("ValidatedLearning", "Aprendizaje validado", "Unidad de progreso en una startup: "
            "conocimiento riguroso, empírico, obtenido al probar hipótesis con clientes reales.", "Ries"),
    Concept("InnovationAccounting", "Contabilidad de la innovación", "Método cuantitativo que "
            "permite ver si el motor de crecimiento de la startup está funcionando.", "Ries"),
    Concept("Pivot", "Pivote", "Cambio estructurado diseñado para probar una nueva hipótesis "
            "fundamental sobre el producto, la estrategia o el motor de crecimiento.", "Ries"),
    Concept("Persevere", "Perseverar", "Decisión de continuar con el rumbo actual porque el "
            "aprendizaje validado confirma las hipótesis.", "Ries"),
    Concept("EngineOfGrowth", "Motor de crecimiento", "Mecanismo que las startups usan para lograr "
            "crecimiento sostenible: pegajoso (sticky), viral o pagado.", "Ries"),
]

PIVOT_TYPES = [
    "ZoomInPivot", "ZoomOutPivot", "CustomerSegmentPivot", "CustomerNeedPivot",
    "PlatformPivot", "BusinessArchitecturePivot", "ValueCapturePivot",
    "EngineOfGrowthPivot", "ChannelPivot", "TechnologyPivot",
]
_PIVOT_LABELS = {
    "ZoomInPivot": "Pivote de acercamiento (una función se convierte en todo el producto)",
    "ZoomOutPivot": "Pivote de alejamiento (todo el producto pasa a ser una función)",
    "CustomerSegmentPivot": "Pivote de segmento de cliente",
    "CustomerNeedPivot": "Pivote de necesidad del cliente",
    "PlatformPivot": "Pivote de plataforma (de app a plataforma o viceversa)",
    "BusinessArchitecturePivot": "Pivote de arquitectura de negocio (alto margen/bajo volumen vs. viceversa)",
    "ValueCapturePivot": "Pivote de captura de valor (modelo de monetización)",
    "EngineOfGrowthPivot": "Pivote de motor de crecimiento",
    "ChannelPivot": "Pivote de canal",
    "TechnologyPivot": "Pivote de tecnología",
}
for pid in PIVOT_TYPES:
    CONCEPTS.append(Concept(pid, _PIVOT_LABELS[pid], _PIVOT_LABELS[pid], "Ries", parent="Pivot"))


RELATIONS: list[Relation] = [
    Relation("tiene_fundador", "tiene fundador", "Startup", "Founder",
             "Una startup es liderada por uno o más fundadores.", RelationCardinality.ONE_TO_MANY),
    Relation("define_canvas", "define", "Startup", "BusinessModelCanvas",
             "Una startup articula su modelo de negocio en un Business Model Canvas.",
             RelationCardinality.ONE_TO_ONE),
    Relation("compuesto_por", "compuesto por", "BusinessModelCanvas", "CustomerSegment",
             "El canvas está compuesto por 9 bloques.", RelationCardinality.ONE_TO_MANY),
    Relation("formula_hipotesis", "formula", "Founder", "Hypothesis",
             "El fundador formula hipótesis de negocio no probadas.", RelationCardinality.ONE_TO_MANY),
    Relation("relaciona_con_bloque", "se relaciona con", "Hypothesis", "ValueProposition",
             "Una hipótesis de valor está anclada a un bloque concreto del canvas.",
             RelationCardinality.ONE_TO_MANY),
    Relation("se_testea_con", "se testea con", "Hypothesis", "Experiment",
             "Toda hipótesis debe contrastarse mediante un experimento diseñado científicamente.",
             RelationCardinality.ONE_TO_MANY, is_sequential=True),
    Relation("produce", "produce", "Experiment", "MVP",
             "Un experimento habitualmente se ejecuta construyendo un MVP.",
             RelationCardinality.ONE_TO_ONE, is_sequential=True),
    Relation("se_mide_con", "se mide con", "MVP", "Metric",
             "El comportamiento de los clientes frente al MVP se mide con métricas.",
             RelationCardinality.ONE_TO_MANY, is_sequential=True),
    Relation("genera_aprendizaje", "genera", "Metric", "ValidatedLearning",
             "El análisis de las métricas genera (o no) aprendizaje validado.",
             RelationCardinality.MANY_TO_MANY, is_sequential=True),
    Relation("informa_decision_pivot", "informa decisión de pivotar", "ValidatedLearning", "Pivot",
             "El aprendizaje validado puede llevar a la decisión de pivotar.",
             RelationCardinality.ONE_TO_MANY, is_sequential=True),
    Relation("informa_decision_perseverar", "informa decisión de perseverar", "ValidatedLearning",
             "Persevere", "El aprendizaje validado puede llevar a la decisión de perseverar.",
             RelationCardinality.ONE_TO_MANY, is_sequential=True),
    Relation("modifica_bloque", "modifica", "Pivot", "BusinessModelCanvas",
             "Un pivote implica modificar uno o más bloques del canvas.",
             RelationCardinality.ONE_TO_MANY),
    Relation("atraviesa_fase", "atraviesa", "Startup", "CustomerDiscovery",
             "La startup atraviesa las 4 fases de Customer Development de forma secuencial.",
             RelationCardinality.ONE_TO_MANY),
    Relation("precede_a", "precede a", "CustomerDiscovery", "CustomerValidation",
             "Orden secuencial de las fases de Customer Development.", RelationCardinality.ONE_TO_ONE,
             is_sequential=True),
    Relation("precede_a_2", "precede a", "CustomerValidation", "CustomerCreation",
             "Orden secuencial de las fases de Customer Development.", RelationCardinality.ONE_TO_ONE,
             is_sequential=True),
    Relation("precede_a_3", "precede a", "CustomerCreation", "CompanyBuilding",
             "Orden secuencial de las fases de Customer Development.", RelationCardinality.ONE_TO_ONE,
             is_sequential=True),
    Relation("ejecuta_ciclo", "ejecuta", "Startup", "BuildMeasureLearnLoop",
             "La startup ejecuta el ciclo de forma continua e iterativa.",
             RelationCardinality.ONE_TO_MANY),
    Relation("identifica_evangelista", "identifica", "CustomerDiscovery", "EarlyEvangelist",
             "En el descubrimiento de clientes se identifica a los evangelistas tempranos.",
             RelationCardinality.ONE_TO_MANY),
    Relation("aplica_principio", "aplica", "CustomerDiscovery", "GetOutOfTheBuilding",
             "El descubrimiento de clientes se rige por el principio de salir del edificio.",
             RelationCardinality.ONE_TO_ONE),
    Relation("usa_motor", "usa", "Startup", "EngineOfGrowth",
             "La startup escala apoyándose en un motor de crecimiento.", RelationCardinality.ONE_TO_MANY),
    Relation("cuantifica_con", "cuantifica con", "EngineOfGrowth", "InnovationAccounting",
             "El progreso del motor de crecimiento se cuantifica con contabilidad de la innovación.",
             RelationCardinality.ONE_TO_ONE),
]


def get_concept_by_id(cid: str) -> Concept | None:
    return next((c for c in CONCEPTS if c.id == cid), None)

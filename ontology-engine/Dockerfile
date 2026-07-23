# El ontology-engine es un microservicio Python de larga duración
# (mantiene el TBox cacheado en memoria; TBox puro, sin ABox de ninguna
# startup real, ver diseno_ontology_engine_solo_consulta.md en startup-next).
# Vercel no ejecuta este tipo de proceso; despliega esta imagen en
# Railway, Fly.io, Render o un contenedor propio, y expón su URL
# a la app Next.js vía la variable ONTOLOGY_ENGINE_URL.

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY domain_ontology.py graph.py main.py seed.py ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

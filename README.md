# Startup Advisor

Aplicación web que entrevista a emprendedores con un agente IA y genera un informe de diagnóstico con recomendaciones de próximos pasos.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **Clerk** para autenticación
- **Neon Postgres** + **Drizzle ORM** para persistencia
- **Anthropic Claude** (Sonnet 4.6) para el agente, con streaming y prompt caching del system prompt
- Despliegue en **Vercel**

## Cómo funciona

1. El usuario inicia una entrevista desde el panel.
2. Un agente Claude empieza haciéndole preguntas adaptadas a su situación, cubriendo nueve áreas clave (problema, solución, equipo, mercado, tracción, modelo de negocio, recursos, riesgos, pregunta principal).
3. Cuando el agente considera que tiene información suficiente, invoca la herramienta `produce_report`, que dispara la generación del informe y redirige al usuario a la página del informe.
4. El informe queda guardado y se puede consultar desde el panel.

## Setup local

### 1. Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Neon Postgres
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

- **Clerk**: crea una aplicación en https://dashboard.clerk.com y copia las dos claves desde *API Keys*.
- **Neon**: crea un proyecto en https://console.neon.tech y copia la cadena de conexión *pooled*.
- **Anthropic**: genera una API key en https://console.anthropic.com.

### 2. Migrar la base de datos

```bash
npm run db:generate   # genera SQL desde el schema (la primera vez)
npm run db:migrate    # aplica las migraciones a Neon
# alternativa rápida en desarrollo:
npm run db:push       # empuja el schema directamente sin migración versionada
```

### 3. Arrancar el servidor de desarrollo

```bash
npm run dev
```

Abre http://localhost:3000.

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx                # ClerkProvider + lang=es
│   ├── page.tsx                  # Landing
│   ├── actions.ts                # Server actions (startInterview)
│   ├── sign-in/, sign-up/        # Páginas de Clerk
│   ├── dashboard/page.tsx        # Lista de entrevistas del usuario
│   ├── interview/[id]/
│   │   ├── page.tsx              # Chat con el agente
│   │   └── report/page.tsx       # Informe final
│   └── api/interview/[id]/chat/route.ts  # Endpoint del agente (SSE)
├── components/chat.tsx           # Componente cliente del chat (streaming SSE)
├── lib/
│   ├── anthropic.ts              # Cliente + system prompt + tool produce_report
│   └── db/
│       ├── schema.ts             # interviews / messages / reports
│       ├── queries.ts            # helpers de acceso a la BD
│       └── index.ts              # cliente Drizzle (lazy)
└── proxy.ts                      # Clerk middleware (en Next.js 16 el archivo es proxy.ts)
```

## Despliegue en Vercel

1. Sube el repo a GitHub.
2. Importa el proyecto en Vercel y conecta el repo.
3. Configura las cuatro variables de entorno en *Project Settings → Environment Variables*.
4. En **Build & Development Settings**, deja los valores por defecto (`next build` y `next start`).
5. Deploy.

> **Nota**: El endpoint de chat usa `runtime = "nodejs"` y `maxDuration = 60`. Si necesitas entrevistas más largas en Vercel Hobby, puedes subir hasta 300 en Pro.

## Notas de diseño

- **Agente con tool use, no orquestación bifásica**: el modelo decide cuándo cambiar de "entrevista" a "informe" llamando a la tool `produce_report`. Es más natural y menos código.
- **Prompt caching**: el system prompt se marca con `cache_control: { type: "ephemeral" }` para reducir coste cuando la conversación crece.
- **Streaming**: el endpoint devuelve SSE (`text/event-stream`) con tres tipos de evento — `text` (deltas), `report_ready` (la tool fue invocada), `done`.
- **Datos del usuario**: Clerk maneja los usuarios; la app solo guarda el `userId` de Clerk en cada entrevista para acotar las consultas.

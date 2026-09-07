# Decision Support Tool — Backend

## Overview

The backend of the Decision Support Tool provides the server-side APIs and processing required to create comparisons, gather and manage evidence, evaluate comparability, analyze claims, generate confidence assessments, and produce decision-support results.

The backend is built with **Node.js** and **Express**, with **PostgreSQL** used for persistent data storage. Local **Ollama** is used for AI-generated analysis and interpretation.

The backend acts as the central layer between the frontend, database, evidence-processing services, and AI analysis engine.

---

## Technology Stack

- **Node.js** — Backend runtime
- **Express.js** — REST API framework
- **PostgreSQL** — Database
- **Ollama** — Local AI analysis
- **pg** — PostgreSQL client for Node.js
- **dotenv** — Environment variable configuration

---

## Project Structure

```text
backend/
├── src/
│   ├── routes/
│   │   ├── comparisons.js
│   │   ├── evidence.js
│   │   └── ...
│   │
│   ├── services/
│   │   ├── evidenceGatheringService.js
│   │   ├── evidenceService.js
│   │   ├── comparabilityService.js
│   │   ├── analysisService.js
│   │   ├── claimsClassifierService.js
│   │   ├── confidenceScorecardService.js
│   │   ├── recommendationService.js
│   │   ├── ollamaService.js
│   │   ├── pdfExtractor.js
│   │   └── ...
│   │
│   ├── db/
│   │   └── ...
│   │
│   └── server.js
│
├── migrations/
├── seeds/
├── package.json
└── README.md

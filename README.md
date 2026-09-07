# Decision Support Tool

An evidence-based comparison and decision-support application that helps users compare multiple options, review supporting evidence, understand comparability and confidence, and make informed decisions.

The system separates source-reported evidence from AI-generated analysis so that users can understand what is supported by evidence and what is interpretation. The final decision always remains under the user's control.

---

## Current Status

### Stable Development Version

The current stable version includes the core comparison, evidence, analysis, confidence, recommendation, research-document, and decision workflows.

The project is maintained as a full-stack application consisting of:

- React + Vite + Tailwind CSS frontend
- Node.js + Express backend
- PostgreSQL database
- Local Ollama AI integration

The current stable version does **not** include the experimental live external web-search implementation.

---

## Features

### Natural-Language Comparisons

Users can enter comparison requests using natural language.

Examples:

```text
Compare Claude and ChatGPT
Compare MIT and Stanford
Compare microservices and monolith architecture

The natural-language parser identifies the comparison options, category, goal, and relevant criteria from the request.

Multiple Comparison Options

The system supports comparisons involving multiple options rather than being limited to a fixed two-option structure.

Evidence Management

The backend manages evidence associated with comparison criteria.

Evidence can include information such as:

Reported result
Source
Source date
Method
Conditions
Evidence status
Reliability information

Evidence is kept separate from AI-generated interpretation.

Evidence Status

Evidence can be classified using statuses such as:

Reliable
Needs Review
Outdated
Conflicting

These indicators help users understand potential issues with the available evidence.

Comparability Analysis

The system evaluates whether evidence from different options can reasonably be compared.

Comparability is classified as:

Comparable
Partly Comparable
Not Comparable

The system also provides an explanation of why evidence may or may not be comparable.

Factors can include:

Reporting periods
Methodology
Measurement conditions
Definitions
Data sources
Normalization

The results interface presents reported values together with their relevant unit or scale information.

Normalization is kept separate from comparability so that differences in representation are not incorrectly treated as differences in evidence quality.

Original reported values are preserved rather than silently replacing source values with unsupported conversions.

Confidence Scorecard

Recommendations include a qualitative confidence level:

High Confidence
Medium Confidence
Low Confidence

The confidence level can be expanded to show the factors that determined the rating.

The scorecard evaluates six factors:

Source Quality
Completeness
Recency
Sample Size
Methodology
Consistency Across Sources

The system does not use percentage confidence values or /10 scores.

Claims Classification

Analytical claims are evaluated against the available recorded evidence.

Claims can be identified as:

Grounded
Potentially Unverified

This helps distinguish evidence-supported statements from interpretations that may require additional verification.

AI-Assisted Analysis

The backend uses local Ollama for analysis and interpretation.

Ollama is used to synthesize and explain the available evidence.

It is not treated as the factual source of the comparison.

The application separates:

Source Evidence
      ↓
Recorded Facts
      ↓
AI-Generated Analysis
      ↓
Recommendation
      ↓
User Decision
Research Document Comparison

The application supports research-document comparison workflows.

Users can upload research papers or reports for analysis.

The backend can extract relevant sections from submitted documents, including:

Methodology
Dataset and Sample Size
Results and Evaluation
Limitations

The comparison can then be grounded in the contents of the submitted documents.

Recommendations

The system produces a recommendation based on the available evidence, comparability results, confidence assessment, and analysis.

The recommendation is presented separately from the user's final decision.

User-Controlled Decisions

Users remain responsible for the final decision.

The application allows the user's final decision to differ from the system recommendation when the user has their own preference or reason.

This distinction is represented as:

System Recommendation
        ↓
User Review
        ↓
User's Final Decision
Contamination-Risk Handling

The system can identify and display contamination-risk information where applicable.

This helps users understand when evidence or evaluation conditions may affect the reliability of a comparison.

Application Pages

The frontend currently contains the following main pages:

Home — Entry point for starting a comparison
About — Project and team information
Start Comparison — Creates a comparison
My Comparisons — Displays saved comparisons
Research — Research-document comparison workflow
Results — Displays comparison evidence and comparability information
Analysis — Displays source evidence separately from AI-generated analysis
Recommendation — Displays the recommended option and confidence scorecard
Decision — Records the user's final decision
Architecture
                         User
                           │
                           ▼
                    React Frontend
                           │
                           │ REST API
                           ▼
                   Node.js + Express
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        Comparison      Evidence      Analysis
         Services       Services      Services
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                      PostgreSQL
                           │
                           ▼
                         Ollama
Important Architecture Rule

The frontend communicates with the backend only.

Frontend → Backend → PostgreSQL
                  → Ollama

The frontend does not communicate directly with:

PostgreSQL
Ollama

Ollama access is restricted to the backend service layer.

Project Structure
decision-support-tool/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── db/
│   │   └── server.js
│   ├── migrations/
│   ├── seeds/
│   ├── package.json
│   └── README.md
│
└── README.md
Prerequisites

Before running the application, install and configure the following.

1. Node.js

Install Node.js 18 or later.

Verify:

node --version
npm --version
2. PostgreSQL

Install PostgreSQL and make sure the PostgreSQL server is running.

The application uses PostgreSQL for storing:

Comparisons
Comparison items
Evidence
Comparability checks
Analyses
Recommendations
User decisions

Create the project database if it does not already exist:

decision_support
3. Ollama

Install Ollama if AI-generated analysis is required.

Ollama should be running locally.

The backend communicates with Ollama through its configured local host.

The configured model must also be available.

Installation

Clone the repository:

git clone https://github.com/Jeeventika/Benchmarking_Tool.git

Enter the project:

cd Benchmarking_Tool
Backend Setup

Enter the backend directory:

cd backend

Install dependencies:

npm install

Create/configure the backend environment file:

backend/.env

The environment configuration should provide the backend port, PostgreSQL connection details, and Ollama configuration.

Example:

PORT=4000

DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/decision_support

OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3

Use your own PostgreSQL username and password.

Do not commit credentials or .env files to Git.

Database Migration

From the backend directory:

npm run migrate

This creates/updates the required database tables.

Seed Demonstration Data

The project contains demonstration data for testing the existing workflows.

Run:

npm run seed

This populates the database with the available demo comparison data.

Start the Backend

From:

backend/

run:

npm run dev

The backend normally runs at:

http://localhost:4000
Frontend Setup

Open another terminal.

Enter the frontend directory:

cd frontend

Install dependencies:

npm install

Start the frontend:

npm run dev

The frontend normally runs at:

http://localhost:5173

Open the displayed local Vite URL in a browser.

Running the Complete Application

Both the backend and frontend should be running.

Terminal 1 — Backend
cd backend
npm install
npm run migrate
npm run seed
npm run dev
Terminal 2 — Frontend
cd frontend
npm install
npm run dev

Then open:

http://localhost:5173
Ollama Configuration

Ollama is used only by the backend for AI-generated analysis.

Typical configuration:

OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3

Make sure the selected model is installed and Ollama is running before using AI analysis.

The frontend must never call Ollama directly.

Security and Logging

The application includes logging safeguards for the release-gate requirements:

FR-02
FR-04
FR-09
FR-11

Raw sensitive information must not be written to ordinary or error logs.

This includes:

Raw model responses
User-submitted documents
Extracted evidence
Generated claims
API credentials
Other sensitive submitted content

The Ollama service logs safe operational metadata such as request failure status without exposing the raw prompt or model response.

A synthetic logging verification script is available at:

backend/src/services/test-ollama-logging.js

Run it with:

cd backend
node src/services/test-ollama-logging.js
Evidence and AI Transparency

A key principle of the application is transparency between evidence and interpretation.

The system distinguishes between:

Source Evidence

Information obtained from the available evidence or submitted research documents.

AI Analysis

Interpretation generated using the available evidence.

AI-generated analysis should not be presented as source-reported fact.

This allows users to review the evidence before relying on the system's interpretation or recommendation.

Current Evidence Retrieval

The current stable version uses the existing evidence-gathering implementation and demonstration evidence.

The experimental general live external-search implementation was intentionally removed before the stable version was restored.

Therefore, the current version does not claim to perform unrestricted live web research for arbitrary comparisons.

Users should not interpret the existing demonstration evidence as live external research.

Future live-source functionality should only be introduced when sources can be reliably retrieved, verified, and presented with traceable citations.

Testing Checklist

Before considering a development change complete, verify:

 Frontend starts successfully
 Backend starts successfully
 PostgreSQL connection works
 Database migrations complete successfully
 Seed data loads successfully
 Existing comparisons can be opened
 Evidence is displayed correctly
 Evidence status is displayed correctly
 Comparability results are displayed
 Normalization information is displayed correctly
 Confidence is High, Medium, or Low
 Confidence click-through displays the six factors
 No percentage or /10 confidence score is displayed
 Claims classification works
 AI analysis works through Ollama
 Recommendations are displayed
 User decisions remain separate from system recommendations
 Contamination-risk information is preserved where applicable
 Sensitive information is not exposed in logs
Development Guidelines

When modifying the project:

Preserve the frontend/backend separation.
Keep PostgreSQL access on the backend.
Keep Ollama access on the backend.
Keep source evidence separate from AI-generated analysis.
Do not fabricate evidence, sources, citations, or values.
Preserve comparability checks.
Preserve the six-factor confidence scorecard.
Preserve High/Medium/Low confidence levels.
Do not introduce percentage or /10 confidence scores.
Preserve claims classification.
Do not log raw sensitive content.
Preserve existing demonstration workflows unless intentionally changing them.
Clearly distinguish demonstration data from real external research.
Test existing functionality after making changes.
Stable Git Version

The current stable baseline is:

Commit: ecab9f3

Commit message:

fix(security): sanitize raw model and evidence logging across FR-02, FR-04, FR-09, FR-11 release gate

Subsequent approved changes may be committed on top of this baseline.

Team

Jeeventika R. • Kanishma • Sruthi • Mobisha

The team developed the Decision Support Tool with a focus on:

Evidence
Transparency
Comparability
Confidence
User-controlled decisions
License

This project is developed as an team project.


### One important correction

I would **definitely replace the old README**, rather than just adding sections to it. The old version currently says:

> `Status: Phase 1 — Scaffold`

and:

> `No business logic ... is implemented yet`

Those statements are completely wrong for your current project and could make a reviewer think you haven't implemented anything.

Also, I intentionally **didn't say that the system performs live web search**, because you reverted that implementation. That's important for keeping the README truthful.
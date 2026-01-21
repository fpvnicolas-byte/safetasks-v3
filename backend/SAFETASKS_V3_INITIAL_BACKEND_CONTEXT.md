# SAFE TASKS V3 — PROJECT CONTEXT & ARCHITECTURAL BLUEPRINT

## 1. PROJECT OVERVIEW
**Safe Tasks V3** is a complete backend rewrite of a SaaS platform for Audiovisual Production Management.
**Goal:** Achieve high development speed and long-term maintainability.
**Philosophy:** Merge the rigorous financial/administrative control of **Sistema Jobb** with the creative/logistical automation of **Yamdu**.
**Infrastructure Strategy:** "Backend-as-a-Service" Hybrid. We use **Supabase** for Auth, Database hosting, and Storage, but maintain complex business logic in **FastAPI**.

---

## 2. BUSINESS LOGIC & INSPIRATION (THE DUAL CORE)

### A. The Administrative Core (Reference: Sistema Jobb)
*Focus: Financial health, legal compliance, and rigid organizational structures.*
* **Commercial & Budgeting:** Advanced Budgeting, Auto-Calculations (Taxes, BV), Version Control.
* **Financial Management:** AP/AR, Cash Flow, NF-e integration, ANCINE reporting.
* **Asset Management:** Inventory tracking and maintenance status.

### B. The Production Core (Reference: Yamdu)
*Focus: Creative workflow, scheduling, and logistics.*
* **Script & Breakdown:** Ingestion and AI Tagging (Cast, Props).
* **Scheduling & Logistics:** Stripboard interface, DOOD (Day Out of Days), Conflict Detection.
* **Team Management:** Casting database and Travel logistics.

### C. The Intersection (Operations)
* **Call Sheets:** Automated generation from Schedule + Crew List.
* **Projects:** The central entity linking Financial Budget to Creative Schedule.

---

## 3. TECHNICAL ARCHITECTURE

### Principles
* **Modular Monolith:** Single deployment unit, strictly separated internal modules.
* **Vertical Slicing:** Features built as complete slices (API -> Logic -> DB).
* **Domain-Driven Design (DDD):** Code organization by business domain.
* **Multi-tenancy:** Strict data isolation per client (Company/Tenant).

### Tech Stack (Supabase Hybrid)
* **Language:** Python 3.12+
* **Framework:** FastAPI (Async support).
* **Infrastructure (PaaS):** **Supabase**.
    * **Database:** PostgreSQL (hosted by Supabase).
    * **Auth:** Supabase Auth (GoTrue). Frontend handles login; Backend verifies JWTs using the JWT Secret.
    * **Storage:** Supabase Storage (for scripts, invoices, receipts).
* **ORM:** SQLAlchemy (Async) — used for complex relational queries and business logic transactions.
* **Client:** `supabase-py` — used for interacting with Storage and specific Admin Auth tasks.

---

## 4. DOMAIN STRUCTURE

### `core/`
* Shared kernel, **Supabase Client**, Security (JWT Verification), tenancy logic.

### `modules/commercial/` (Jobb-heavy)
* **Entities:** `Budget`, `Proposal`, `Client`, `TaxTable`.

### `modules/production/` (Yamdu-heavy)
* **Entities:** `Script`, `Scene`, `Character`, `BreakdownItem`.

### `modules/scheduling/` (Yamdu-heavy)
* **Entities:** `ShootingDay`, `CallSheet`, `Event`.

### `modules/financial/` (Jobb-heavy)
* **Entities:** `Transaction`, `Invoice`, `BankAccount`.

### `modules/inventory/`
* **Entities:** `Equipment`, `Kit`, `MaintenanceLog`.

---

## 5. DEVELOPMENT GUIDELINES

* **Role:** Act as a Senior Fullstack Developer / Tech Lead.
* **Tone:** Direct, technical, solution-oriented.
* **Auth Flow:** The Frontend sends a Bearer Token (JWT). FastAPI validates this token against the `SUPABASE_JWT_SECRET` locally (fastest) or via Supabase User endpoint (safest for ban checks).
* **Data Integrity:** Use Pydantic for validation and SQLAlchemy for relational consistency.
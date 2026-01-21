# STEP 01: Project Scaffolding & Supabase Dependencies

**Context:** Reference the file `SAFETASKS_V3_INITIAL_BACKEND_CONTEXT.md` located in the root directory.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Initialize the project structure and dependencies integrating FastAPI with Supabase.

**Instructions:**

1. **Dependencies:** Create a `requirements.txt` file containing the latest stable versions of:
    * `fastapi`, `uvicorn[standard]`
    * `supabase` (Official Python Client)
    * `sqlalchemy`, `alembic`, `asyncpg` (For robust database modeling)
    * `pydantic`, `pydantic-settings`
    * `python-multipart`
    * `openai` (For future AI script breakdown integration)

2. **Directory Structure:** Create the following folder structure strictly based on the Context definitions:
    * `app/` (Root package)
    * `app/core/` (Settings, Database config, Supabase Client, Security)
    * `app/modules/` (Domain modules)
    * `app/modules/commercial/`
    * `app/modules/production/`
    * `app/modules/scheduling/`
    * `app/modules/financial/`
    * `app/modules/inventory/`

3. **Module Boilerplate:** Inside *each* module folder (e.g., `app/modules/commercial/`), create the following empty files to reserve the architecture slots:
    * `__init__.py`
    * `models.py` (Database entities)
    * `schemas.py` (Pydantic DTOs)
    * `services.py` (Business Logic)
    * `router.py` (API Endpoints)

**Output:** Provide the shell/bash commands to create this structure and the content of `requirements.txt`.

---

# STEP 02: Configuration Layer (Supabase Keys)

**Context:** Reference `SAFETASKS_V3_INITIAL_BACKEND_CONTEXT.md`.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Implement the configuration management for Supabase credentials.

**Instructions:**

1. **Settings Class:** Create `app/core/config.py` using `BaseSettings`.
2. **Variables:** Include the following environment variables with type hints:
    * `PROJECT_NAME`: str
    * `API_V1_STR`: str (Default: "/api/v1")
    * `SUPABASE_URL`: str
    * `SUPABASE_KEY`: str (The `service_role` key is preferred for backend operations).
    * `SUPABASE_JWT_SECRET`: str (Essential for validating user tokens locally).
    * `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_SERVER`, `POSTGRES_PORT`, `POSTGRES_DB` (Supabase provides these in Project Settings > Database).
    * `OPENAI_API_KEY`: str (For Step 08).
    * `FISCAL_PROVIDER_API_KEY`: str (For Step 10).
3. **SQLAlchemy URI:** Create a property `SQLALCHEMY_DATABASE_URI` that constructs the async postgres connection string (`postgresql+asyncpg://...`).
4. **Environment File:** Create a `.env.example` file in the root directory reflecting these variables.

**Output:** The code for `app/core/config.py` and `.env.example`.

---

# STEP 03: Hybrid Database & Client Setup

**Context:** Reference `SAFETASKS_V3_INITIAL_BACKEND_CONTEXT.md` and `app/core/config.py`.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Configure both the SQLAlchemy Async Engine and the Supabase Client.

**Instructions:**

1. **SQLAlchemy Setup:** In `app/core/database.py`:
    * Import settings.
    * Create `AsyncEngine` and `AsyncSession` factory pointing to the Supabase PostgreSQL URL.
    * Create a `get_db` dependency to yield the session.
2. **Supabase Client:** In `app/core/supabase.py` (new file):
    * Create a function `get_supabase_client()` that returns an initialized `Client` using `SUPABASE_URL` and `SUPABASE_KEY`.
3. **Base Model:** In `app/core/base.py`:
    * Create the declarative `Base` class for SQLAlchemy models.

**Rationale:** We use SQLAlchemy for complex relational business logic and the Supabase Client for Storage buckets and simple interactions.

**Output:** Code for `app/core/database.py`, `app/core/supabase.py`, and `app/core/base.py`.

---

# STEP 04: Main Entry Point & Health Check

**Context:** Reference existing project structure.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Create the application entry point to verify the infrastructure.

**Instructions:**

1. **Main App:** Create `app/main.py`.
    * Initialize `FastAPI` with the title from `Settings`.
    * Configure CORS (Cross-Origin Resource Sharing) allowing all origins (`*`) for development purposes.
2. **Health Check:** Add a simple GET route `/health` that returns `{"status": "ok", "version": "3.0"}`.
3. **Router Placeholder:** Include a comment indicating where the API Routers will be mounted later.

**Output:** The code for `app/main.py` and the command to run the server using `uvicorn`.

---

# STEP 05: Authentication & Authorization Foundation

**Context:** Reference `SAFETASKS_V3_INITIAL_BACKEND_CONTEXT.md` and existing core setup.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Implement JWT validation and user context management for Supabase Auth integration.

**Instructions:**

1. **JWT Validation:** Create `app/core/security.py`:
    * Function to decode and validate Supabase JWT tokens using `SUPABASE_JWT_SECRET`
    * Extract user information from decoded token (user_id, email, role)
    * Handle token expiration and invalid token errors

2. **Auth Dependencies:** Create `app/core/auth.py`:
    * `get_current_user` dependency that validates JWT from Authorization header
    * `get_current_active_user` dependency that ensures user is active
    * User context object with tenant/organization information

3. **User Model:** In `app/core/models.py`:
    * Basic User model for internal user management
    * Relationship to organizations/tenants for multi-tenancy

**Output:** Code for `app/core/security.py`, `app/core/auth.py`, and `app/core/models.py`.

---

# STEP 06: Base Schemas & CRUD Operations

**Context:** Reference existing module structure and DDD principles.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Create base schemas and CRUD operations that all modules can inherit from.

**Instructions:**

1. **Base Schemas:** In `app/core/schemas.py`:
    * `BaseSchema` with common fields (id, created_at, updated_at)
    * `CreateSchema` and `UpdateSchema` mixins
    * Pagination schemas for list endpoints

2. **CRUD Service:** In `app/core/crud.py`:
    * Generic CRUD operations using SQLAlchemy
    * Base service class with create, read, update, delete methods
    * Filtering and pagination support

3. **Router Base:** In `app/core/router.py`:
    * Base router class with common CRUD endpoints
    * Dependency injection for services
    * Error handling and response formatting

**Output:** Code for `app/core/schemas.py`, `app/core/crud.py`, and `app/core/router.py`.

---

# STEP 07: Commercial Module - Budget & Client Management

**Context:** Jobb-inspired financial control and client relationships.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Implement the commercial domain with advanced budgeting and client management.

**Instructions:**

1. **Models:** In `app/modules/commercial/models.py`:
    * `Client` (companies, contacts, payment terms)
    * `Budget` (versioned budgets, auto-calculations, tax integration)
    * `Proposal` (quotes, approvals, versioning)

2. **Schemas:** In `app/modules/commercial/schemas.py`:
    * Pydantic models for all CRUD operations
    * Budget calculation schemas with tax/BV auto-computation

3. **Services:** In `app/modules/commercial/services.py`:
    * Budget calculation logic (taxes, profit margins)
    * Version control for budget changes
    * Client relationship management

4. **Router:** In `app/modules/commercial/router.py`:
    * CRUD endpoints for clients, budgets, proposals
    * Budget calculation endpoints
    * Version history endpoints

**Output:** Complete commercial module implementation.

---

# STEP 08: Production Module - Script & Scene Management (Gemini AI Integrated)

**Context:** Reference `SAFETASKS_V3_INITIAL_BACKEND_CONTEXT.md` and existing project structure.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Implement script ingestion and AI-driven breakdown using **Google Gemini**.

**Instructions:**

1. **Dependencies:**
    * Install `google-generativeai` (The official Python SDK for Gemini).
    * Update `requirements.txt`.

2. **Configuration:**
    * Update `app/core/config.py` to include `GOOGLE_API_KEY` (str).
    * Update `.env.example` to include `GOOGLE_API_KEY`.

3. **Models:** In `app/modules/production/models.py`:
    * `Script` (id, title, content_text, file_url, processed (bool), created_at).
    * `Scene` (id, script_id, scene_number, heading, description, time_of_day, location).
    * `BreakdownItem` (id, scene_id, category, name).
    * Define relationships (Script -> Scenes -> BreakdownItems).

4. **AI Adapter (Gemini):** In `app/modules/production/ai_adapter.py`:
    * Import `google.generativeai as genai`.
    * Configure using `settings.GOOGLE_API_KEY`.
    * Implement `analyze_script_text(text: str)`:
        * Model: Use `"gemini-1.5-flash"` (Fast and supports large context windows for scripts).
        * Config: Set `generation_config={"response_mime_type": "application/json"}` to force structured JSON output.
        * Prompt: "Analyze this script. Return a JSON object with a list of 'scenes'. Each scene must have: 'number', 'heading', 'description', 'time', 'location', and a list of 'breakdown_items' (category, name)."

5. **Services:** In `app/modules/production/services.py`:
    * `ScriptService`: Save uploaded file content.
    * `BreakdownService`: Call `ai_adapter` and save the structured data into `Scene` and `BreakdownItem` tables in a transaction.

6. **Router:** In `app/modules/production/router.py`:
    * `POST /scripts/upload`: Endpoint to accept a file, read text, save Script, and trigger the breakdown.

**Output:** Code for the updated `config.py`, `ai_adapter.py` (Gemini version), `models.py`, `services.py`, and `router.py`.

---

# STEP 09: Scheduling Module - Stripboard & Call Sheets

**Context:** Yamdu-inspired scheduling and logistics.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Implement shooting schedule management and automated call sheet generation.

**Instructions:**

1. **Models:** In `app/modules/scheduling/models.py`:
    * `ShootingDay` (dates, locations, weather)
    * `Event` (time slots, scenes, crew assignments)
    * `CallSheet` (automated generation, distribution)

2. **Schemas:** In `app/modules/scheduling/schemas.py`:
    * Schedule creation and modification
    * Call sheet generation parameters
    * Conflict detection schemas

3. **Services:** In `app/modules/scheduling/services.py`:
    * Stripboard interface logic
    * Conflict detection algorithms
    * Automated call sheet generation from schedule + crew

4. **Router:** In `app/modules/scheduling/router.py`:
    * Schedule CRUD endpoints
    * Call sheet generation and distribution
    * Conflict resolution endpoints

**Output:** Complete scheduling module implementation.

---

# STEP 10: Financial Module - Fiscal Gateway (NF-e)

**Context:** Jobb-inspired financial management with robust fiscal integration.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Implement financial transactions and a Facade for NF-e emission.

**Instructions:**

1. **Models:** In `app/modules/financial/models.py`:
    * `Transaction` (incomes, expenses, categories, budget_link)
    * `Invoice` (internal representation of the NF-e: status, external_id, pdf_url)
    * `BankAccount` (reconciliation, balances)

2. **Fiscal Gateway:** In `app/modules/financial/fiscal_gateway.py`:
    * Implement a **Facade Pattern** class `FiscalProviderInterface`.
    * **Constraint:** Do NOT implement raw XML signing or direct SEFAZ communication.
    * Create a placeholder implementation designed to connect with SaaS providers (e.g., e-Notas, FocusNFE, PlugNotas).
    * Methods: `emit_invoice()`, `cancel_invoice()`, `get_invoice_status()`.

3. **Services:** In `app/modules/financial/services.py`:
    * Cash flow calculations.
    * `InvoiceService`: Orchestrates the call to `FiscalProviderInterface` and updates the local `Invoice` model status.

4. **Router:** In `app/modules/financial/router.py`:
    * Transaction CRUD.
    * Invoice management (Trigger emission, Sync status).

**Output:** Complete financial module with Fiscal Gateway pattern.

---

# STEP 11: Inventory Module - Equipment & Asset Tracking

**Context:** Equipment management and maintenance tracking.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Implement equipment inventory and maintenance management.

**Instructions:**

1. **Models:** In `app/modules/inventory/models.py`:
    * `Equipment` (cameras, lights, sound gear)
    * `Kit` (pre-configured equipment sets)
    * `MaintenanceLog` (repairs, inspections, status)

2. **Schemas:** In `app/modules/inventory/schemas.py`:
    * Equipment registration and tracking
    * Maintenance scheduling schemas
    * Kit assembly schemas

3. **Services:** In `app/modules/inventory/services.py`:
    * Equipment availability checking
    * Maintenance scheduling and alerts
    * Kit optimization algorithms

4. **Router:** In `app/modules/inventory/router.py`:
    * Equipment CRUD endpoints
    * Maintenance tracking
    * Kit management endpoints

**Output:** Complete inventory module implementation.

---

# STEP 12: API Integration & Testing

**Context:** All modules implemented, ready for integration.

**Role:** Act as a Senior Python Backend Developer.

**Task:** Mount all routers, add comprehensive testing, and prepare for deployment.

**Instructions:**

1. **Main App Integration:** Update `app/main.py`:
    * Mount all module routers under `/api/v1/`
    * Add global error handlers
    * Configure API documentation

2. **Testing Setup:** Create comprehensive test suite:
    * Unit tests for services
    * Integration tests for API endpoints
    * Database fixtures and mocking

3. **Deployment Preparation:**
    * Docker configuration
    * Environment validation
    * Health checks and monitoring

**Output:** Complete API integration and deployment-ready codebase.
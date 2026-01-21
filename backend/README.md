# Safe Tasks V3 - Audiovisual Production Management Platform

A comprehensive SaaS platform for audiovisual production management built with FastAPI, SQLAlchemy, and Supabase. Features AI-powered script breakdown, fiscal compliance (NF-e), equipment tracking, and production scheduling.

## 🚀 Features

### Core Modules

#### 🏢 **Commercial Module**
- Client management with payment terms and credit limits
- Advanced budgeting with auto-calculations and version control
- Proposal management with approval workflows
- Financial planning and tax integration

#### 🎬 **Production Module**
- AI-powered script upload and breakdown using Google Gemini
- Scene management with metadata and production notes
- Breakdown item extraction (cast, props, equipment, locations)
- Automated production element identification

#### 📅 **Scheduling Module**
- Shooting day management with weather integration
- Stripboard interface for production planning
- Conflict detection and resolution algorithms
- Automated call sheet generation and distribution

#### 💰 **Financial Module**
- Brazilian fiscal compliance with NF-e emission
- Transaction management with automatic reconciliation
- Bank account integration and cash flow tracking
- Fiscal gateway abstraction for multiple providers

#### 🛠️ **Inventory Module**
- Equipment lifecycle management with depreciation tracking
- Kit assembly and optimization algorithms
- Maintenance scheduling and completion workflows
- Usage analytics and reporting

## 🏗️ Architecture

### Tech Stack
- **Backend**: FastAPI (Python 3.12+) with async/await support
- **Database**: PostgreSQL via SQLAlchemy 2.0 (async)
- **Authentication**: Supabase Auth with JWT validation
- **Storage**: Supabase Storage for files and documents
- **AI**: Google Gemini 1.5 Flash for script analysis
- **Fiscal**: NF-e integration with provider abstraction
- **Deployment**: Docker with docker-compose

### Project Structure
```
safetasks-v3/
├── app/
│   ├── core/              # Shared utilities and configuration
│   ├── modules/           # Domain modules
│   │   ├── commercial/    # Client & budget management
│   │   ├── production/    # AI script breakdown
│   │   ├── scheduling/    # Production planning
│   │   ├── financial/     # Fiscal & transactions
│   │   └── inventory/     # Equipment tracking
│   └── main.py           # FastAPI application
├── tests/                # Test suite
├── Dockerfile           # Container configuration
├── docker-compose.yml   # Multi-service setup
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## 🚀 Quick Start

### Prerequisites
- Docker and docker-compose
- Supabase project with database and storage
- Google Gemini API key
- Fiscal provider API key (optional)

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/safetasks-v3.git
   cd safetasks-v3
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - API: http://localhost:8000
   - Documentation: http://localhost:8000/docs
   - Health check: http://localhost:8000/health

### Local Development

1. **Create virtual environment**
   ```bash
   python -m venv venv312
   source venv312/bin/activate  # Linux/Mac
   # or
   venv312\Scripts\activate     # Windows
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run database migrations**
   ```bash
   # Tables are created automatically on startup
   # Or run manually with Alembic if needed
   ```

4. **Start the development server**
   ```bash
   uvicorn app.main:app --reload
   ```

## 🧪 Testing

### Run Test Suite
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test module
pytest tests/test_inventory.py

# Run async tests
pytest -m "asyncio"
```

### Test Structure
- **Unit tests**: Individual function/component testing
- **Integration tests**: API endpoint testing
- **Database tests**: SQLAlchemy model validation
- **Async tests**: Concurrent operation testing

## 📊 API Documentation

### Authentication
All API endpoints require JWT authentication via Supabase Auth. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Key Endpoints

#### Commercial
- `POST /api/v1/commercial/clients` - Create client
- `GET /api/v1/commercial/budgets` - List budgets
- `POST /api/v1/commercial/proposals` - Create proposal

#### Production
- `POST /api/v1/production/scripts/upload` - Upload script
- `POST /api/v1/production/scripts/{id}/process` - AI breakdown
- `GET /api/v1/production/scripts/{id}/breakdown` - Get breakdown

#### Scheduling
- `POST /api/v1/scheduling/shooting-days` - Create shooting day
- `POST /api/v1/scheduling/conflicts/detect` - Detect conflicts
- `POST /api/v1/scheduling/call-sheets/generate` - Generate call sheet

#### Financial
- `POST /api/v1/financial/transactions` - Create transaction
- `POST /api/v1/financial/invoices/emit` - Emit NF-e
- `GET /api/v1/financial/cash-flow` - Cash flow analysis

#### Inventory
- `POST /api/v1/inventory/equipment` - Register equipment
- `POST /api/v1/inventory/equipment/{id}/assign` - Assign equipment
- `POST /api/v1/inventory/maintenance` - Schedule maintenance

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase service role key | Yes |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation | Yes |
| `POSTGRES_*` | PostgreSQL connection details | Yes |
| `GOOGLE_API_KEY` | Google Gemini API key | Yes |
| `FISCAL_PROVIDER_API_KEY` | Fiscal provider API key | No |

### Database Schema
The application uses SQLAlchemy with Alembic for migrations. Tables are automatically created on startup.

### External Integrations

#### Google Gemini
Used for AI-powered script breakdown. Requires API key from Google AI Studio.

#### Fiscal Providers
Supports multiple NF-e providers:
- e-Notas (recommended)
- FocusNFE
- PlugNotas

#### Supabase
Provides authentication, database, and file storage.

## 🚀 Deployment

### Production Deployment

1. **Build and deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Environment variables**
   - Set production database URLs
   - Configure external API keys
   - Set secure JWT secrets

3. **Monitoring**
   - Health checks: `/health`
   - Logs: Docker logging
   - Metrics: Application metrics endpoints

### Scaling Considerations

- **Database**: PostgreSQL with connection pooling
- **API**: Multiple uvicorn workers
- **File Storage**: Supabase Storage with CDN
- **AI Processing**: Async task queues for heavy processing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Development Guidelines

- **Code Style**: Black, isort, flake8
- **Testing**: Minimum 80% coverage
- **Documentation**: OpenAPI/Swagger docs
- **Async**: Use async/await throughout
- **Type Hints**: Full type annotation coverage

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- 📧 Email: support@safetasks.com
- 📖 Documentation: https://docs.safetasks.com
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions

## 🙏 Acknowledgments

- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Python SQL toolkit
- **Supabase** - Open source Firebase alternative
- **Google Gemini** - AI for script analysis
- **Brazilian Government** - NF-e specification

---

**Safe Tasks V3** - Revolutionizing audiovisual production management with AI and cloud-native architecture.
# SafeTasks V3 - Film Production Management Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made with TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-blue.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-1.0-green.svg)](https://fastapi.tiangolo.com/)

🎬 **Complete, production-ready film production management platform** built with modern technologies. Manage projects, finances, equipment, and teams all in one place.

## ✨ Features

### 🏗️ **Core Production Management**
- **Projects** - Complete project lifecycle management
- **Scenes** - Scene tracking and organization
- **Characters** - Character database and management
- **Call Sheets** - Production scheduling and coordination

### 💰 **Financial Management**
- **Clients** - Client relationship management
- **Bank Accounts** - Multi-account banking integration
- **Transactions** - Income/expense tracking with auto-balance
- **Invoices** - Professional invoice generation and tracking
- **Tax Tables** - Brazilian tax compliance (ISS, IRRF, PIS, COFINS, CSLL, INSS)

### 📅 **Production Scheduling**
- **Shooting Days** - Production day planning and scheduling
- **Suppliers** - Vendor and supplier management
- **Proposals** - Client proposals with approval workflow

### 🛠️ **Inventory & Equipment**
- **Kit Items** - Equipment tracking and maintenance
- **Kits** - Equipment kit builder and organization
- **Maintenance Logs** - Equipment health tracking

### 📁 **File Management**
- **Upload/Download** - Multi-tenant file storage
- **Google Drive Integration** - Cloud storage sync
- **File Persistence** - Files persist across sessions

### 👥 **Team & Collaboration**
- **Stakeholders** - Project team member management
- **Notifications** - Real-time alert system
- **Settings** - Organization and user profile management

### 🤖 **AI Features**
- **Script Analysis** - AI-powered script breakdown
- **Production Suggestions** - Smart recommendations
- **Gemini API Integration** - Advanced AI capabilities

### 📊 **Business Intelligence**
- **Dashboard Analytics** - Executive business metrics
- **Financial Reports** - Comprehensive reporting
- **Production Analytics** - Performance insights

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.12+
- PostgreSQL database
- Supabase account (for hosting)

### Installation

#### Backend Setup
```bash
# Clone the repository
git clone https://github.com/your-org/safetasks-v3.git
cd safetasks-v3/backend

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database and API keys

# Run database migrations
alembic upgrade head

# Start the backend server
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup
```bash
# In a new terminal
cd safetasks-v3/frontend

# Install Node.js dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your API URLs

# Start the frontend development server
npm run dev
```

### Environment Configuration

#### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/safetasks

# Authentication
SECRET_KEY=your-secret-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

# AI Integration
GEMINI_API_KEY=your-gemini-api-key

# Storage
SUPABASE_STORAGE_URL=https://your-project.supabase.co/storage/v1
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## 🏗️ Architecture

### Tech Stack

**Backend:**
- 🐍 **Python 3.12** - Modern Python with type hints
- ⚡ **FastAPI** - High-performance web framework
- 🗄️ **SQLAlchemy** - ORM with Alembic migrations
- 🔐 **Supabase Auth** - Authentication and authorization
- 📊 **PostgreSQL** - Primary database
- ☁️ **Supabase Storage** - File storage
- 🤖 **Gemini API** - AI integration

**Frontend:**
- ⚛️ **React 18** - Modern UI library
- 📱 **Next.js 15** - Full-stack React framework
- 🎨 **Tailwind CSS** - Utility-first CSS framework
- 🧩 **shadcn/ui** - Beautiful component library
- 🔄 **React Query** - Data fetching and state management
- 📘 **TypeScript** - Type-safe development
- 🎯 **Vite** - Fast build tool

### Architecture Patterns

- **Service Layer Pattern** - Clean separation of concerns
- **Multi-tenancy** - Organization-based data isolation
- **JWT Authentication** - Secure API access
- **RESTful API Design** - Standard HTTP methods
- **Type Safety** - Full TypeScript coverage
- **Component Composition** - Reusable UI components

## 📖 API Documentation

The API is automatically documented with OpenAPI/Swagger. Once the backend is running:

1. Visit `http://localhost:8000/docs` for interactive API documentation
2. Visit `http://localhost:8000/redoc` for ReDoc documentation

### Authentication

All API endpoints require authentication via JWT tokens:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/v1/projects/
```

### Multi-tenancy

All requests are automatically scoped to your organization. No need to specify organization IDs in most requests.

## 🎨 Screenshots

> **Note:** Add actual screenshots of your application here

## 📊 Database Schema

The platform uses a comprehensive database schema with the following main entities:

- **Organizations** - Multi-tenant isolation
- **Users** - User management and authentication
- **Projects** - Production projects
- **Scenes** - Scene management
- **Characters** - Character database
- **Call Sheets** - Production scheduling
- **Clients** - Client relationships
- **Bank Accounts** - Financial accounts
- **Transactions** - Income/expense tracking
- **Invoices** - Billing and invoicing
- **Suppliers** - Vendor management
- **Proposals** - Client proposals
- **Kit Items** - Equipment inventory
- **Kits** - Equipment organization
- **Stakeholders** - Team members
- **Files** - File storage metadata

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

### E2E Tests
```bash
cd frontend
npm run e2e
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Vercel + Supabase (Recommended)
1. **Frontend:** Deploy to Vercel
2. **Backend:** Deploy to Railway or Render
3. **Database:** Use Supabase PostgreSQL
4. **Storage:** Use Supabase Storage

### Environment Variables for Production
- Set all `.env` variables in your hosting provider
- Use strong, unique secrets
- Configure CORS origins
- Set up SSL certificates

## 🔧 Development

### Code Style
- **Backend:** Follow PEP 8 with type hints
- **Frontend:** ESLint + Prettier configuration
- **Git:** Conventional commit messages

### Adding New Features
1. Create a new branch: `git checkout -b feature/your-feature`
2. Implement backend changes (models, services, endpoints)
3. Add frontend components and hooks
4. Write tests
5. Update documentation
6. Submit PR

### Database Migrations
```bash
# Create new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Add tests
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **FastAPI** - For the excellent web framework
- **Supabase** - For the amazing backend-as-a-service
- **Next.js** - For the powerful React framework
- **shadcn/ui** - For beautiful, accessible components
- **React Query** - For excellent data fetching
- **TypeScript** - For type safety and developer experience

## 📞 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/your-org/safetasks-v3/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/your-org/safetasks-v3/discussions)
- 📚 **Documentation:** [Wiki](https://github.com/your-org/safetasks-v3/wiki)
- 💬 **Community:** [Discord](https://discord.gg/your-invite-link)

## 🎯 Roadmap

### Phase 2 (Next 3 months)
- [ ] Mobile applications (iOS/Android)
- [ ] Advanced analytics and reporting
- [ ] Third-party integrations
- [ ] Workflow automation
- [ ] Multi-region deployment

### Phase 3 (6+ months)
- [ ] Enterprise features
- [ ] Advanced AI capabilities
- [ ] Real-time collaboration
- [ ] Custom reporting engine

---

**Made with ❤️ by the SafeTasks Team**

[![Twitter Follow](https://img.shields.io/twitter/follow/yourhandle?style=social)](https://twitter.com/yourhandle)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Company%20Page-blue)](https://linkedin.com/company/yourcompany)
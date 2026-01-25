# Vintage Poster Gallery - AI Research Application

An intelligent web application for [Authentic Vintage Posters](https://www.authenticvintageposters.com) that uses Claude AI to analyze and research vintage posters, providing detailed historical, technical, and valuation information.

## 🎯 Features

- **AI-Powered Analysis**: Upload poster images and receive comprehensive analysis including artist identification, historical context, printing techniques, rarity assessment, and market insights
- **Information Validation**: Provide existing information (from auctions, estates, etc.) and have Claude validate and enhance it
- **Team Collaboration**: Password-protected access for 2-5 team members
- **Cloud Storage**: Images stored on Vercel Blob Storage
- **Database**: PostgreSQL database for storing posters and analysis results
- **Export**: Generate PDF and JSON reports for customers or website integration

## 🏗️ Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Hosting**: Vercel (Free tier)
- **AI**: Anthropic Claude 3.5 Sonnet with Vision
- **Storage**: Vercel Blob Storage
- **Database**: Vercel Postgres (or Neon)
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS

## 📁 Project Status

### ✅ Completed

1. **Project Setup**
   - Next.js 14+ with TypeScript and Tailwind CSS
   - All required dependencies installed
   - Directory structure created
   - Git repository initialized

2. **Core Utilities**
   - [lib/claude.ts](lib/claude.ts) - Claude API integration with poster analysis prompts
   - [lib/db.ts](lib/db.ts) - Database utilities with full CRUD operations
   - [lib/blob.ts](lib/blob.ts) - Blob storage utilities for image uploads
   - [types/poster.ts](types/poster.ts) - TypeScript type definitions

3. **Database Schema**
   - [lib/init-db.sql](lib/init-db.sql) - SQL schema for posters table
   - Includes support for initial information validation

4. **Configuration**
   - [.env.example](.env.example) - Environment variables template

### 🚧 Remaining Implementation

The following components still need to be built:

1. **Authentication** (Phase 2)
   - NextAuth.js configuration
   - Login page
   - Protected route middleware

2. **API Routes** (Phase 3)
   - `/api/upload` - Handle image uploads
   - `/api/analyze` - Trigger AI analysis
   - `/api/posters` - CRUD operations
   - `/api/auth/[...nextauth]` - Authentication endpoints

3. **UI Components** (Phase 4)
   - Upload zone with drag-and-drop
   - Poster grid/gallery view
   - Poster detail page with analysis display
   - Inline editing components
   - Export functionality

4. **Pages** (Phase 5)
   - Dashboard (gallery view)
   - Upload page
   - Poster detail page
   - Settings page

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (installed at: C:\Program Files\nodejs)
- Anthropic API key
- Vercel account (for deployment and services)

### Local Development Setup

1. **Navigate to project directory**
   ```bash
   cd vintage-poster-gallery
   ```

2. **Create `.env.local` file**
   ```bash
   cp .env.example .env.local
   ```

3. **Configure environment variables** in `.env.local`:
   ```env
   ANTHROPIC_API_KEY=your-claude-api-key
   NEXTAUTH_SECRET=your-secret-here
   # Database and blob storage will be configured when deploying to Vercel
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

### Database Setup

When ready to set up the database:

1. Create a Vercel Postgres database (or Neon database)
2. Run the SQL schema from [lib/init-db.sql](lib/init-db.sql)
3. Add database connection strings to environment variables

### Deployment to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial setup"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables:
     - `ANTHROPIC_API_KEY`
     - `NEXTAUTH_SECRET`
     - Team credentials (TEAM_USER_1, TEAM_USER_2, etc.)

3. **Add Vercel Blob Storage**
   - In Vercel dashboard, go to Storage
   - Create a new Blob store
   - It will auto-configure `BLOB_READ_WRITE_TOKEN`

4. **Add Vercel Postgres**
   - In Vercel dashboard, go to Storage
   - Create a new Postgres database
   - It will auto-configure database connection strings
   - Run the init-db.sql schema in the SQL editor

## 📖 Key Files Explained

### [lib/claude.ts](lib/claude.ts)
- `analyzePoster(imageUrl, initialInfo?)` - Main function to analyze a poster image
- Sophisticated prompt engineering for art historical analysis
- Validation feature for cross-referencing provided information
- Returns structured JSON with identification, historical context, technical analysis, and value insights

### [lib/db.ts](lib/db.ts)
- `createPoster(input)` - Create new poster record
- `getPosterById(id)` - Retrieve poster by ID
- `getAllPosters(options)` - Get all posters with filtering
- `updatePosterAnalysis(id, analysis)` - Save AI analysis results
- `updatePosterFields(id, updates)` - Update user edits
- `searchPosters(query)` - Full-text search
- `getPosterStats()` - Get collection statistics

### [lib/blob.ts](lib/blob.ts)
- `uploadImage(file, fileName)` - Upload to Vercel Blob
- `deleteImage(url)` - Delete from Vercel Blob
- `validateImageFile(file)` - Validate file type and size
- `sanitizeFileName(name)` - Create safe filenames

### [types/poster.ts](types/poster.ts)
- TypeScript interfaces for type safety throughout the app
- Matches database schema structure
- Includes structured analysis types

## 🔐 Authentication

Team credentials are stored as environment variables using bcrypt hashed passwords.

To generate a hashed password:
```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

Then add to `.env.local`:
```env
TEAM_USER_1=john:$2a$10$hashedpassword
TEAM_USER_2=jane:$2a$10$hashedpassword
```

## 💰 Cost Estimates

With free Vercel tier and your existing Claude API key:

- **Hosting**: $0 (Vercel free tier)
- **Storage**: $0 for ~500-1000 images (Vercel Blob free tier: 500MB)
- **Database**: $0 for ~10,000+ records (Vercel Postgres free tier: 512MB)
- **AI Analysis**: ~$0.01-0.05 per poster (Claude API)

**Expected monthly cost**: <$5 for dozens of posters analyzed

## 🎨 Key Workflow

1. **Login** → Team member authenticates
2. **Dashboard** → View gallery of all uploaded posters
3. **Upload** → Drag-and-drop poster image + optionally provide any known information
4. **Analysis** → AI analyzes image and validates provided information (30-60 seconds)
5. **View/Edit** → Review AI analysis, make manual corrections, add notes
6. **Export** → Generate PDF or JSON report for customers

## 📝 Next Steps

To complete the application, you'll need to:

1. **Implement Authentication**
   - Set up NextAuth.js
   - Create login page
   - Add middleware for route protection

2. **Build API Routes**
   - Upload endpoint
   - Analysis endpoint
   - Poster CRUD endpoints

3. **Create UI Components**
   - Upload zone with drag-and-drop
   - Poster cards and grid
   - Analysis display panel
   - Image viewer

4. **Build Pages**
   - Dashboard/gallery
   - Upload page
   - Poster detail page with analysis

5. **Add Export Features**
   - PDF generation
   - JSON export

6. **Polish & Deploy**
   - Mobile responsive design
   - Error handling
   - Loading states
   - Production deployment

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [NextAuth.js](https://next-auth.js.org/)

## 🐛 Troubleshooting

### Node.js Path Issues
If you encounter "node: command not found" errors, add Node.js to your PATH:
```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

### Database Connection
Ensure your `.env.local` has the correct `POSTGRES_URL` connection string from Vercel.

### Blob Storage Access
Verify `BLOB_READ_WRITE_TOKEN` is set correctly in environment variables.

## 📄 License

Proprietary - Authentic Vintage Posters Gallery

---

**Built with Claude Code** 🤖

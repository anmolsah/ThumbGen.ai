<p align="center">
  <img src="client/src/assets/logo.png" alt="ThumbGen.ai Logo" width="300"/>
</p>

<h1 align="center">ThumbGen.ai</h1>

<p align="center">
  <strong>AI-Powered Thumbnail Generator for Content Creators</strong>
</p>

<p align="center">
  Generate stunning, click-worthy thumbnails in seconds using Google's Imagen 4.0 and Gemini AI.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Environment Variables</a> •
  <a href="#project-structure">Project Structur  <a href="#api-endpoints">API Endpoints</a>
</p>

---

## Features

- 🎨 **AI Image Generation** - Powered by Google Imagen 4.0 Ultra & Gemini
- 🖼️ **Reference Image Support** - Upload your photo to include in thumbnails (Creator/Pro)
- 🔗 **YouTube Style Reference** - Paste a YouTube URL to instantly copy its visual style and mood
- 🎯 **Multiple Styles** - Bold & Graphic, Tech/Futuristic, Minimalististic, Illustrated
- 🎨 **Color Schemes** - 8 curated palettes (Vibrant, Sunset, Neon, etc.)
- 📐 **Multi-Platform Ratios** - YouTube (16:9), Instagram/Facebook (4:5, 1:1), Stories/Reels (9:16)
- 💳 **Payment Integration** - Dodo Payments (Global USD transactions)
- 🍪 **Cookie Consent** - GDPR compliant cookie consent integration
- 🔐 **Email OTP Auth** - Secure authentication via Brevo
- ⚡ **Background Processing** - Redis + BullMQ job queue for non-blocking generation
- 🏷️ **Watermarking** - Automatic watermark for free plan users

## Tech Stack

### Frontend

- **React 19** + TypeScript
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- *Animations
- **React Router v7** - Routing
- **Axios** - HTTP client

### Backend

- **Express.js 5** + TypeSt
- **MongoDB** + Mongoose - Database
- **BullMQ** + Redis - Job queue
- **Sharp** - Image processing
- **Cloudinary** - Image storage

### External Services

- **Google AI** - Imagen 4.0 & Gemini
- **Upstash** - Redis hosting
- **Brevo** - Email OTP
- **Dodo Payments** - Global Payments

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB database
- Redis instance (local or [Upstash](https://upstash.com))
- Google Cloud account with Vertex AI enabled
- Cloudinary account
- Brevo account (for emails)
- Dodo Payments account (for payments)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/thumbgen-ai.git
   cd thumbgen-ai
   ```

2. **Install dependencies**

   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Set up environment variables**

   Create `server/.env` (see [Environment Variables](#environment-variables))

4. **Start development servers**

   ```bash
   # Terminal 1 - Backend
   cd server
   npm run server

   # Terminal 2 - Frontend
   cd client
   npm run dev
   ```

5. **Open the app**

   ```
   http://localhost:5173
   ```

## Environment Variables

Create a `server/.env` file:

```env
# Server
NODE_ENV="development"
PORT=3000
SESSION_SECRET="your-secret-key"

# MongoDB
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/thumbgen"

# Redis (Upstash)
REDIS_URL="rediss://default:your-password@your-endpoint.upstash.io:6379"

# Google AI (Imagen & Gemini)
GEMINI_API_KEY="your-google-ai-api-key"

# Cloudinary
CLOUDINARY_URL="cloudinary://api_key:api_secret@cloud_name"

# Brevo (Email)
BREVO_API_KEY="your-brevo-api-key"
BREVO_SENDER_EMAIL="noreply@yourdomain.com"

# Dodo Payments (Payments)
DODO_PAYMENTS_API_KEY="your-api-key"
DODO_PAYMENTS_WEBHOOK_SECRET="your-webhook-secret"
DODO_PRODUCT_STARTER="product-id-1"
DODO_PRODUCT_CREATOR="product-id-2"
DODO_PRODUCT_PRO="product-id-3"
CLIENT_URL="http://localhost:5173"
```

Create a `client/.env` file:

```env
VITE_API_URL="http://localhost:3000"
```

## Project Structure

```
thumbgen-ai/
├── client/                 # React frontend
│   ├── src/
│   │   ├── assets/         # Images, icons
│   │   ├── components/     # Reusable components
│   │   ├── configs/        # API config
│   │   ├── context/        # Auth context
│   │   ├── data/           # Static data
│   │   ├── pages/          # Page components
│   │   ├── sections/       # Landing page sections
│   │   └── types.ts        # TypeScript types
│   └── package.json
│
├── server/                 # Express backend
│   ├── configs/            # DB, Redis, AI, Cloudinary
│   ├── controllers/        # Route handlers
│   ├── middlewares/        # Auth middleware
│   ├── models/             # Mongoose schemas
│   ├── queues/             # BullMQ queue definitions
│   ├── routes/             # API routes
│   ├── workers/            # Background job processors
│   ├── assets/             # Watermark logo
│   ├── server.ts           # Entry point
│   └── package.json
│
└── README.md
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to email |
| POST | `/api/auth/verify-otp` | Verify OTP & create account |
| POST | `/api/auth/resend-otp` | Resend OTP |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/verify` | Verify session |

### Thumbnails

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/thumbnail/generate` | Generate new thumbnail |
| GET | `/api/thumbnail/status/:id` | Get generation status |
| DELETE | `/api/thumbnail/delete/:id` | Delete thumbnail |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/thumbnails` | Get user's thumbnails |
| GET | `/api/user/thumbnail/:id` | Get single thumbnail |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/activate-free` | Activate free plan |
| POST | `/api/payment/create-order` | Create payment order |
| POST | `/api/payment/verify` | Verify payment status |

## Pricing Plans

| Plan | Price | Credits | Features |
|------|-------|---------|----------|
| Free | $0 | 25 | 5 thumbnails, watermarked |
| Starter | $9 | 100 | 20 thumbnails, no watermark, global styles |
| Creator | $29 | 500 | 100 thumbnails, no watermark, reference images & URLs |
| Pro | $59 | 1500 | 300 thumbnails, no watermark, reference images & URLs, priority queue |

## Scripts

### Server

```bash
npm run server    # Development with hot reload
npm run start     # Production
npm run build     # Build TypeScript
```

### Client

```bash
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

## Deployment

### Vercel (Recommended)

Both client and server have `vercel.json` configured for easy deployment.

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Manual

1. Build the client: `cd client && npm run build`
2. Build the server: `cd server && npm run build`
3. Start the server: `node dist/server.js`

## License

MIT License - feel free to use this project for your own purposes.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/yourusername">Anmol</a>
</p>

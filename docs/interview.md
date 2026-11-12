# ThumbGen.ai - Interview Questions & Answers

## Project Overview Questions

### 1. Can you explain what ThumbGen.ai is and what problem it solves?

**Answer:**
ThumbGen.ai is an AI-powered YouTube thumbnail generator. The problem it solves is that creating eye-catching thumbnails is time-consuming and requires design skills. Many YouTubers spend hours on thumbnails or pay designers.

With ThumbGen, users just describe their video in text, and the AI generates professional thumbnails in seconds. It saves time and makes thumbnail creation accessible to everyone, even those without design experience.

---

### 2. What is the tech stack you used and why did you choose it?

**Answer:**
**Frontend:**

- React with TypeScript - For type safety and better developer experience
- Tailwind CSS - For rapid UI development
- Vite - Fast build tool and dev server

**Backend:**

- Node.js with Express - Familiar, fast, and great ecosystem
- TypeScript - Consistency with frontend and type safety
- MongoDB - Flexible schema for user data and thumbnails

**AI/Services:**

- Google Imagen - For image generation
- Google Gemini - For prompt enhancement
- Cloudinary - For image storage and optimization

**Infrastructure:**

- BullMQ + Redis - For background job processing
- Vercel - For deployment
- Cashfree - For payment processing

I chose this stack because it's modern, scalable, and I'm comfortable with it. TypeScript across both frontend and backend reduces bugs and improves maintainability.

---

## Authentication Questions

### 3. How does your authentication system work?

**Answer:**
I use session-based authentication with express-session and MongoDB as the session store.

**Flow:**

1. User registers with email, name, password
2. Server sends OTP to email using Brevo API
3. User verifies OTP
4. Server creates a session and stores `userId` and `isLoggedIn` in the session
5. Session ID is sent as an HTTP-only cookie
6. On subsequent requests, the cookie is sent automatically and server validates the session

**Why sessions over JWT?**

- Sessions can be invalidated server-side (logout works immediately)
- No token refresh logic needed
- Sensitive data stays on server, not in client storage

---

### 4. What challenges did you face with authentication in production?

**Answer:**
Cross-domain cookie issues! My frontend and backend are on different Vercel subdomains. Browsers block third-party cookies by default.

**Solutions I implemented:**

1. Set `sameSite: "none"` and `secure: true` for cookies in production
2. Added `credentials: true` in CORS config
3. Used `withCredentials: true` in Axios
4. Set `trust proxy: 1` for Vercel's proxy
5. Added `partitioned: true` for CHIPS (Cookies Having Independent Partitioned State)

The best long-term solution is using a custom domain where frontend and backend share the same root domain.

---

### 5. How do you protect your API routes?

**Answer:**
I have a middleware called `protect` that checks if the user is logged in:

```typescript
const protect = async (req, res, next) => {
  const { isLoggedIn, userId } = req.session;
  
  if (!isLoggedIn || !userId) {
    return res.status(401).json({ message: 'You are not logged in' });
  }
  
  next();
};
```

This middleware is applied to all routes that need authentication like `/api/payment/*`, `/api/thumbnail/*`, etc.

---

## Payment Integration Questions

### 6. Explain how you integrated Cashfree payments

**Answer:**
**Flow:**

1. User clicks "Buy Plan" on frontend
2. Frontend calls `/api/payment/create-order` with plan type
3. Backend creates order using Cashfree SDK and saves it to database with "pending" status
4. Backend returns `payment_session_id` to frontend
5. Frontend loads Cashfree SDK and opens checkout with that session ID
6. User completes payment on Cashfree's page
7. User is redirected to `/payment/status?order_id=xxx`
8. Frontend calls `/api/payment/verify` to check payment status
9. If successful, backend updates user's plan and credits

**Webhook:**
Cashfree also sends webhooks for payment events. This is a backup in case the redirect fails.

---

### 7. How do you handle failed or cancelled payments?

**Answer:**
When user cancels or payment fails:

1. They're redirected to payment status page with order_id
2. Frontend calls verify endpoint
3. Backend checks with Cashfree API - status will be "pending" or "failed"
4. If pending, frontend retries twice (3 seconds apart)
5. If still pending after ~6 seconds, we assume user cancelled
6. Show error toast and redirect to profile page

The payment record stays in database with "pending" status. We don't charge the user anything.

---

### 8. What's the difference between sandbox and production mode in Cashfree?

**Answer:**

- **Sandbox:** Test environment with fake money. Use test credentials and test card numbers. Good for development.
- **Production:** Real money, real transactions. Requires KYC verification and domain whitelisting.

Important: Frontend and backend must use the same mode! If backend creates order in production mode, frontend must load Cashfree SDK with `mode: "production"`.

I use environment variables to switch:

- Backend: `NODE_ENV === "production"` → `CFEnvironment.PRODUCTION`
- Frontend: `import.meta.env.PROD` → `mode: "production"`

---

## Background Jobs Questions

### 9. Why did you use BullMQ for thumbnail generation?

**Answer:**
Thumbnail generation takes 30-60 seconds. If I did this in the API request:

- User waits too long
- Request might timeout
- Server can't handle multiple requests

With BullMQ:

1. API receives request, adds job to queue, returns immediately
2. Worker picks up job in background
3. Worker generates thumbnail, uploads to Cloudinary
4. Updates database with result
5. Frontend polls for status

**Benefits:**

- Fast API response
- Can process multiple thumbnails in parallel
- If worker crashes, job can be retried
- Can scale workers independently

---

### 10. How does the thumbnail generation flow work?

**Answer:**

1. User submits form with title, description, style
2. API creates thumbnail record with status "processing"
3. API adds job to BullMQ queue
4. Returns thumbnail ID to frontend

**Worker process:**
5. Worker picks up job
6. Calls Gemini API to enhance the prompt
7. Calls Imagen API to generate image
8. Uploads image to Cloudinary
9. Updates thumbnail record with image URL and status "completed"

**Frontend:**
10. Polls `/api/user/thumbnail/:id` every 5 seconds
11. When status is "completed", shows the image

---

### 11. How do you handle job failures?

**Answer:**
BullMQ has built-in retry mechanism:

```typescript
await thumbnailQueue.add('generate', jobData, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000
  }
});
```

If job fails:

- Retries up to 3 times
- Waits 5s, then 10s, then 20s between retries
- If all retries fail, job moves to "failed" state
- I update thumbnail status to "failed" in database
- Frontend shows error message to user

---

## Database Questions

### 12. Explain your MongoDB schema design

**Answer:**
**User Schema:**

```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  plan: String (none/free/creator/pro),
  credits: Number,
  totalCredits: Number
}
```

**Thumbnail Schema:**

```javascript
{
  userId: ObjectId (ref: User),
  title: String,
  description: String,
  style: String,
  imageUrl: String,
  status: String (processing/completed/failed),
  createdAt: Date
}
```

**Payment Schema:**

```javascript
{
  userId: ObjectId (ref: User),
  orderId: String (unique),
  paymentSessionId: String,
  plan: String,
  amount: Number,
  status: String (pending/paid/failed),
  cfPaymentId: String
}
```

I use references (userId) instead of embedding because:

- Users can have many thumbnails
- Thumbnails can be queried independently
- Easier to update user data without touching thumbnails

---

### 13. How do you handle the credits system?

**Answer:**
Each plan has a credit allocation:

- Free: 25 credits
- Creator: 200 credits
- Pro: 800 credits

Each thumbnail generation costs 5 credits.

**Flow:**

1. Before generation, check if user has enough credits
2. After successful generation, deduct credits:

```javascript
await User.findByIdAndUpdate(userId, {
  $inc: { credits: -5 }
});
```

1. When user upgrades plan, reset credits to plan's total

**Why credits instead of thumbnail count?**
Flexibility for future features like different quality levels costing different credits.

---

## API Design Questions

### 14. How did you structure your API routes?

**Answer:**
I organized routes by feature:

```
/api/auth
  POST /send-otp      - Send registration OTP
  POST /verify-otp    - Verify OTP and register
  POST /login         - Login user
  POST /logout        - Logout user
  GET  /verify        - Check if user is logged in

/api/payment
  POST /create-order  - Create Cashfree order
  POST /verify        - Verify payment status
  POST /activate-free - Activate free plan
  POST /webhook       - Cashfree webhook

/api/thumbnail
  POST /generate      - Start thumbnail generation
  
/api/user
  GET /thumbnail/:id  - Get single thumbnail
  GET /thumbnails     - Get user's thumbnails
```

Each route group has its own router file and controller file. This keeps code organized and easy to maintain.

---

### 15. How do you handle errors in your API?

**Answer:**
I use try-catch in all controllers:

```typescript
export const createOrder = async (req, res) => {
  try {
    // ... logic
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ 
      message: error.message,
      code: error?.response?.data?.code 
    });
  }
};
```

**Error types I handle:**

- 400: Bad request (missing fields, invalid data)
- 401: Not authenticated
- 404: Resource not found
- 500: Server error

Frontend shows appropriate toast messages based on error response.

---

## Frontend Questions

### 16. How do you manage state in your React app?

**Answer:**
I use React Context for global state (authentication):

```typescript
const AuthContext = createContext({
  user: null,
  isLoggedIn: false,
  login: async () => {},
  logout: async () => {},
  // ...
});
```

**Why Context over Redux?**

- App is not that complex
- Only need to share auth state globally
- Less boilerplate
- Built into React

For local state (form inputs, loading states), I use `useState`.

---

### 17. How do you handle API calls in the frontend?

**Answer:**
I created an Axios instance with base configuration:

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  withCredentials: true  // Important for cookies
});
```

Then use it everywhere:

```typescript
const { data } = await api.post("/api/auth/login", { email, password });
```

**Benefits:**

- Base URL configured once
- Credentials included automatically
- Can add interceptors for error handling
- Easy to mock for testing

---

### 18. How does the thumbnail polling work?

**Answer:**
After submitting generation request:

```typescript
useEffect(() => {
  if (id && loading) {
    const interval = setInterval(() => {
      fetchThumbnail();
    }, 5000);
    
    return () => clearInterval(interval);
  }
}, [id, loading]);
```

1. Set up interval that runs every 5 seconds
2. Fetch thumbnail status from API
3. If status is "completed" or "failed", stop polling
4. Cleanup interval when component unmounts

**Why polling over WebSockets?**

- Simpler to implement
- Works well for this use case (30-60 second wait)
- No need to maintain persistent connections
- Easier to deploy on serverless (Vercel)

---

## Security Questions

### 19. How do you secure user passwords?

**Answer:**
I use bcrypt for password hashing:

```typescript
// Registration
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

// Login
const isMatch = await bcrypt.compare(password, user.password);
```

**Why bcrypt?**

- Automatically handles salting
- Configurable work factor (10 rounds)
- Slow by design - prevents brute force attacks
- Industry standard

I never store plain text passwords. Even I can't see user passwords.

---

### 20. What security measures did you implement?

**Answer:**

1. **Password hashing** - bcrypt with salt
2. **HTTP-only cookies** - Prevents XSS from stealing session
3. **CORS configuration** - Only allow requests from my frontend
4. **Input validation** - Check required fields before processing
5. **Session-based auth** - Can invalidate sessions server-side
6. **Environment variables** - API keys not in code
7. **Secure cookies in production** - `secure: true`, `sameSite: "none"`

**What I'd add for production:**

- Rate limiting
- CSRF tokens
- Input sanitization
- Helmet.js for security headers

---

## Deployment Questions

### 21. How did you deploy this application?

**Answer:**
Both frontend and backend are deployed on Vercel.

**Frontend:**

- Vite builds static files
- Vercel serves them from CDN
- Environment variable: `VITE_BASE_URL` points to backend

**Backend:**

- Uses `@vercel/node` runtime
- Serverless functions
- Environment variables for all secrets (DB, API keys, etc.)

**Challenges:**

- Serverless has cold starts
- BullMQ worker needs always-on server (using separate service or same process)
- Cross-domain cookie issues (discussed earlier)

---

### 22. What would you do differently for a larger scale?

**Answer:**

1. **Separate worker service** - Run BullMQ workers on dedicated servers (Railway, Render)

2. **CDN for images** - Cloudinary already does this, but could add more caching

3. **Database optimization** - Add indexes, consider read replicas

4. **Rate limiting** - Prevent abuse with Redis-based rate limiter

5. **Monitoring** - Add Sentry for errors, analytics for usage

6. **Load balancing** - Multiple backend instances

7. **Caching** - Redis cache for frequently accessed data

8. **Queue scaling** - Multiple workers, priority queues

---

## General Questions

### 23. What was the most challenging part of this project?

**Answer:**
Cross-domain authentication in production. Locally everything worked fine, but on Vercel:

- Cookies weren't being sent
- Sessions weren't persisting
- Users kept getting logged out

I spent hours debugging. The solution involved:

- Correct CORS configuration
- Cookie settings (sameSite, secure, partitioned)
- Trust proxy setting
- Ensuring frontend sends credentials

This taught me a lot about how cookies and CORS work in production environments.

---

### 24. What would you improve if you had more time?

**Answer:**

1. **Image editing** - Let users customize generated thumbnails
2. **Templates** - Pre-made thumbnail templates
3. **A/B testing** - Generate multiple versions, track which performs better
4. **Team features** - Multiple users per account
5. **API access** - Let developers integrate via API
6. **Better error handling** - More specific error messages
7. **Testing** - Unit tests, integration tests
8. **PWA** - Offline support, installable app

---

### 25. How do you handle environment variables?

**Answer:**
**Backend (.env):**

```
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=random-string
CASHFREE_APP_ID=xxx
CASHFREE_SECRET_KEY=xxx
BREVO_API_KEY=xxx
CLOUDINARY_URL=xxx
CLIENT_URL=https://frontend.vercel.app
NODE_ENV=production
```

**Frontend (.env):**

```
VITE_BASE_URL=https://backend.vercel.app
```

**Rules I follow:**

- Never commit .env files (in .gitignore)
- Use different values for dev/prod
- Vite requires `VITE_` prefix for frontend env vars
- Set production values in Vercel dashboard

---

## Behavioral Questions

### 26. Why did you build this project?

**Answer:**
I wanted to build a complete full-stack SaaS application that solves a real problem. YouTube thumbnails are important for video success, but creating them is tedious.

I also wanted to:

- Learn payment integration
- Work with AI APIs
- Implement background job processing
- Deploy a production-ready application

This project covers authentication, payments, file uploads, background jobs, and third-party API integration - all common requirements in real-world applications.

---

### 27. How did you approach building this project?

**Answer:**

1. **Planning** - Listed features, designed database schema, sketched UI
2. **Backend first** - Set up Express, MongoDB, basic routes
3. **Authentication** - Implemented register/login with sessions
4. **Core feature** - Thumbnail generation with AI
5. **Background jobs** - Added BullMQ for async processing
6. **Payments** - Integrated Cashfree
7. **Frontend** - Built React UI, connected to API
8. **Testing** - Manual testing, fixed bugs
9. **Deployment** - Deployed to Vercel, fixed production issues

I used Git throughout, committing after each feature was working.

---

### 28. What did you learn from this project?

**Answer:**

1. **Production is different** - Things that work locally can break in production (cookies, CORS)

2. **Read the docs** - SDK documentation saved me hours of debugging

3. **Error handling matters** - Good error messages help debugging

4. **Background jobs are essential** - For any long-running task

5. **Security is complex** - Many layers to consider

6. **Third-party APIs** - Each has its quirks, rate limits, and pricing

7. **User experience** - Loading states, error messages, and feedback are important

This project made me a better full-stack developer by exposing me to real-world challenges.

// api/index.js - Vercel serverless entry point
// Exports the Express app from src/index.js. On Vercel the app does NOT call
// app.listen (guarded by !process.env.VERCEL in src/index.js).
import app from '../src/index.js';

export default app;
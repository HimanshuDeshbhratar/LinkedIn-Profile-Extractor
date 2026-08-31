import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import profileRoutes from './routes/profile.routes.js';
import { apiKeyAuth, errorHandler, notFoundHandler } from './middleware/index.js';
import { connectDatabase } from './db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        const error = new Error('Origin is not allowed by CORS');
        error.statusCode = 403;
        callback(error);
      }
    },
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 30 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' },
    },
  })
);

// app.get('/', (_req, res) => {
//   res.json({
//     name: 'LinkedIn Profile API',
//     description: 'Reverse-engineered LinkedIn Voyager API wrapper',
//     docs: '/api/docs',
//     health: '/api/health',
//     usage: '/api/profile?url=https://www.linkedin.com/in/username',
//   });
// });



app.use('/api', apiKeyAuth, profileRoutes);

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});


app.use(notFoundHandler);
app.use(errorHandler);

await connectDatabase();

app.listen(PORT, () => {
  console.log(`[server] LinkedIn Profile API running on http://localhost:${PORT}`);
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

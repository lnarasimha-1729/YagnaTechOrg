// src/index.js
'use strict';

import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';

import rateLimiter from './middlewares/rateLimiter.js';
import routes from './routes/index.js';
import { bastionAllowedOrigins } from './utils/cors.js';

dotenv.config();

const app = express();

// Behind Nginx/ALB on EC2 — needed for correct client IP in rate limiter and logs.
app.set('trust proxy', 1);

app.use(helmet());

// Middlewares
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, bastionAllowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Skip JSON parsing for multipart bodies — those requests need to stream
// untouched to the upstream service (e.g. assessment-service file uploads).
// Otherwise express.json() reads the raw body and 413s on the file payload
// before the proxy ever sees the request.
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) return next();
  return express.json({ limit: '10mb' })(req, res, next);
});
app.use(morgan('combined'));
app.use(rateLimiter);

// Health check for ALB / Nginx / uptime probes — must respond before auth/proxy.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api', routes);

app.use('/', (req,res) => {
  res.send('Welcome to Bastion Server');
});


export default app;
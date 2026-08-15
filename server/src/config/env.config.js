const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Zod validation schema for backend environment variables
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  APP_NAME: z.string().default('Smart Auditorium Booking & Management System'),
  API_PREFIX: z.string().default('/api'),
  API_VERSION: z.string().default('v1'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'debug'])
    .default('debug'),

  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // JWT Placeholders
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // SMTP Email Placeholders
  SMTP_HOST: z.string().default('smtp.mailtrap.io'),
  SMTP_PORT: z.coerce.number().int().positive().default(2525),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Cloudinary Placeholders
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Security Configuration
  COOKIE_SECRET: z
    .string()
    .default('sabms-enterprise-secure-cookie-secret-key-2026'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  PAYLOAD_SIZE_LIMIT: z.string().default('10mb'),
});

/**
 * Validate process.env against Zod schema
 */
const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      '\n❌ [CRITICAL] Environment Configuration Validation Failed:'
    );
    const formattedErrors = result.error.format();

    Object.entries(formattedErrors).forEach(([key, value]) => {
      if (key !== '_errors' && value._errors?.length) {
        console.error(`   - ${key}: ${value._errors.join(', ')}`);
      }
    });

    console.error('\nStopping application server execution.\n');
    process.exit(1);
  }

  return result.data;
};

const parsedEnv = parseEnv();

const isTestEnv =
  parsedEnv.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

/**
 * Centralized, immutable configuration object
 */
const config = Object.freeze({
  env: isTestEnv ? 'test' : parsedEnv.NODE_ENV,
  isDevelopment: parsedEnv.NODE_ENV === 'development' && !isTestEnv,
  isTest: isTestEnv,
  isProduction: parsedEnv.NODE_ENV === 'production' && !isTestEnv,
  port: parsedEnv.PORT,
  appName: parsedEnv.APP_NAME,
  apiPrefix: parsedEnv.API_PREFIX,
  apiVersion: parsedEnv.API_VERSION,
  apiBaseUrl: `${parsedEnv.API_PREFIX}/${parsedEnv.API_VERSION}`,
  clientUrl: parsedEnv.CLIENT_URL,
  logLevel: parsedEnv.LOG_LEVEL,
  db: Object.freeze({
    uri: parsedEnv.MONGODB_URI,
  }),
  jwt: Object.freeze({
    secret: parsedEnv.JWT_SECRET,
    expiresIn: parsedEnv.JWT_EXPIRES_IN,
    refreshSecret: parsedEnv.JWT_REFRESH_SECRET,
    refreshExpiresIn: parsedEnv.JWT_REFRESH_EXPIRES_IN,
  }),
  smtp: Object.freeze({
    host: parsedEnv.SMTP_HOST,
    port: parsedEnv.SMTP_PORT,
    user: parsedEnv.SMTP_USER,
    pass: parsedEnv.SMTP_PASS,
  }),
  cloudinary: Object.freeze({
    cloudName: parsedEnv.CLOUDINARY_CLOUD_NAME,
    apiKey: parsedEnv.CLOUDINARY_API_KEY,
    apiSecret: parsedEnv.CLOUDINARY_API_SECRET,
  }),
  cookieSecret: parsedEnv.COOKIE_SECRET,
  rateLimit: Object.freeze({
    windowMs: parsedEnv.RATE_LIMIT_WINDOW_MS,
    max: parsedEnv.RATE_LIMIT_MAX_REQUESTS,
  }),
  payloadSizeLimit: parsedEnv.PAYLOAD_SIZE_LIMIT,
});

module.exports = config;

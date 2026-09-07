const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Zod validation schema for backend environment variables
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    APP_NAME: z
      .string()
      .default('Smart Auditorium Booking & Management System'),
    API_PREFIX: z.string().default('/api'),
    API_VERSION: z.string().default('v1'),
    CLIENT_URL: z.string().default('http://localhost:3000'),
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'http', 'debug'])
      .default('debug'),

    // Database
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    // JWT Configuration (Sprint 2.8)
    JWT_SECRET: z
      .string()
      .min(16, 'JWT_SECRET must be at least 16 characters long')
      .optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters long')
      .optional(),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_ISSUER: z.string().default('sabms-backend'),
    JWT_AUDIENCE: z.string().default('sabms-client'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_COOKIE_NAME: z.string().default('refreshToken'),
    JWT_REFRESH_COOKIE_PATH: z.string().default('/api/v1/auth'),
    JWT_REFRESH_COOKIE_SAME_SITE: z
      .enum(['strict', 'lax', 'none'])
      .default('strict'),

    // SMTP Email Placeholders
    SMTP_HOST: z.string().default('smtp.mailtrap.io'),
    SMTP_PORT: z.coerce.number().int().positive().default(2525),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('SABMS Support <noreply@sabms.edu>'),

    // Redis Ephemeral Store
    REDIS_URL: z.string().default('redis://localhost:6379'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // OTP Cryptographic Configuration
    OTP_HASH_SECRET: z
      .string()
      .min(16, 'OTP_HASH_SECRET must be at least 16 characters long')
      .default('sabms-enterprise-otp-hmac-secret-2026'),

    // SMS Provider Configuration
    SMS_PROVIDER: z.string().default('console'),
    SMS_API_KEY: z.string().optional(),
    SMS_API_SECRET: z.string().optional(),
    SMS_FROM: z.string().default('SABMS'),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_PHONE_NUMBER: z.string().optional(),
    TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

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
  })
  .refine((data) => Boolean(data.JWT_ACCESS_SECRET || data.JWT_SECRET), {
    message:
      'JWT_ACCESS_SECRET or JWT_SECRET must be provided and be at least 16 characters long',
    path: ['JWT_ACCESS_SECRET'],
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
  redis: Object.freeze({
    url: parsedEnv.REDIS_URL,
    host: parsedEnv.REDIS_HOST,
    port: parsedEnv.REDIS_PORT,
    password: parsedEnv.REDIS_PASSWORD,
  }),
  jwt: Object.freeze({
    secret: parsedEnv.JWT_ACCESS_SECRET || parsedEnv.JWT_SECRET,
    accessSecret: parsedEnv.JWT_ACCESS_SECRET || parsedEnv.JWT_SECRET,
    expiresIn:
      parsedEnv.JWT_ACCESS_EXPIRES_IN || parsedEnv.JWT_EXPIRES_IN || '15m',
    accessExpiresIn:
      parsedEnv.JWT_ACCESS_EXPIRES_IN || parsedEnv.JWT_EXPIRES_IN || '15m',
    issuer: parsedEnv.JWT_ISSUER,
    audience: parsedEnv.JWT_AUDIENCE,
    refreshSecret: parsedEnv.JWT_REFRESH_SECRET,
    refreshExpiresIn: parsedEnv.JWT_REFRESH_EXPIRES_IN,
    refreshCookieName: parsedEnv.JWT_REFRESH_COOKIE_NAME,
    refreshCookiePath: parsedEnv.JWT_REFRESH_COOKIE_PATH,
    refreshCookieSameSite: parsedEnv.JWT_REFRESH_COOKIE_SAME_SITE,
  }),
  smtp: Object.freeze({
    host: parsedEnv.SMTP_HOST,
    port: parsedEnv.SMTP_PORT,
    user: parsedEnv.SMTP_USER,
    pass: parsedEnv.SMTP_PASS,
    from: parsedEnv.SMTP_FROM,
  }),
  otp: Object.freeze({
    secret: parsedEnv.OTP_HASH_SECRET,
  }),
  sms: Object.freeze({
    provider: parsedEnv.SMS_PROVIDER,
    apiKey: parsedEnv.SMS_API_KEY,
    apiSecret: parsedEnv.SMS_API_SECRET,
    from: parsedEnv.SMS_FROM,
    twilioAccountSid: parsedEnv.TWILIO_ACCOUNT_SID,
    twilioAuthToken: parsedEnv.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: parsedEnv.TWILIO_PHONE_NUMBER,
    twilioMessagingServiceSid: parsedEnv.TWILIO_MESSAGING_SERVICE_SID,
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

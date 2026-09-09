'use strict';

const mongoose = require('mongoose');
const {
  REFRESH_TOKEN_STATUSES,
  REFRESH_TOKEN_STATUS_VALUES,
} = require('./auth.constants');

/**
 * Refresh Token Persistence Schema (Sprint 2.10).
 *
 * Tracks single-use refresh token lifecycle, token family lineage,
 * cryptographic identifiers (jti), and consumption/revocation timestamps.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: [true, 'Token identifier (jti) is required'],
      trim: true,
    },
    familyId: {
      type: String,
      required: [true, 'Family identifier (familyId) is required'],
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    status: {
      type: String,
      enum: {
        values: REFRESH_TOKEN_STATUS_VALUES,
        message: '{VALUE} is not a valid refresh token status',
      },
      default: REFRESH_TOKEN_STATUSES.ACTIVE,
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
    },
    replacedByTokenId: {
      type: String,
      default: null,
    },
    reuseDetectedAt: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
    deviceHash: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'refresh_tokens',
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Explicit Database Indexes (Single source of truth)
refreshTokenSchema.index({ jti: 1 }, { unique: true });
refreshTokenSchema.index({ familyId: 1 });
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ status: 1 });
refreshTokenSchema.index({ familyId: 1, status: 1 });
refreshTokenSchema.index({ userId: 1, status: 1 });
refreshTokenSchema.index({ userId: 1, status: 1, expiresAt: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;

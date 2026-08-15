'use strict';

const mongoose = require('mongoose');
const {
  USER_ROLE_VALUES,
  DEFAULT_USER_ROLE,
  ACCOUNT_STATUS_VALUES,
  DEFAULT_ACCOUNT_STATUS,
} = require('../../shared/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLE_VALUES,
        message: '{VALUE} is not a valid role',
      },
      default: DEFAULT_USER_ROLE,
      required: true,
    },
    department: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ACCOUNT_STATUS_VALUES,
        message: '{VALUE} is not a valid account status',
      },
      default: DEFAULT_ACCOUNT_STATUS,
      required: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'users',
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Explicit Database Indexes (Single source of truth)
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;

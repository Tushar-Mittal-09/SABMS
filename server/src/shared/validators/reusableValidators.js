'use strict';

const { z } = require('zod');
const { USER_ROLE_VALUES, ACCOUNT_STATUS_VALUES } = require('../constants');

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_REGEX =
  /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

const objectId = (fieldName = 'ID') =>
  z
    .string({ required_error: `${fieldName} is required` })
    .trim()
    .regex(
      OBJECT_ID_REGEX,
      `${fieldName} must be a valid 24-character hex string`
    );

const uuid = (fieldName = 'UUID') =>
  z
    .string({ required_error: `${fieldName} is required` })
    .trim()
    .regex(UUID_REGEX, `${fieldName} must be a valid UUID`);

const email = (options = {}) => {
  const {
    required = true,
    message = 'Must be a valid email address',
    fieldName = 'Email',
  } = options;
  const str = required
    ? z
        .string({ required_error: `${fieldName} is required` })
        .min(1, `${fieldName} is required`)
    : z.string();

  const base = str
    .trim()
    .toLowerCase()
    .refine(
      (val) =>
        required ? EMAIL_REGEX.test(val) : !val || EMAIL_REGEX.test(val),
      {
        message,
      }
    );

  return required ? base : base.optional();
};

const password = (options = {}) => {
  const {
    required = true,
    minLength = 8,
    maxLength = 128,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = true,
    fieldName = 'Password',
  } = options;

  let schema = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  schema = schema
    .min(minLength, `${fieldName} must be at least ${minLength} characters`)
    .max(maxLength, `${fieldName} cannot exceed ${maxLength} characters`);

  if (requireUppercase) {
    schema = schema.refine((val) => !val || /[A-Z]/.test(val), {
      message: `${fieldName} must contain at least one uppercase letter (A-Z)`,
    });
  }

  if (requireLowercase) {
    schema = schema.refine((val) => !val || /[a-z]/.test(val), {
      message: `${fieldName} must contain at least one lowercase letter (a-z)`,
    });
  }

  if (requireNumber) {
    schema = schema.refine((val) => !val || /\d/.test(val), {
      message: `${fieldName} must contain at least one number (0-9)`,
    });
  }

  if (requireSpecial) {
    schema = schema.refine((val) => !val || /[@$!%*?&#^~_-]/.test(val), {
      message: `${fieldName} must contain at least one special character (@$!%*?&#^~_-)`,
    });
  }

  return required ? schema : schema.optional();
};

const phone = (options = {}) => {
  const { required = true, fieldName = 'Phone number' } = options;
  const str = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  const base = str.trim().refine((val) => !val || PHONE_REGEX.test(val), {
    message: `${fieldName} must be a valid E.164 phone number (e.g., +1234567890)`,
  });

  return required ? base : base.optional();
};

const nameField = (options = {}) => {
  const {
    required = true,
    minLength = 2,
    maxLength = 100,
    fieldName = 'Name',
  } = options;

  const str = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  const base = str
    .trim()
    .min(minLength, `${fieldName} must be at least ${minLength} characters`)
    .max(maxLength, `${fieldName} must not exceed ${maxLength} characters`);

  return required ? base : base.optional();
};

const departmentField = (options = {}) => {
  const {
    required = false,
    maxLength = 100,
    fieldName = 'Department',
  } = options;

  const str = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  const base = str
    .trim()
    .max(maxLength, `${fieldName} must not exceed ${maxLength} characters`);

  return required ? base : base.optional();
};

const positiveInt = (options = {}) => {
  const { required = true, fieldName = 'Value', min = 1 } = options;
  const base = required
    ? z.number({
        required_error: `${fieldName} is required`,
        invalid_type_error: `${fieldName} must be a number`,
      })
    : z.number().optional();

  return base
    .int(`${fieldName} must be an integer`)
    .min(min, `${fieldName} must be at least ${min}`);
};

const nonNegativeInt = (options = {}) => {
  const { required = true, fieldName = 'Value' } = options;
  const base = required
    ? z.number({
        required_error: `${fieldName} is required`,
        invalid_type_error: `${fieldName} must be a number`,
      })
    : z.number().optional();

  return base
    .int(`${fieldName} must be an integer`)
    .min(0, `${fieldName} must be non-negative`);
};

const pagination = (options = {}) => {
  const { defaultLimit = 10, maxLimit = 100 } = options;

  return z.object({
    page: z.coerce
      .number()
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(1),
    limit: z.coerce
      .number()
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(maxLimit, `Limit must not exceed ${maxLimit}`)
      .default(defaultLimit),
  });
};

const sortDirection = z.enum(['asc', 'desc', 'ASC', 'DESC', '1', '-1'], {
  required_error: 'Sort direction is required',
});

const dateString = (options = {}) => {
  const { required = true, fieldName = 'Date' } = options;
  const str = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  const base = str.trim().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: `${fieldName} must be a valid date`,
  });

  return required ? base : base.optional();
};

const isoDateString = (options = {}) => {
  const { required = true, fieldName = 'Date' } = options;
  const str = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  const base = str
    .trim()
    .regex(ISO_DATE_REGEX, `${fieldName} must be in YYYY-MM-DD format`);

  return required ? base : base.optional();
};

const timeString24h = (options = {}) => {
  const { required = true, fieldName = 'Time' } = options;
  const str = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  const base = str
    .trim()
    .regex(TIME_24H_REGEX, `${fieldName} must be in HH:MM 24-hour format`);

  return required ? base : base.optional();
};

const url = (options = {}) => {
  const { required = true, fieldName = 'URL' } = options;
  const str = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  const base = str.trim().refine((val) => !val || URL_REGEX.test(val), {
    message: `${fieldName} must be a valid URL`,
  });

  return required ? base : base.optional();
};

const enumValue = (enumObj, options = {}) => {
  const { required = true, fieldName = 'Value' } = options;
  const values = Object.values(enumObj);
  const str = required
    ? z.string({ required_error: `${fieldName} is required` })
    : z.string();

  const base = str.refine((val) => !val || values.includes(val), {
    message: `${fieldName} must be one of: ${values.join(', ')}`,
  });

  return required ? base : base.optional();
};

const booleanString = (options = {}) => {
  const {
    required = false,
    fieldName = 'Value',
    default: defaultValue,
  } = options;
  const base = required
    ? z.enum(['true', 'false', '1', '0'], {
        required_error: `${fieldName} is required`,
      })
    : z.enum(['true', 'false', '1', '0']).optional();

  let schema = base.transform((val) => val === 'true' || val === '1');

  if (defaultValue !== undefined) {
    schema = schema.default(String(defaultValue));
  }

  return schema;
};

const dateRange = (options = {}) => {
  const { required = false, fieldName = 'Date range' } = options;

  return z
    .object({
      startDate: dateString({ required, fieldName: `${fieldName} start date` }),
      endDate: dateString({ required, fieldName: `${fieldName} end date` }),
    })
    .refine(
      (data) => {
        if (!data.startDate || !data.endDate) return true;
        return new Date(data.startDate) <= new Date(data.endDate);
      },
      {
        message: `${fieldName}: start date must be before or equal to end date`,
        path: ['endDate'],
      }
    );
};

const idParam = (paramName = 'id') =>
  z.object({
    [paramName]: objectId(`${paramName} parameter`),
  });

const searchQuery = (options = {}) => {
  const { maxLength = 200, fieldName = 'Search query' } = options;
  return z
    .string()
    .trim()
    .max(maxLength, `${fieldName} must not exceed ${maxLength} characters`)
    .optional();
};

const statusEnum = (allowedStatuses, options = {}) => {
  const { fieldName = 'Status', required = false } = options;
  const values = Array.isArray(allowedStatuses)
    ? allowedStatuses
    : Object.values(allowedStatuses);

  const base = required
    ? z.enum(values, { required_error: `${fieldName} is required` })
    : z.enum(values).optional();

  return base;
};

const userRole = (options = {}) => {
  const { required = true, fieldName = 'Role' } = options;
  return required
    ? z.enum(USER_ROLE_VALUES, { required_error: `${fieldName} is required` })
    : z.enum(USER_ROLE_VALUES).optional();
};

const accountStatus = (options = {}) => {
  const { required = true, fieldName = 'Account status' } = options;
  return required
    ? z.enum(ACCOUNT_STATUS_VALUES, {
        required_error: `${fieldName} is required`,
      })
    : z.enum(ACCOUNT_STATUS_VALUES).optional();
};

module.exports = {
  objectId,
  uuid,
  email,
  password,
  phone,
  nameField,
  departmentField,
  positiveInt,
  nonNegativeInt,
  pagination,
  sortDirection,
  dateString,
  isoDateString,
  timeString24h,
  url,
  enumValue,
  booleanString,
  dateRange,
  idParam,
  searchQuery,
  statusEnum,
  userRole,
  accountStatus,
  regexPatterns: {
    OBJECT_ID_REGEX,
    EMAIL_REGEX,
    PASSWORD_REGEX,
    PHONE_REGEX,
    UUID_REGEX,
    ISO_DATE_REGEX,
    TIME_24H_REGEX,
    URL_REGEX,
  },
};

const { formatZodError } = require('./validationFormatter');

const validate = (schemas, options = {}) => {
  const { strict = true, stripUnknown = true } = options;

  const parseOptions = {
    strict,
    stripUnknown,
  };

  return (req, res, next) => {
    const validationTargets = [
      { schema: schemas.params, target: 'params' },
      { schema: schemas.query, target: 'query' },
      { schema: schemas.body, target: 'body' },
      { schema: schemas.headers, target: 'headers' },
      { schema: schemas.cookies, target: 'cookies' },
    ];

    const results = [];

    for (const { schema, target } of validationTargets) {
      if (!schema) continue;

      const data = req[target] || {};
      const result = schema.safeParse(data, parseOptions);

      if (!result.success) {
        results.push({ target, error: result.error });
        continue;
      }

      req[target] = result.data;
    }

    if (results.length === 0) {
      return next();
    }

    const firstError = results[0];
    if (results.length === 1) {
      const appError = formatZodError(firstError.error);
      appError.validationTarget = firstError.target;
      return next(appError);
    }

    const combinedIssues = [];
    results.forEach(({ target, error }) => {
      error.issues.forEach((issue) => {
        const field = issue.path.length ? issue.path.join('.') : 'root';
        combinedIssues.push({
          field: `${target}.${field}`,
          message: issue.message,
          value: issue.data !== undefined ? issue.data : null,
        });
      });
    });

    const AppError = require('../utils/AppError');
    const summary = `${results.length} request section(s) failed validation`;
    const multiError = AppError.validationError(summary, combinedIssues);
    multiError.validationTargets = results.map((r) => r.target);
    return next(multiError);
  };
};

const validateParams = (schema, options) =>
  validate({ params: schema }, options);

const validateQuery = (schema, options) => validate({ query: schema }, options);

const validateBody = (schema, options) => validate({ body: schema }, options);

const validateHeaders = (schema, options) =>
  validate({ headers: schema }, options);

const validateCookies = (schema, options) =>
  validate({ cookies: schema }, options);

const validateAsync = (schemas, options = {}) => {
  const { strict = true, stripUnknown = true } = options;

  return async (req, res, next) => {
    try {
      const validationTargets = [
        { schema: schemas.params, target: 'params' },
        { schema: schemas.query, target: 'query' },
        { schema: schemas.body, target: 'body' },
        { schema: schemas.headers, target: 'headers' },
        { schema: schemas.cookies, target: 'cookies' },
      ];

      for (const { schema, target } of validationTargets) {
        if (!schema) continue;

        const data = req[target] || {};
        req[target] = await schema.parseAsync(data, { strict, stripUnknown });
      }

      return next();
    } catch (err) {
      const appError = formatZodError(err);
      return next(appError);
    }
  };
};

module.exports = {
  validate,
  validateParams,
  validateQuery,
  validateBody,
  validateHeaders,
  validateCookies,
  validateAsync,
};

'use strict';

const ACCOUNT_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
});

const ACCOUNT_STATUS_VALUES = Object.freeze(Object.values(ACCOUNT_STATUSES));

const DEFAULT_ACCOUNT_STATUS = ACCOUNT_STATUSES.PENDING;

const isValidAccountStatus = (status) => ACCOUNT_STATUS_VALUES.includes(status);

module.exports = {
  ACCOUNT_STATUSES,
  ACCOUNT_STATUS_VALUES,
  DEFAULT_ACCOUNT_STATUS,
  isValidAccountStatus,
};

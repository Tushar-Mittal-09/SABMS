'use strict';

const apiVersions = require('./apiVersions');
const userRoles = require('./userRoles');
const accountStatuses = require('./accountStatuses');
const passwordConstants = require('./password.constants');
const auditoriumConfig = require('./auditoriumConfig');

module.exports = {
  ...apiVersions,
  ...userRoles,
  ...accountStatuses,
  ...passwordConstants,
  ...auditoriumConfig,
  apiVersions,
  userRoles,
  accountStatuses,
  passwordConstants,
  auditoriumConfig,
};

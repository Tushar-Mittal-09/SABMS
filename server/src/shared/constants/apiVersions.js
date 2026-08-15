'use strict';

const API_VERSIONS = Object.freeze({
  V1: 'v1',
  V2: 'v2',
});

const CURRENT_VERSION = API_VERSIONS.V1;

const buildVersionPath = (version, path = '', apiPrefix = '/api') => {
  const cleanVersion = version.startsWith('v') ? version : `v${version}`;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiPrefix}/${cleanVersion}${cleanPath === '/' ? '' : cleanPath}`;
};

const buildCurrentVersionPath = (path = '', apiPrefix = '/api') =>
  buildVersionPath(CURRENT_VERSION, path, apiPrefix);

const SUPPORTED_VERSIONS = Object.values(API_VERSIONS);

const isSupportedVersion = (version) => SUPPORTED_VERSIONS.includes(version);

const VERSION_HEADERS = Object.freeze({
  API_VERSION: 'X-API-Version',
  ACCEPT_VERSION: 'Accept-Version',
  DEPRECATED: 'X-API-Deprecated',
  SUNSET: 'X-API-Sunset',
});

const DEPRECATION_POLICY = Object.freeze({
  GRACE_PERIOD_DAYS: 180,
  WARNING_HEADER: 'X-API-Deprecation-Warning',
});

module.exports = {
  API_VERSIONS,
  CURRENT_VERSION,
  SUPPORTED_VERSIONS,
  VERSION_HEADERS,
  DEPRECATION_POLICY,
  buildVersionPath,
  buildCurrentVersionPath,
  isSupportedVersion,
};

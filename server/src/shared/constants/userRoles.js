'use strict';

const USER_ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  FACULTY: 'FACULTY',
  CLUB_MEMBER: 'CLUB_MEMBER',
  EVENT_ORGANIZER: 'EVENT_ORGANIZER',
  ADMIN: 'ADMIN',
});

const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

const USER_ROLE_LABELS = Object.freeze({
  STUDENT: 'Student',
  FACULTY: 'Faculty',
  CLUB_MEMBER: 'Club Member',
  EVENT_ORGANIZER: 'Event Organizer',
  ADMIN: 'Admin',
});

const DEFAULT_USER_ROLE = USER_ROLES.STUDENT;

const isValidUserRole = (role) => USER_ROLE_VALUES.includes(role);

module.exports = {
  USER_ROLES,
  USER_ROLE_VALUES,
  USER_ROLE_LABELS,
  DEFAULT_USER_ROLE,
  isValidUserRole,
};

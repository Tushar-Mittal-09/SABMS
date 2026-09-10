'use strict';

/**
 * SABMS — Demo/Development Event Seed Script
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DEVELOPMENT / DEMO DATA ONLY                              ║
 * ║  These are NOT real MIET events.                            ║
 * ║  Do NOT claim these as official college event schedules.    ║
 * ║  Replace with actual event data when available.             ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage: node scripts/seedEvents.js
 *
 * Requires MONGODB_URI in server/.env
 */

const path = require('path');
module.paths.push(path.resolve(__dirname, '../server/node_modules'));

// Load env before config
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });

const mongoose = require('mongoose');

const config = require('../server/src/config/env.config');
const {
  connectDatabase,
  disconnectDatabase,
} = require('../server/src/config/database');
const Event = require('../server/src/modules/events/event.model');
const {
  AUDITORIUM_CODES,
  getStudentSeatsForAuditorium,
} = require('../server/src/shared/constants');
const {
  EVENT_STATUS,
} = require('../server/src/modules/events/event.constants');

/**
 * Demo events — clearly marked as development/demo data.
 * Dates are set relative to Sept-Oct 2026 for the current MVP demo period.
 */
const DEMO_EVENTS = [
  {
    name: 'AI & Machine Learning Workshop [Demo]',
    description:
      'A hands-on workshop exploring the fundamentals of artificial intelligence and machine learning. ' +
      'Students will learn about neural networks, NLP basics, and practical ML applications. ' +
      'This is a demo/development event for SABMS testing purposes.',
    auditorium: AUDITORIUM_CODES.AUDITORIUM_1,
    date: new Date('2026-09-20'),
    startTime: '10:00',
    endTime: '13:00',
    status: EVENT_STATUS.UPCOMING,
  },
  {
    name: 'Full-Stack Web Development Seminar [Demo]',
    description:
      'An interactive seminar covering modern full-stack development with React, Node.js, and MongoDB. ' +
      'Industry experts will share best practices for building scalable web applications. ' +
      'This is a demo/development event for SABMS testing purposes.',
    auditorium: AUDITORIUM_CODES.AUDITORIUM_2,
    date: new Date('2026-09-25'),
    startTime: '14:00',
    endTime: '17:00',
    status: EVENT_STATUS.UPCOMING,
  },
  {
    name: 'Robotics Club Open House [Demo]',
    description:
      'The Robotics Club invites all students to an open house showcasing ongoing projects, ' +
      'live demonstrations, and team recruitment. Explore drones, autonomous vehicles, and more. ' +
      'This is a demo/development event for SABMS testing purposes.',
    auditorium: AUDITORIUM_CODES.AUDITORIUM_3,
    date: new Date('2026-09-28'),
    startTime: '11:00',
    endTime: '14:00',
    status: EVENT_STATUS.UPCOMING,
  },
  {
    name: 'Cybersecurity Awareness Webinar [Demo]',
    description:
      'An ongoing webinar on cybersecurity threats, prevention strategies, and ethical hacking fundamentals. ' +
      'Learn about penetration testing, secure coding, and career opportunities in cybersecurity. ' +
      'This is a demo/development event for SABMS testing purposes.',
    auditorium: AUDITORIUM_CODES.AUDITORIUM_1,
    date: new Date('2026-09-10'),
    startTime: '09:00',
    endTime: '18:00',
    status: EVENT_STATUS.ONGOING,
  },
  {
    name: 'Data Science Bootcamp [Demo]',
    description:
      'An intensive bootcamp covering Python for data analysis, visualization with matplotlib, ' +
      'statistical modeling, and introduction to big data tools. Bring your laptop! ' +
      'This is a demo/development event for SABMS testing purposes.',
    auditorium: AUDITORIUM_CODES.AUDITORIUM_2,
    date: new Date('2026-10-05'),
    startTime: '10:00',
    endTime: '16:00',
    status: EVENT_STATUS.UPCOMING,
  },
  {
    name: 'IoT Innovation Hackathon [Demo]',
    description:
      'A 6-hour hackathon where teams build Internet of Things prototypes using Arduino, Raspberry Pi, ' +
      'and cloud platforms. Prizes for the most innovative solutions. ' +
      'This is a demo/development event for SABMS testing purposes.',
    auditorium: AUDITORIUM_CODES.AUDITORIUM_3,
    date: new Date('2026-10-12'),
    startTime: '09:00',
    endTime: '15:00',
    status: EVENT_STATUS.UPCOMING,
  },
];

const seedEvents = async () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  SABMS — Demo Event Seed Script                        ║');
  console.log('║  DEVELOPMENT / DEMO DATA ONLY                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    await connectDatabase();
    console.log('✅ Connected to MongoDB\n');

    let upsertedCount = 0;
    let modifiedCount = 0;

    for (const event of DEMO_EVENTS) {
      const studentSeats = getStudentSeatsForAuditorium(event.auditorium);
      const eventData = {
        ...event,
        totalSeats: studentSeats,
        availableSeats: studentSeats,
      };

      const result = await Event.updateOne(
        { name: event.name },
        { $set: eventData },
        { upsert: true }
      );

      if (result.upsertedCount > 0) upsertedCount++;
      if (result.modifiedCount > 0) modifiedCount++;
    }

    const allEvents = await Event.find({
      status: { $in: [EVENT_STATUS.UPCOMING, EVENT_STATUS.ONGOING] },
    }).sort({ date: 1 });

    console.log(
      `✅ Seed completed: ${upsertedCount} created, ${modifiedCount} updated (${allEvents.length} total demo events active):\n`
    );
    allEvents.forEach((event, i) => {
      console.log(
        `   ${i + 1}. ${event.name}` +
          `\n      Auditorium: ${event.auditorium}` +
          `\n      Date: ${event.date.toISOString().split('T')[0]}` +
          `\n      Time: ${event.startTime} – ${event.endTime}` +
          `\n      Status: ${event.status}` +
          `\n      Student Seats: ${event.totalSeats}\n`
      );
    });

    console.log('───────────────────────────────────────────────────────────');
    console.log('⚠️  These are DEMO events for development/testing only.');
    console.log('   They are NOT official MIET event schedules.');
    console.log(
      '───────────────────────────────────────────────────────────\n'
    );
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    console.log('✅ Disconnected from MongoDB\n');
  }
};

seedEvents();

import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  Bell,
  Layers,
  TrendingUp,
  Building2,
  Users,
  DoorOpen,
  Armchair,
  Search,
  Calendar,
  Send,
  FileCheck,
} from 'lucide-react';

import mietLogo from '../assets/miet-logo.png';

/**
 * ============================================================================
 * 1. VERIFIED INSTITUTIONAL DATA
 * ============================================================================
 * Sourced directly from official MIET documentation and confirmed assets.
 */
export const VERIFIED_INSTITUTIONAL_DATA = {
  institution: {
    name: 'Meerut Institute of Engineering & Technology',
    shortName: 'MIET',
    status: 'An Autonomous Institute',
    accreditation:
      'Approved by AICTE & Affiliated to Dr. A.P.J. Abdul Kalam Technical University, Lucknow',
    tagline: 'Smart Auditorium Booking & Management System',
    address: 'NH-58, Baghpat Bypass Road, Meerut, Uttar Pradesh - 250005',
    phone: '+91 121 244 1300',
    email: 'info@miet.ac.in',
    portalLinks: [
      { label: 'Students', href: '/login' },
      { label: 'Faculty', href: '/login' },
      { label: 'Staff', href: '/login' },
      { label: 'Help & Support', href: '#contact' },
    ],
    socials: [
      { name: 'Facebook', href: 'https://facebook.com', icon: 'Facebook' },
      { name: 'Instagram', href: 'https://instagram.com', icon: 'Instagram' },
      { name: 'LinkedIn', href: 'https://linkedin.com', icon: 'Linkedin' },
      { name: 'YouTube', href: 'https://youtube.com', icon: 'Youtube' },
    ],
  },
  assets: {
    logo: mietLogo, // Exact official MIET logo provided by institution
    campusHero: null, // Pending verified institutional photography
    campusLawn: null, // Pending verified institutional photography
    campusMap: null, // Pending official campus masterplan / layout
    auditoriumMain: null,
    seminarHall: null,
    conferenceHall: null,
    ctaBg: null,
  },
  stats: [
    {
      id: 'auditoriums',
      value: '4',
      label: 'Auditoriums',
      description: 'Campus institutional auditoriums',
      icon: Building2,
    },
    {
      id: 'auditorium-capacity',
      value: '250+',
      label: 'Auditorium Capacity',
      description: 'Seating capacity in primary halls',
      icon: Users,
    },
    {
      id: 'seminar-halls',
      value: '10+',
      label: 'Seminar Halls',
      description: 'Across academic departments',
      icon: DoorOpen,
    },
    {
      id: 'seminar-seating',
      value: '150+',
      label: 'Seminar Hall Seating',
      description: 'Average seating per seminar hall',
      icon: Armchair,
    },
  ],
  navLinks: [
    { label: 'Home', href: '#home' },
    { label: 'Auditoriums', href: '#venues' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Guidelines', href: '#guidelines' },
    { label: 'About SABMS', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ],
  footerResources: [
    { label: 'Booking Guidelines', href: '#guidelines' },
    { label: 'Venue Policies', href: '#guidelines' },
    { label: 'Help & Support', href: '#contact' },
    { label: 'FAQs', href: '#faq' },
    { label: 'Privacy Policy', href: '#privacy' },
    { label: 'Terms of Service', href: '#terms' },
  ],
};

/**
 * ============================================================================
 * 2. DEVELOPMENT PREVIEW DATA (API-READY PLACEHOLDERS)
 * ============================================================================
 * Unverified structural placeholders for frontend layout and interaction.
 * Marked explicitly as development preview until connected to the SABMS
 * backend venue inventory and scheduling API.
 */
export const DEVELOPMENT_PREVIEW_DATA = {
  venues: [
    {
      id: 'preview-venue-01',
      name: 'Auditorium 01',
      type: 'Auditorium',
      capacityLabel: 'Capacity: To be configured',
      location: 'Academic Complex (Location to be configured)',
      facilities: [
        'Audio-Visual System (Configurable)',
        'Stage & Podium (Configurable)',
        'Tiered Seating (Configurable)',
        'Acoustics (Configurable)',
      ],
      image: null,
      statusLabel: 'Preview Slot',
      badge: 'Development Preview',
      status: 'available',
    },
    {
      id: 'preview-venue-02',
      name: 'Seminar Hall 01',
      type: 'Seminar Hall',
      capacityLabel: 'Capacity: To be configured',
      location: 'Departmental Wing (Location to be configured)',
      facilities: [
        'Presentation Display (Configurable)',
        'Public Address System (Configurable)',
        'Wi-Fi Connectivity (Configurable)',
      ],
      image: null,
      statusLabel: 'Preview Slot',
      badge: 'Development Preview',
      status: 'available',
    },
    {
      id: 'preview-venue-03',
      name: 'Conference Hall 01',
      type: 'Conference Hall',
      capacityLabel: 'Capacity: To be configured',
      location: 'Administrative Wing (Location to be configured)',
      facilities: [
        'Boardroom Seating (Configurable)',
        'Video Conferencing Support (Configurable)',
        'Microphone Network (Configurable)',
      ],
      image: null,
      statusLabel: 'Preview Slot',
      badge: 'Development Preview',
      status: 'available',
    },
    {
      id: 'preview-venue-04',
      name: 'Auditorium 02',
      type: 'Auditorium',
      capacityLabel: 'Capacity: To be configured',
      location: 'Academic Complex (Location to be configured)',
      facilities: [
        'Projection System (Configurable)',
        'Auditorium Seating (Configurable)',
        'Control Console (Configurable)',
      ],
      image: null,
      statusLabel: 'Preview Slot',
      badge: 'Development Preview',
      status: 'available',
    },
  ],

  campusBlocks: [
    { id: 1, name: 'Administrative Block' },
    { id: 2, name: 'Information Technology' },
    { id: 3, name: 'Computer Science & Engineering' },
    { id: 4, name: 'Electronics & Communication' },
    { id: 5, name: 'Electrical Engineering' },
    { id: 6, name: 'Mechanical Engineering' },
    { id: 7, name: 'Civil Engineering' },
    { id: 8, name: 'Applied Sciences' },
    { id: 9, name: 'Central Library' },
    { id: 10, name: 'Main Auditorium' },
  ],

  campusFacilities: [
    'Campus Quadrangle',
    'Administrative Offices',
    'Central Library',
    'Faculty Workspaces',
    'Student Facilities',
  ],

  eventTypes: [
    'Academic Lecture / Seminar',
    'Technical Workshop',
    'Conference / Symposium',
    'Cultural Program',
    'Student Club Event',
    'Faculty Development Program',
  ],

  whySabmsFeatures: [
    {
      id: 'easy-booking',
      title: 'Easy Online Booking',
      description: 'Check venue availability and submit requests digitally.',
      icon: CalendarCheck,
    },
    {
      id: 'real-time-avail',
      title: 'Real-Time Availability',
      description: 'See available slots before submitting a request.',
      icon: Clock,
    },
    {
      id: 'transparent-process',
      title: 'Transparent Process',
      description: 'Track booking requests and approval status.',
      icon: CheckCircle2,
    },
    {
      id: 'automated-notifications',
      title: 'Automated Notifications',
      description: 'Stay informed about booking updates.',
      icon: Bell,
    },
    {
      id: 'centralized-mgmt',
      title: 'Centralized Management',
      description:
        'Manage auditorium and event-space requests from one platform.',
      icon: Layers,
    },
    {
      id: 'better-utilization',
      title: 'Better Resource Utilization',
      description: 'Improve the utilization of MIET event infrastructure.',
      icon: TrendingUp,
    },
  ],

  howItWorksSteps: [
    {
      step: '01',
      title: 'Browse',
      description: 'Explore available auditoriums and event spaces.',
      icon: Search,
    },
    {
      step: '02',
      title: 'Select Date & Time',
      description: 'Choose your preferred date and time slot.',
      icon: Calendar,
    },
    {
      step: '03',
      title: 'Submit Request',
      description: 'Provide event and booking details.',
      icon: Send,
    },
    {
      step: '04',
      title: 'Get Confirmation',
      description: 'Track your request and receive the final booking status.',
      icon: FileCheck,
    },
  ],
};

/**
 * ============================================================================
 * Backward-Compatible Aliases for Component Consumers
 * ============================================================================
 */
export const ASSETS = VERIFIED_INSTITUTIONAL_DATA.assets;
export const INSTITUTION = VERIFIED_INSTITUTIONAL_DATA.institution;
export const NAV_LINKS = VERIFIED_INSTITUTIONAL_DATA.navLinks;
export const VERIFIED_STATS = VERIFIED_INSTITUTIONAL_DATA.stats;
export const FOOTER_QUICK_LINKS = VERIFIED_INSTITUTIONAL_DATA.navLinks;
export const FOOTER_RESOURCES = VERIFIED_INSTITUTIONAL_DATA.footerResources;

export const VENUES_DATA = DEVELOPMENT_PREVIEW_DATA.venues;
export const CAMPUS_MAP_BLOCKS = DEVELOPMENT_PREVIEW_DATA.campusBlocks;
export const OTHER_FACILITIES = DEVELOPMENT_PREVIEW_DATA.campusFacilities;
export const EVENT_TYPES = DEVELOPMENT_PREVIEW_DATA.eventTypes;
export const WHY_SABMS_FEATURES = DEVELOPMENT_PREVIEW_DATA.whySabmsFeatures;
export const HOW_IT_WORKS_STEPS = DEVELOPMENT_PREVIEW_DATA.howItWorksSteps;

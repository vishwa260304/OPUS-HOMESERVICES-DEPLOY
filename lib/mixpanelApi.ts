/**
 * Mixpanel API Helper
 * 
 * This file provides functions to query Mixpanel API for organized analytics data.
 * You'll need Mixpanel API Secret and Service Account credentials.
 * 
 * Setup:
 * 1. Go to Mixpanel → Settings → Project Settings → Service Accounts
 * 2. Create a service account and get the API secret
 * 3. Add to .env: MIXPANEL_API_SECRET=your_secret_here
 * 4. Add to .env: MIXPANEL_PROJECT_ID=your_project_id_here
 */

import Constants from 'expo-constants';

const MIXPANEL_API_BASE = 'https://mixpanel.com/api/2.0';

interface MixpanelQueryParams {
  from_date: string;
  to_date: string;
  event?: string;
  unit?: 'day' | 'week' | 'month';
  interval?: number;
  type?: 'general' | 'unique' | 'average';
  where?: string;
  on?: string;
}

/**
 * Get Mixpanel API credentials from environment
 */
function getMixpanelCredentials() {
  const apiSecret = Constants.expoConfig?.extra?.MIXPANEL_API_SECRET || 
                   process.env.MIXPANEL_API_SECRET;
  const projectId = Constants.expoConfig?.extra?.MIXPANEL_PROJECT_ID || 
                   process.env.MIXPANEL_PROJECT_ID;

  if (!apiSecret || !projectId) {
    console.warn('Mixpanel API credentials not found. Add MIXPANEL_API_SECRET and MIXPANEL_PROJECT_ID to .env');
    return null;
  }

  return { apiSecret, projectId };
}

/**
 * Query Mixpanel Events API
 * Note: This requires server-side implementation due to API secret security
 */
export async function queryMixpanelEvents(params: {
  event?: string;
  from_date: string;
  to_date: string;
  where?: string;
  limit?: number;
}) {
  // This should be implemented on a backend server
  // Never expose API secret in client-side code
  console.warn('Mixpanel API queries should be done server-side for security');
  return null;
}

/**
 * Get user events from Mixpanel
 * This uses Mixpanel's Activity Stream API
 */
export async function getUserEvents(userId: string, limit: number = 100) {
  // This requires server-side implementation
  // The API endpoint is: /api/2.0/engage/activity-stream
  console.warn('User events query should be done server-side');
  return null;
}

/**
 * Format duration from milliseconds to human-readable
 */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * NOTE: For security, Mixpanel API queries should be done server-side.
 * 
 * Recommended approach:
 * 1. Create a backend API endpoint (Node.js/Express, Python/Flask, etc.)
 * 2. Store MIXPANEL_API_SECRET on the server
 * 3. Have your app call your backend API
 * 4. Backend queries Mixpanel API and returns organized data
 * 
 * Example backend endpoint structure:
 * 
 * GET /api/analytics/users
 * GET /api/analytics/pages
 * GET /api/analytics/services
 * GET /api/analytics/user/:userId/events
 * GET /api/analytics/page/:pagePath/events
 */

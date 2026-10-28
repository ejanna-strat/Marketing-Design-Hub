// Auto sign-out (owner, Oct 28). Requesters are signed out after 2 hours with
// no activity and when they close the browser; the Marketing team (any team
// tag) after 5 hours, and closing the browser doesn't sign them out. Everyone
// gets a "Still there?" warning 5 minutes before.
//
// Shared by the middleware (checks on every page load) and IdleSignOut (the
// timer and warning in the browser), so both read the same cookies.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Short times for trying it out (owner, Oct 28): NEXT_PUBLIC_IDLE_TEST=1 in
// Vercel Preview (staging) only, never Production. Delete it and redeploy
// staging to go back to the real times.
const TEST = process.env.NEXT_PUBLIC_IDLE_TEST === "1";

export const IDLE_LIMIT_MS = TEST
  ? { requester: 3 * MINUTE, team: 5 * MINUTE }
  : { requester: 2 * HOUR, team: 5 * HOUR };
export const WARN_BEFORE_MS = TEST ? MINUTE : 5 * MINUTE;

// When the person last did something (milliseconds), in any tab.
export const ACTIVE_COOKIE = "mdh-active";
// Longer than any sign-in lasts (browsers keep cookies 400 days at most), so
// a session never outlives it.
export const ACTIVE_MAX_AGE = 60 * 60 * 24 * 400; // seconds
// No expiry, so the browser drops it when it closes: if it's missing while
// mdh-active is there, the browser was closed and opened again.
export const OPEN_COOKIE = "mdh-open";

// Signs the browser out without leaving the page (IdleSignOut, then /login).
export const SIGN_OUT_PATH = "/auth/signout";

// Netlify Function: reads the VRBO reservation-calendar iCal export and returns
// booked date ranges for the next 14 months as JSON for /availability.html.
//
// Setup: Netlify → Site configuration → Environment variables →
//   VRBO_ICAL_URL = the listing's calendar "Export" link from the Vrbo owner
//   dashboard (Calendar → Import/Export → Export calendar), ends in .ics
//   (comma-separate multiple URLs to merge feeds)
//
// Freshness: fetched from Vrbo on demand; responses are CDN-cached for 1 hour,
// so the public calendar is at most an hour behind Vrbo.

var CAL_TZ = process.env.CAL_TZ || 'America/New_York';
var DAY = 86400000;
var parseICS = require('./calendar')._parseICS;

exports.handler = async function () {
  var urls = (process.env.VRBO_ICAL_URL || '')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!urls.length) return resp({ error: 'VRBO_ICAL_URL not set' }, 300);

  var now = Date.now();
  var winStart = now - 7 * DAY;                 // a few days back for context
  var winEnd = now + 430 * DAY;                 // ~14 months ahead
  try {
    var events = [];
    for (var i = 0; i < urls.length; i++) {
      var r = await fetch(urls[i], { redirect: 'follow' });
      if (!r.ok) return resp({ error: 'Calendar feed error (HTTP ' + r.status + ')' }, 300);
      events = events.concat(parseICS(await r.text(), winStart, winEnd));
    }
    // Reduce to date-only booked ranges [s, e) in the house's timezone
    var ranges = events.map(function (ev) {
      return { s: dateInTz(ev.start), e: dateInTz(ev.end) };
    }).filter(function (rg) { return rg.s && rg.e && rg.e > rg.s; });
    ranges.sort(function (a, b) { return a.s < b.s ? -1 : 1; });
    return resp({ updated: new Date(now).toISOString(), ranges: ranges }, 3600);
  } catch (e) {
    return resp({ error: String((e && e.message) || e) }, 300);
  }
};

function resp(body, maxAge) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=' + (maxAge || 3600)
    },
    body: JSON.stringify(body)
  };
}

// UTC ms → 'YYYY-MM-DD' as seen in the house's timezone
function dateInTz(ts) {
  if (ts == null) return null;
  var p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: CAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}

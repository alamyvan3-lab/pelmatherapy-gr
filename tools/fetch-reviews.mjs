/* ==========================================================================
   fetch-reviews.mjs — pull the practice's REAL Google reviews and write them
   into index.html as static markup.
   ==========================================================================

   Why build-time and not in the browser:
     • The API key stays secret. A Places key in client-side JS is readable by
       anyone who opens View Source.
     • Visitors make zero third-party requests, so the site keeps its
       privacy/GDPR position and its strict Content-Security-Policy.
     • The reviews end up in the HTML, so search engines index them and they
       still render with JavaScript disabled.

   Run:
     GOOGLE_PLACES_API_KEY=xxx  GOOGLE_PLACE_ID=ChIJ...  node tools/fetch-reviews.mjs

   Nothing is invented: if the API returns no reviews, the section is removed
   from the page rather than filled with placeholder praise.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';

/* Resolve the business by name+address rather than trusting a pasted Place ID.
   A Place ID copied from a Maps URL is very easily the ID of the *street
   address* rather than the *business* — that mistake returns a place with no
   reviews at all and looks like an empty result rather than an error.
   Set GOOGLE_PLACE_ID to pin an exact place and skip the lookup. */
const SEARCH_QUERY = 'Pelma Therapy, Ολυμπιονικών 49, Γλυκά Νερά 15354';
const EXPECT_NAME = 'pelma';

const KEY = process.env.GOOGLE_PLACES_API_KEY;
let PLACE_ID = process.env.GOOGLE_PLACE_ID || '';
const ROOT = path.resolve(import.meta.dirname, '..');
const PAGE = path.join(ROOT, 'index.html');

const START = '<!-- REVIEWS:START -->';
const END = '<!-- REVIEWS:END -->';

if (!KEY) {
  console.error(
    'GOOGLE_PLACES_API_KEY is not set.\n' +
    'Add it as a repository secret (Settings > Secrets and variables > Actions),\n' +
    'then re-run this workflow. The Place ID is already configured.'
  );
  process.exit(1);
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* Places API (New). Only the fields we actually display are requested. */
const FIELDS = 'displayName,rating,userRatingCount,googleMapsUri,reviews';

/* Step 1 — find the business, unless an exact Place ID was pinned. */
if (!PLACE_ID) {
  const s = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: SEARCH_QUERY, languageCode: 'el' }),
  });
  if (!s.ok) {
    console.error(`Place search failed ${s.status}: ${(await s.text()).slice(0, 400)}`);
    process.exit(1);
  }
  const found = (await s.json()).places || [];
  const hit = found.find((p) => (p.displayName?.text || '').toLowerCase().includes(EXPECT_NAME));
  if (!hit) {
    console.error(
      `Could not find a place named like "${EXPECT_NAME}".\n` +
      `Search returned: ${found.map((p) => p.displayName?.text).join(', ') || '(nothing)'}`
    );
    process.exit(1);
  }
  PLACE_ID = hit.id;
  console.log(`resolved "${hit.displayName?.text}" (${hit.formattedAddress}) -> ${PLACE_ID}`);
}

/* Step 2 — pull the details for that place. */
const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}`, {
  headers: {
    'X-Goog-Api-Key': KEY,
    'X-Goog-FieldMask': FIELDS,
    'Accept-Language': 'el',
  },
});

if (!res.ok) {
  console.error(`Places API returned ${res.status}: ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}

const data = await res.json();

/* Guard against silently rendering the wrong place (e.g. the street address,
   which has no reviews and would look like "no reviews yet"). */
const gotName = (data.displayName?.text || '').toLowerCase();
if (gotName && !gotName.includes(EXPECT_NAME)) {
  console.error(`Resolved place is "${data.displayName?.text}", not the practice. Refusing to write.`);
  process.exit(1);
}
const rating = typeof data.rating === 'number' ? data.rating : null;
const count = data.userRatingCount || 0;
const mapsUri = data.googleMapsUri || '';
// Google returns at most 5 reviews and does not let you choose which.
const reviews = (data.reviews || []).filter((r) => (r.text?.text || '').trim().length > 0);

console.log(`rating=${rating} count=${count} reviews=${reviews.length}`);

function stars(n) {
  const full = Math.round(n || 0);
  let out = `<svg class="review__stars" width="86" height="16" viewBox="0 0 86 16" role="img" aria-label="${full} / 5">`;
  for (let i = 0; i < 5; i++) {
    const x = i * 17.5;
    // a square-shouldered star, drawn in the plate's own geometry
    const d = `M${x + 8} 1.4 L${x + 10.1} 6 L${x + 15} 6.5 L${x + 11.4} 9.8 `
            + `L${x + 12.4} 14.6 L${x + 8} 12.3 L${x + 3.6} 14.6 L${x + 4.6} 9.8 `
            + `L${x + 1} 6.5 L${x + 5.9} 6 Z`;
    out += `<path class="${i < full ? 'st-on' : 'st-off'}" d="${d}"/>`;
  }
  return out + '</svg>';
}

let block;
if (!reviews.length) {
  // No reviews to show → ship no section. Never a fabricated one.
  block = `${START}\n${END}`;
  console.log('No reviews returned — reviews section omitted.');
} else {
  const cards = reviews.map((r, i) => {
    const when = esc(r.relativePublishTimeDescription || '');
    const who = esc(r.authorAttribution?.displayName || '');
    const txt = esc((r.text?.text || '').trim());
    return `        <figure class="review${i === 0 ? ' is-on' : ''}">
          <div class="review__rating">${stars(r.rating)}<span class="review__score">${esc(r.rating)}/5</span></div>
          <blockquote class="review__text">${txt}</blockquote>
          <figcaption class="review__cite">
            <span class="review__who">${who}</span>
            <span class="review__when">${when}</span>
          </figcaption>
        </figure>`;
  }).join('\n');

  const keys = reviews.map((r, i) => {
    const who = esc(r.authorAttribution?.displayName || '');
    const when = esc(r.relativePublishTimeDescription || '');
    return `        <li${i === 0 ? ' data-on' : ''}><button type="button" aria-pressed="${i === 0}">`
      + `<span class="n">${i + 1}</span>`
      + `<span><span class="who">${who}</span><br><span class="review__when">${when}</span></span>`
      + `</button></li>`;
  }).join('\n');

  const agg = rating
    ? `      <div class="ratingblock">
        <span class="ratingblock__num">${esc(rating.toFixed(1))}</span>
        <span class="ratingblock__meta">${stars(rating)}<span class="review__score">Google · ${esc(count)}</span></span>
      </div>\n`
    : '';

  block = `${START}
<section class="sect" id="reviews">
  <div class="plate">
    <div class="reg" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
${agg}    <div class="reviewplate" style="margin-top:var(--s-lg)">
      <div class="reviews offreg">
${cards}
      </div>
      <ol class="reviewkey" data-reviewkey>
${keys}
      </ol>
    </div>
    <p class="review-attrib">Google${mapsUri ? ` · <a href="${esc(mapsUri)}" rel="noopener nofollow">Google Maps</a>` : ''}</p>
  </div>
</section>
${END}`;
}

let html = fs.readFileSync(PAGE, 'utf8');
if (!html.includes(START) || !html.includes(END)) {
  console.error(`Markers ${START} / ${END} not found in index.html.`);
  process.exit(1);
}
const before = html.slice(0, html.indexOf(START));
const after = html.slice(html.indexOf(END) + END.length);
fs.writeFileSync(PAGE, before + block + after);
console.log('index.html updated.');

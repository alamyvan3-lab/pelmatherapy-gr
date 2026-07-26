/* ==========================================================================
   build-reviews.mjs — render tools/reviews.json into index.html.
   ==========================================================================
   The reviews are real, supplied by the practice, and stored as data so they
   can be edited without touching markup:

     1. edit tools/reviews.json
     2. node tools/build-reviews.mjs
     3. commit

   Text is HTML-escaped on the way in, so a quote, an ampersand or an angle
   bracket in someone's review can never become markup.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAGE = path.join(ROOT, 'index.html');
const DATA = path.join(ROOT, 'tools/reviews.json');

const START = '<!-- REVIEWS:START -->';
const END = '<!-- REVIEWS:END -->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// preserve deliberate line breaks inside a review, after escaping
const escMultiline = (s) => esc(s).replace(/\r?\n/g, '<br>');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const reviews = (data.reviews || []).filter((r) => (r.text || '').trim());

if (!reviews.length) {
  console.error('No reviews in tools/reviews.json — refusing to write an empty section.');
  process.exit(1);
}

/* a square-shouldered star, drawn in the plate's own geometry */
function stars(n, size) {
  const s = size || 16;
  const gap = s * 1.09;
  const full = Math.round(n || 0);
  let out = `<svg class="review__stars" width="${Math.round(gap * 5)}" height="${s}" `
          + `viewBox="0 0 ${gap * 5} ${s}" role="img" aria-label="${full} στα 5">`;
  for (let i = 0; i < 5; i++) {
    const x = i * gap;
    const u = s / 16;
    const d = `M${x + 8 * u} ${1.4 * u} L${x + 10.1 * u} ${6 * u} L${x + 15 * u} ${6.5 * u} `
            + `L${x + 11.4 * u} ${9.8 * u} L${x + 12.4 * u} ${14.6 * u} L${x + 8 * u} ${12.3 * u} `
            + `L${x + 3.6 * u} ${14.6 * u} L${x + 4.6 * u} ${9.8 * u} L${x + 1 * u} ${6.5 * u} `
            + `L${x + 5.9 * u} ${6 * u} Z`;
    out += `<path class="${i < full ? 'st-on' : 'st-off'}" d="${d}"/>`;
  }
  return out + '</svg>';
}

const arrow = (dir) =>
  `<svg viewBox="0 0 17 17" aria-hidden="true" focusable="false" fill="none" `
  + `stroke="currentColor" stroke-width="1.8"><path d="${
      dir === 'prev' ? 'M11 2 4 8.5 11 15' : 'M6 2 13 8.5 6 15'
    }"/></svg>`;

const cards = reviews.map((r) => `        <figure class="review">
          <div class="review__rating">${stars(r.rating)}<span class="review__score">${esc(r.rating)}/5</span></div>
          <blockquote class="review__text">${escMultiline(r.text.trim())}</blockquote>
          <figcaption class="review__cite">
            <span class="review__who">${esc(r.author)}</span>
            <span class="review__when">${esc(r.when)}</span>
          </figcaption>
        </figure>`).join('\n');

const agg = data.rating
  ? `      <div class="ratingblock">
        <span class="ratingblock__num">${esc(Number(data.rating).toFixed(1))}</span>
        <span class="ratingblock__meta">${stars(data.rating, 20)}<span class="review__score">Google · ${esc(data.count)}</span></span>
      </div>\n`
  : '';

const block = `${START}
<section class="sect" id="reviews" data-no-i18n lang="el">
  <div class="plate">
    <div class="reg" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
${agg}    <div class="reviewrail" data-reviewrail style="margin-top:var(--s-lg)">
      <div class="reviewtrack" tabindex="0" role="group" aria-label="Κριτικές Google">
${cards}
      </div>
      <div class="railbar">
        <button class="railbtn" type="button" data-rail="prev" aria-label="Προηγούμενη κριτική">${arrow('prev')}</button>
        <button class="railbtn" type="button" data-rail="next" aria-label="Επόμενη κριτική">${arrow('next')}</button>
        <span class="railprog" aria-hidden="true"><span></span></span>
        <span class="railcount" aria-live="polite">1 / ${reviews.length}</span>
      </div>
    </div>
    <p class="review-attrib">Google${data.mapsUrl ? ` · <a href="${esc(data.mapsUrl)}" rel="noopener nofollow">Google Maps</a>` : ''}</p>
  </div>
</section>
${END}`;

let html = fs.readFileSync(PAGE, 'utf8');
if (!html.includes(START) || !html.includes(END)) {
  console.error(`Markers ${START} / ${END} not found in index.html.`);
  process.exit(1);
}
fs.writeFileSync(
  PAGE,
  html.slice(0, html.indexOf(START)) + block + html.slice(html.indexOf(END) + END.length)
);
console.log(`Wrote ${reviews.length} reviews (${data.rating}★ of ${data.count}) into index.html.`);

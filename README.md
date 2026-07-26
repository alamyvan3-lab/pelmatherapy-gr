# Pelma Therapy — pelmatherapy.gr

Website for **Pelma Therapy**, a foot-pressure-analysis practice (πελματογράφημα)
and custom orthotic-insole workshop in Γλυκά Νερά, Greece.

Four Greek-language pages: Αρχική, Υπηρεσίες, Παθήσεις, Διεύθυνση & Ραντεβού.

## Stack

Plain static HTML, CSS and SVG. No build step, no framework, no dependencies —
open `index.html` in a browser and it runs. One small vanilla-JS file
(`assets/plate.js`) drives the hero plate, the conditions atlas and the mobile
menu; everything degrades gracefully with JavaScript disabled.

```
index.html          Αρχική (home)
ypiresies.html      Υπηρεσίες (services)
pathiseis.html      Παθήσεις (conditions)
rantevou.html       Διεύθυνση & Ραντεβού (directions & appointments)
assets/plate.css    the full stylesheet / design system
assets/plate.js     hero plate + atlas + menu behaviour
assets/logo.jpg     logo
assets/favicon.ico  favicon
CNAME               custom domain for GitHub Pages
```

## Run locally

Any static server, e.g.:

```
npx http-server . -p 8123
```

then open http://localhost:8123 .

## Hosting

Served via GitHub Pages at **pelmatherapy.gr** (see `CNAME`).

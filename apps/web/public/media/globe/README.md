# Globe imagery

- `earth/{z}/{x}/{y}.jpg` — the homepage globe's surface, zoom 0–3, Web-Mercator
  tiles made from NASA imagery (public domain): Blue Marble (daytime, darkened and
  cooled) blended with Black Marble city lights (warm lights only, with a soft
  bloom). Source files came from the `three-globe` npm package's examples
  (MIT; the images themselves are NASA public domain). Regenerate with the script
  in docs/HANDOVER.md if needed.
- `countries-110m.json` — Natural Earth country outlines (public domain).
- From zoom 4 the street map is CARTO's dark basemap (© OpenStreetMap, © CARTO).

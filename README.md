# Numbers

A Progressive Web App that tracks numbers over time, for example the weight, the pages read or the minutes of sport.

- Add a tracker with a name, a unit, a color and a chart type: a line chart of each value or a bar chart of the sum per day.
- The start page shows all trackers, each with the current value and a chart of the last 30 days.
- Add a value for any time. The default time is the current time.
- The page of a tracker shows a chart for 7 days, 30 days, 90 days, 1 year or all values, statistics and the list of values.
- Swipe a tracker or a value to the left to show Edit and Delete.

## Tech

- React, TypeScript and Vite
- `vite-plugin-pwa` for the manifest, the service worker and the offline cache
- `localStorage` for the data

## Development

```bash
npm install
npm run dev
```

## Deployment

The GitHub Actions workflow `.github/workflows/deploy.yml` builds the app and publishes it to GitHub Pages on each push to `main`. The app is served at `https://pglira.github.io/number-tracker/`.

## Install on iOS

Open the URL in Safari, tap Share and select "Add to Home Screen".

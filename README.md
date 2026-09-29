# Calavera Cabina

A responsive Día de Muertos photo booth built with Astro. Guests can take a webcam selfie, select a portrait style, then generate and download a Cloudinary portrait saved to the account's Media Library.

## Cloudinary setup

1. In Cloudinary Console, enable the **Image Generation** add-on.
2. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to the workspace-root `.env` file, or use Cloudinary's `CLOUDINARY_URL` connection string. The variable names are in `.env.example`. Keep these values server-side; do not prefix them with `PUBLIC_`.
3. Run the booth over `localhost` or HTTPS to allow webcam access.

The generation endpoint uploads the selected image securely, uses it as a reference for Cloudinary's image-to-image API, and saves the generated portrait as a managed asset under `calavera-cabina/portraits/`. The uploaded source photo is deleted after generation; the generated portrait remains in the Media Library.

## Development

```sh
npm install
npx astro dev --background
```

Manage the background server with `npx astro dev stop`, `npx astro dev status`, and `npx astro dev logs`.

## Build

```sh
npm run build
npm run preview
```

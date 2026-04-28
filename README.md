This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker

Build and run the production image locally:

```bash
docker compose up --build
```

The app will be available at [http://localhost:3000](http://localhost:3000).

Docker Compose reads values from your local `.env` automatically. See `docker.env.example` for the supported variables. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are required for private chat routes and Upstash Realtime, and they are also required when `PERSONAL_CHAT_SERVICE_MODE=gateway`.

When the personal chat gateway is running on your host machine, the compose defaults point to `http://host.docker.internal:4000` and `http://host.docker.internal:4002` from inside the container. Override those with `DOCKER_PERSONAL_CHAT_GATEWAY_URL` and `DOCKER_PERSONAL_CHAT_SOCKET_URL` when needed.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
"# frontend-chat-app" 

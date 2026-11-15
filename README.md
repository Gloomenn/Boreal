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

## Temporary mailboxes

New mailboxes are created and synced through [MailSlurp](https://www.mailslurp.com/), including attachment downloads. Configure `MAILSLURP_API_KEY` in local and Vercel environments and use a MailSlurp plan that permits retained, non-expiring inboxes; the app requests permanent inboxes explicitly and reports an error if the plan returns an expiring inbox.

Previously created MailSlurp inboxes remain usable. Mailboxes created during the Mail.tm migration are also still supported for synchronization, attachment downloads, and deletion. Keep `MAILTM_PASSWORD_SECRET` stable while any of those legacy Mail.tm mailboxes remain active; when it is not set, their credentials are derived from `JWT_SECRET`. The footer retains the Mail.tm attribution link for these legacy inboxes.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

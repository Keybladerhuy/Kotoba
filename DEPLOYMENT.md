# Deployment Guide

This app is a static site (no build step, no server) — any platform that serves static files over HTTP works.

## Free Hosting Options

| Platform | Free Bandwidth | Best For |
|----------|---------------|----------|
| [Netlify](https://netlify.com) | 100 GB/mo | Freelance work, client handoffs |
| [Vercel](https://vercel.com) | 100 GB/mo | Frontend-heavy projects |
| [Cloudflare Pages](https://pages.cloudflare.com) | Unlimited | Performance-focused deploys |
| [GitHub Pages](https://pages.github.com) | Unlimited (public repos) | Simple personal projects |

**Recommended: Netlify or Vercel** — both are industry-standard platforms that clients commonly use. The workflow (git-push deploys, preview URLs per branch, custom domains) is directly transferable to freelance work.

Netlify has a slight edge for freelancing due to its client-friendly dashboard, built-in form handling, and drag-and-drop deploy option for quick handoffs.

## Deploying to Netlify (Step-by-Step)

1. Push your repo to GitHub
2. Go to [netlify.com](https://netlify.com) and sign up (free)
3. Click **Add new site** → **Import from Git**
4. Select your GitHub repo
5. Set build settings:
   - **Build command:** *(leave blank)*
   - **Publish directory:** `.`
6. Click **Deploy site** — you'll have a live URL in ~30 seconds

A `netlify.toml` config file is not required for this app since there is no build step.

## How URLs Work

### Default URL (free, automatic)

When you deploy, the platform assigns you a randomly generated subdomain:

```
https://kotoba-japanese-abc123.netlify.app   ← Netlify
https://kotoba-japanese.vercel.app           ← Vercel
https://kotoba-japanese.pages.dev            ← Cloudflare Pages
```

You can rename this to something nicer within the platform's dashboard (e.g. `kotoba-study.netlify.app`) for free.

### Custom Domain (e.g. `mywebpagename.com`)

To use your own domain like `mywebpagename.com`, you need two things:

#### 1. Buy a domain from a registrar (~$10–15/year)

Popular registrars:
- [Namecheap](https://namecheap.com) — cheap, clean UI
- [Porkbun](https://porkbun.com) — often the cheapest
- [Google Domains / Squarespace Domains](https://domains.squarespace.com)
- [Cloudflare Registrar](https://cloudflare.com/products/registrar) — at-cost pricing, no markup

#### 2. Point the domain at your hosting platform

In your registrar's DNS settings, you add records that tell the internet where your site lives. Your hosting platform gives you exact instructions, but it typically looks like this:

```
Type    Name    Value
A       @       75.2.60.5          ← your host's IP address
CNAME   www     mywebpagename.com  ← redirects www → root
```

Netlify, Vercel, and Cloudflare all have guided custom domain setup in their dashboards — they walk you through the exact DNS records to add.

#### Timeline

- Domain purchase: immediate
- DNS propagation (changes going live globally): 5 minutes to 48 hours, usually under an hour

#### HTTPS / SSL

All major platforms (Netlify, Vercel, Cloudflare) automatically provision a free SSL certificate (via Let's Encrypt) for custom domains. Your site will be served over `https://` at no extra cost.

### Summary

```
Free subdomain:   https://your-app.netlify.app       — zero cost, immediate
Custom domain:    https://mywebpagename.com           — ~$10–15/year for the domain name
```

The hosting itself stays free — you only pay for the domain registration.

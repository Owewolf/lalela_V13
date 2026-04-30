# Static Deployment

## Deployment Model

Lalela is deployed as a static frontend from `public_html`, with one PHP endpoint for invite emails.

Public web root:
- `public_html`

Private server root:
- `/home/hbktethg/private/`

Single public upload archive:
- `lalela-static.zip`

There is no live Node runtime in this deployment.

## Public Files

Upload and extract `lalela-static.zip` into `public_html` so that `public_html` contains:

- `index.html`
- `manifest.json`
- `.htaccess`
- `assets/...`
- `api/invitations/email/index.php`

Do not upload the project source, `.env`, `node_modules`, or the service account JSON into `public_html`.

## Private Files

Create and keep these outside the web root:

- `/home/hbktethg/private/mail/mail_config.php`
- `/home/hbktethg/private/mail-vendor/vendor/autoload.php`

Optional private storage may also include old Node deployment files and backups.

## Private Mail Config

Create `/home/hbktethg/private/mail/mail_config.php` from the template in `deploy/mail_config.example.php`.

Set:
- SMTP host: `mail.lalela.net`
- SMTP port: `587`
- SMTP secure: `tls`
- SMTP user: `admin@lalela.net`
- SMTP password: your real SMTP password
- SMTP from: `admin@lalela.net`
- vendor autoload: `/home/hbktethg/private/mail-vendor/vendor/autoload.php`

## PHPMailer Install

Install PHPMailer outside `public_html`:

```bash
mkdir -p /home/hbktethg/private/mail-vendor
cd /home/hbktethg/private/mail-vendor
composer require phpmailer/phpmailer
```

## Working Routes

- SPA routes work through `.htaccess`
- Invite emails work through `/api/invitations/email`

## Not Used In Static Deployment

These are not part of the live static site:
- Node app runtime
- `.env`
- `GOOGLE_APPLICATION_CREDENTIALS`
- Firebase service account JSON

## Known Static Limitation

`/api/og-image` is not included in the static deployment. The UI falls back to placeholder images when that request fails.

## Verification

1. Confirm `public_html/index.html` is the Lalela app, not the coming-soon page.
2. Confirm `.htaccess` is present in `public_html`.
3. Confirm `public_html/api/invitations/email/index.php` exists.
4. Confirm `/home/hbktethg/private/mail/mail_config.php` exists.
5. Confirm `/home/hbktethg/private/mail-vendor/vendor/autoload.php` exists.
6. Test the live site.
7. Test invite email sending.



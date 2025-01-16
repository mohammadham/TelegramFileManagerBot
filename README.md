# Cloudflare Worker for Telegram File Manager

This Cloudflare Worker handles file uploads and downloads via Telegram bot. It provides permanent download links for files sent to the bot.

## Project Structure
```
cloudflare-worker
├── src
│   └── worker.js
├── wrangler.toml
├── package.json
└── README.md
```

## Setup

1. **Clone the repository:**

    ```sh
    git clone <repository-url>
    cd cloudflare-worker
    ```

2. **Install dependencies:**

    ```sh
    npm install
    ```

3. **Configure the Worker:**

    - Update the  in  with your Telegram bot token from [@BotFather](https://t.me/BotFather).
    - Update the  in  with your Telegram channel username.

4. **Configure Cloudflare Wrangler:**

    - Update the  file with your Cloudflare account details.

## Usage

1. **Build the project:**

    ```sh
    npm run build
    ```

2. **Deploy the Worker:**

    ```sh
    npm run deploy
    ```

3. **Set the Webhook:**

    Set the webhook URL for your Telegram bot to point to your Cloudflare Worker URL:

    ```sh
    curl -F "url=https://<your-worker-url>/webhook" https://api.telegram.org/bot<your-bot-token>/setWebhook
    ```

## Cloudflare Publish Button

You can fork and deploy this project to your Cloudflare account using the button below:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mohammadham/TelegramFileManagerBot)

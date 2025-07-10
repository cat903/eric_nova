module.exports = {
    apps: [
        {
            name: 'autoupdateToken',
            script: './scripts/autoupdateToken.js',
            cron_restart: '*/5 * * * *',
            autorestart: false,
            watch: false
        },
        {
            name: 'serve_api',
            script: './server.js',
            autorestart: false,
            watch: false
        },
        {
            name: 'force_exit',
            script: './scripts/forceExitTrade.js',
            cron_restart: '*/2 * * * *',
            autorestart: false,
            watch: false
        },
        {
            name: 'archiveOrders_daily',
            script: './scripts/archiveOrders.js',
            cron_restart: '30 23 * * 1-5',
            autorestart: false,
            watch: false
        },
        {
            name: 'archiveOrders_friday',
            script: './scripts/archiveOrders.js',
            cron_restart: '0 18 * * 5',
            autorestart: false,
            watch: false
        }
    ]
};


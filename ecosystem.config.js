module.exports = {
    apps: [
        {
            name: 'autoupdateToken',
            script: './autoupdateToken.js',
            cron_restart: '*/10 * * * *',
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
            script: './force_exit.js',
            cron_restart: '*/5 * * * *',
            autorestart: false,
            watch: false
        }
    ]
};

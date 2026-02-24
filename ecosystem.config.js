module.exports = {
  apps: [
    {
      name:     'fdm-admin',
      script:   'server.js',
      env_file: '.env',
      // Reinicio automático si el proceso cae
      autorestart: true,
      // Reinicio si consume más de 300MB de RAM (prevención de leaks)
      max_memory_restart: '300M'
    }
  ]
};

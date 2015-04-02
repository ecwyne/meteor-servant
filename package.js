Package.describe({
  summary: 'Servant OAuth flow',
  version: '0.0.1',
  name: 'ecwyne:servant'
});

Package.onUse(function(api) {
  api.use('oauth2', ['client', 'server']);
  api.use('oauth', ['client', 'server']);
  api.use('http', ['server']);
  api.use('underscore', 'client');
  api.use('templating', 'client');
  api.use('random', 'client');
  api.use('service-configuration', ['client', 'server']);

  Npm.depends({
    'servant-sdk-node': '0.0.25'
  });
  api.export('Servant');
  api.export('ServantAPI');

  api.addFiles(
    ['servant_configure.html', 'servant_configure.js'],
    'client');

  api.addFiles('servant_server.js', 'server');
  api.addFiles('servant_client.js', 'client');
});

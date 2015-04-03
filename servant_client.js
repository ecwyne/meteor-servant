Servant = {};

// Request Servant credentials for the user
// @param options {optional}
// @param credentialRequestCompleteCallback {Function} Callback function to call on
//   completion. Takes one argument, credentialToken on success, or Error on
//   error.
Servant.requestCredential = function (options, credentialRequestCompleteCallback) {
  // support both (options, callback) and (callback).
  if (!credentialRequestCompleteCallback && typeof options === 'function') {
    credentialRequestCompleteCallback = options;
    options = {};
  }

  var config = ServiceConfiguration.configurations.findOne({service: 'servant'});
  if (!config) {
    credentialRequestCompleteCallback && credentialRequestCompleteCallback(
      new ServiceConfiguration.ConfigError());
    return;
  }
  var credentialToken = Random.secret();

  var scope = (options && options.requestPermissions) || [];
  var flatScope = _.map(scope, encodeURIComponent).join('+');

  var loginStyle = OAuth._loginStyle('servant', config, options);

  var loginUrl =
  'https://www.servant.co/connect/oauth2/authorize' +
  '?response_type=code' + 
  '&client_id=' + config.client_id +
  '&state=' + OAuth._stateParam(loginStyle, credentialToken);

  OAuth.launchLogin({
    loginService: 'servant',
    loginStyle: loginStyle,
    loginUrl: loginUrl,
    credentialRequestCompleteCallback: credentialRequestCompleteCallback,
    credentialToken: credentialToken,
    popupOptions: {width: 900, height: 450}
  });
};

Accounts.onLogin(function(){
  var i = Meteor.setInterval(function(){
    if (Accounts.loginServiceConfiguration.find().count() && Meteor.user()){
      console.log('initializing Servant sdk');
      window.Servant.initialize({
        application_client_id: Package['service-configuration'].ServiceConfiguration.configurations.findOne().client_id,
        token: Meteor.user().services.servant.accessToken
      });
      window.Servant.getUserAndServants(function (data){
        Meteor.users.update(Meteor.userId(), {$set: {'profile.servants': data.servants}});
      });
      clearInterval(i);
    }
  }, 1000)
})
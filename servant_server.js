Servant = {};

OAuth.registerService('servant', 2, null, function (query) {

  var accessToken = getAccessToken(query);
  var identity = getIdentity(accessToken);

  return {
    serviceData: {
      id: identity.user._id,
      accessToken: OAuth.sealSecret(accessToken),
      email: identity.user.email
    },
    options: {profile: {name: identity.user.full_name, servants: identity.servants}}
  };
});



var getAccessToken = function (query) {
  var config = ServiceConfiguration.configurations.findOne({service: 'servant'});
  if (!config)
    throw new ServiceConfiguration.ConfigError();

  ServantAPI = Npm.require('servant-sdk-node')({application_client_id: config.client_id, application_client_secret: OAuth.openSecret(config.client_secret)});

  var response;
  try {
    if (query.code){
      response = Meteor.wrapAsync(ServantAPI.exchangeAuthCode, ServantAPI)(query.code);
    } else {
      response = Meteor.wrapAsync(ServantAPI.refreshAccessToken, ServantAPI)(query.refresh_token);
    }
  } catch (err) {
    throw _.extend(new Error("Failed to complete OAuth handshake with Servant. " + err.message),
     {response: err.response});
  }
  return response.access_token;
};

var getIdentity = function (accessToken) {
  try {
    return Meteor.wrapAsync(ServantAPI.getUserAndServants, ServantAPI)(accessToken)
  } catch (err) {
    throw _.extend(new Error("Failed to fetch identity from Servant. " + err.message),
     {response: err.response});
  }
};


Servant.retrieveCredential = function(credentialToken, credentialSecret) {
  return OAuth.retrieveCredential(credentialToken, credentialSecret);
};

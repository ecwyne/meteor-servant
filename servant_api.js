var config = Package['service-configuration'].ServiceConfiguration.configurations.findOne({service: 'servant'})
if (config){
	ServantAPI = Npm.require('servant-sdk-node')({application_client_id: config.client_id, application_client_secret: OAuth.openSecret(config.secret)});
	for (i in ServantAPI){
		if (typeof ServantAPI[i] == 'function'){
			ServantAPI[i] = Meteor.wrapAsync(ServantAPI[i], ServantAPI);
		}
	}
} else {
	console.log('Servant has not yet been configured. API calls to servant-sdk-node will break');
}
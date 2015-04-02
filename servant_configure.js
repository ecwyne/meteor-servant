Template.configureLoginServiceDialogForServant.helpers({
  siteUrl: function () {
    return Meteor.absoluteUrl();
  }
});

Template.configureLoginServiceDialogForServant.fields = function () {
  return [
    {property: 'client_id', label: 'Client ID'},
    {property: 'client_secret', label: 'Client Secret'}
  ];
};

var ERRORS = 'signupErrors';

Template.signup.onCreated(function(){
    Session.set(ERRORS, {});
});

Template.signup.helpers({
    errorMessages: function() {
        return _.values(Session.get(ERRORS));
    }, errorClass: function(key) {
        return Session.get(ERRORS)[key] && 'error';
    }
});

Template.signup.events({
    
    'submit': function(event, template){
        
        event.preventDefault();
        
        var firstName = template.$('[name=firstName]').val();
        var lastName = template.$('[name=lastName]').val();
        var phone = template.$('[name=phone]').val();
        var email = template.$('[name=email]').val();
        var password = template.$('[name=password]').val();
        var confirm = template.$('[name=confirm]').val();

        var errors = {};

        if (!firstName){
            errors.firstName = 'Please enter your first name.';
        }
        
        if (!lastName){
            errors.lastName = 'Please enter your last name.';
        }
        
        if (!email){
            errors.email = 'Please enter your email.';
        }
        
        if (!phone){
            errors.phone = 'Please enter your phone number.';
        }
        
        if(!password){
            errors.password = 'Please enter your password.';
        }
        
        if(confirm !== password){
            errors.confirm = 'Passwords do not match.';
        }
        
        Session.set(ERRORS, errors);
        
        if (_.keys(errors).length) {
            return;
        }
        
        Meteor.call('createAccount', {
	        firstName: firstName,
	        lastName: lastName,
	        email: email,
	        phone: phone,
	        password: password
        }, function(err, res){
	        if(err) {
	            return Session.set(ERRORS, {'none': err.reason});
	        }
	        Meteor.loginWithPassword(email, password);
        })
        
    }
});
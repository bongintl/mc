Router.route('/profile', {
	waitOn: function(){
		return [
			Meteor.subscribe('children'),
			Meteor.subscribe('orders')
		]
	},
    action: function(){
        authorise(this, 'profile');
    }
});

Router.route('/addChild', authoriseThis);

Router.route('/sizes/:childId', {
	name: 'sizes',
    waitOn: function(){
		return Meteor.subscribe('children');
    },
    data: function(){
        return Children.findOne(this.params.childId);
    },
    action: function(){
        authoriseWithData(this, 'sizes');
    }
});

Router.route('/colors/:childId', {
	name: 'colors',
    waitOn: function(){
		return Meteor.subscribe('children');
    },
    data: function(){
        return Children.findOne(this.params.childId);
    },
    action: function(){
        authoriseWithData(this, 'colors');
    }
});

Router.route('/looks/:childId', {
	name: 'looks',
    waitOn: function(){
		return Meteor.subscribe('children');
    },
    data: function(){
        return Children.findOne(this.params.childId);
    },
    action: function(){
        authoriseWithData(this, 'looks');
    }
});

Router.route('/child/:childId', {
	name: 'child',
    waitOn: function(){
		return Meteor.subscribe('children');
    },
    data: function(){
        return Children.findOne(this.params.childId);
    },
    action: function(){
	    
	    var route = this;
	    
	    if(Meteor.user()){
		    
		    var data = route.data();
		    
		    if(data){
		        if(ownsData(route)){
					if(!data.sizing.height || !data.sizing.weight || !data.sizing.shoes){
						route.redirect('/sizes/' + data._id);
					} else if(!data.colors.length){
						route.redirect('/colors/' + data._id);
					} else if(!data.looks.length){
						route.redirect('/looks/' + data._id);
					} else {
						route.render('child');
					}
		        } else {
		            route.render('not-authorised')
		        }
		    } else {
			    route.render('loading');
		    }
	    } else {
	        route.render('login');
	    }
    }
});

Router.route('/account', {
	name: 'account',
	waitOn: function(){
		return Meteor.subscribe('addresses');
	},
	action: function(){
		authorise(this, 'account');
	}
});

Router.route('/order-form/:childId', {
    name: 'orderForm',
    waitOn: function(){
	    return [
		    Meteor.subscribe('garmentTypes'),
		    Meteor.subscribe('addresses')
	    ]
    },
    data: function(){
        return Children.findOne(this.params.childId);
    },
    action: function(){
        authoriseWithData(this, 'orderForm');
    }
});

Router.route('/orders', {
	name: 'orders',
	waitOn: function(){
		return Meteor.subscribe('orders');
	}
})

Router.route('/order/:orderNumber', {
    name: 'order',
    waitOn: function(){
	    return Meteor.subscribe('orders');
    },
    data: function(){
        return Orders.findOne({i2iId: parseInt(this.params.orderNumber)});
    },
    action: function(){
        authoriseWithData(this, 'order');
    }
})

function authoriseWithData(route, template){
    
    if(Meteor.user()){
	    if(route.data()){
	        if(ownsData(route)){
	            route.render(template);
	        } else {
	            route.render('not-authorised')
	        }
	    } else {
		    route.render('loading');
	    }
    } else {
        route.render('login');
    }
    
}

function ownsData(route){
    return Meteor.user().username === 'admin' || route.data().owner === Meteor.userId();
}

function authoriseThis(){
    authorise(this, this.route.getName());
}

function authorise(route, template, data){
    
    if(Meteor.user()){
        route.render(template, data);
    } else {
        route.render('login');
    }
}
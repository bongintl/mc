Template.faq.onRendered(function(){ 

 	this.$('.accordion-toggle').click(function(){
		$(this).next().slideToggle('fast');
		$(".accordion-content").not($(this).next()).slideUp('fast');
    });

})
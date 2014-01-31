/**
 * Displays the login dialog that includes two links, "Forgot Password" and "Sign in".
 */
var ADOBE = ADOBE || {};

ADOBE.LoginDialog = Backbone.View.extend({
	tagName:  "div",
	
	className: "modal-background-grey",
	
	initialize: function() {
		var html  = "<form id='login'>";
		    html +=    "<div class='title'>Sign In<div id='close' src='icon_close.png' /></div>";
		    html +=    "<div class='description'>Please sign in to your account.</div>";
		    html +=    "<input id='username' type='text' name='username' placeholder='Username'/></div>";
		    html +=    "<input id='password' type='password' name='password' placeholder='Password'/></div>";
		
		if (ADOBE.Config.FORGOT_PASSWORD_URL != "")
		    html +=    "<div class='link' id='forgot-password'>Forgot password?</div>";
		
		    html +=    "<div id='submit'>Sign In</div>";
		    html +=    "<div class='error'></div>";
		    
		if (ADOBE.Config.CREATE_ACCOUNT_URL != "")
		    html +=    "<div class='link' id='create-account'>Create an Account</div>";
			
			html += "</form>";
			
		this.template = _.template(html);
	},
	
	render: function() {
		this.$el.html(this.template());
		
		var scope = this;
		this.$el.find("#close").on("click", function() { scope.close() });
		this.$el.find("#submit").on("click", function() { scope.submit_clickHandler() });
		
		this.$el.find("#forgot-password").on("click", function() { ADOBE.Utils.openIFrame(ADOBE.Config.FORGOT_PASSWORD_URL); });
		this.$el.find("#create-account").on("click", function() { ADOBE.Utils.openIFrame(ADOBE.Config.CREATE_ACCOUNT_URL); });
		
		return this;
	},
	
	submit_clickHandler: function() {
		var $username = this.$el.find("#username");
		var $password = this.$el.find("#password");
		
		$("#login .error").html("");
		
		// Make sure username and password are not blank.
		if ($username.val() == "" || $("#password").val() == "") {
			if ($username.val() == "")
				$("#login .error").html("Please enter your username.");
			else if ($password.val() == "")
				$("#login .error").html("Please enter a valid password.");
		} else {
			// Login using the authenticationService.
			var transaction = adobeDPS.authenticationService.login($username.val(), $password.val());
			transaction.completedSignal.addOnce(function(transaction) {
				var transactionStates = adobeDPS.transactionManager.transactionStates;
				if (transaction.state == transactionStates.FAILED) {
					$("#login .error").html("Authentication Failed.")
				} else if (transaction.state == transactionStates.FINISHED){
					this.$el.trigger("loginSuccess");
					this.close();
				}
			}, this);
		}
	},
	
	close: function() {
		this.$el.remove();
	},
	
	// Handler for when a user chooses to restore purchases.
	restore_clickHandler: function() {
		adobeDPS.receiptService.restorePurchases();
		this.close();
	}
});

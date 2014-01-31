$(document).ready(function() {
	function init(isAPIAvailable) {
		// Check to see if there is an internet connection.
		$.ajax({
			type: "HEAD",
			url: "http://stats.adobe.com/",
			success: function() {
				var appView = new ADOBE.AppView(isAPIAvailable, true);
			},
			
			// Display the offline messaging if unable to connect.
			error: function() {
				var appView = new ADOBE.AppView(isAPIAvailable, false);
			}
		})
	}
	
	// To test on the desktop remove the JavaScript include for AdobeLibraryAPI.js.
	if (typeof adobeDPS == "undefined") // This will be the case for dev on the desktop.
		init(false)
	else								// API is available so wait for adobeDPS.initializationComplete.
		adobeDPS.initializationComplete.addOnce(function(){ init(true) });
});
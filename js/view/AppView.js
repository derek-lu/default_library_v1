/**
 * The main application file.
 */
var ADOBE = ADOBE || {};

ADOBE.AppView = Backbone.View.extend({
	el: $("body"),

	// Stores the FolioItemView instances.
	folioItemViewArray: [],
	
	// Displays the grid of folios.
	$grid: null,
	
	// Displays the one-up view of folios.
	$largeView: null,
	
	// Collection of folios.
	libraryCollection: null,
	
	// The HTML for the subscribe buttons.
	subscriptions: "",
	
	isOnline: false,
	
	showMore: null,
	
	// The previous visibility of the "show more" link.
	showMoreWasVisible: null,
	
	folios: null,
	
	// The number of folios to add for each page.
	foliosPerPage: 12,
	
	subscribeDialog: null,

	LBL_SIGN_OUT: "Sign Out",
	LBL_SIGN_IN: "Sign In",
	LBL_RESTORE_ALL_PURCHASES: "Restore All Purchases",
	
	initialize: function(isAPIAvailable, isOnline) {
		// Set a flag for the API availability in the ADOBE namespace.
		ADOBE.isAPIAvailable = isAPIAvailable;
		
		this.isOnline = isOnline;
		
		var loginLbl;
		var isShowSubscriptions;
		if (isAPIAvailable) {
			// Put the FolioStates in the ADOBE namespace for easier lookup later.
			ADOBE.FolioStates = adobeDPS.libraryService.folioStates;
			
			this.folios = [];
			// Sort the folios descending.
			var list = adobeDPS.libraryService.folioMap.sort(function (a, b) {
				if (a.publicationDate < b.publicationDate)
					return 1;
				else if (a.publicationDate > b.publicationDate)
					return -1;
				else
					return 0;
			});
	 
			// list is an associative array so put them in a regular array.
			for (var i in list) {
				var folio = list[i];
				if (this.isOnline) { // User is online so display all the folios.
					this.folios.push(folio);
				} else {			// User is offline so only display the installed folios.
					if (folio.state == ADOBE.FolioStates.INSTALLED)
						this.folios.push(folio);
				}
			}
			
			var userOwnsLatestFolio = false;
			// If the latest folio is not purchasable then the user is entitled to it.
			// If true then do not display the subscription button.
			if (this.folios.length > 0) {
				var latestFolio = this.folios[0];
				userOwnsLatestFolio = !(latestFolio.state == ADOBE.FolioStates.PURCHASABLE || latestFolio.state == ADOBE.FolioStates.UNAVAILABLE || latestFolio.state == ADOBE.FolioStates.INVALID);
			} else if (!this.isOnline) { // Folio list is empty and user is not online.
				alert("Please connect to the internet to download issues.");
				return;
			}

			if (!userOwnsLatestFolio) {
				// Loop through the subscriptions and populate the buttons.
				var availableSubscriptions = adobeDPS.receiptService.availableSubscriptions;
				for (var s in availableSubscriptions) {
					var availableSubscription = availableSubscriptions[s];
					if (availableSubscription.isActive()) { // Users owns a subscription so do not display the subscription menu option. 
						isShowSubscriptions = false;
						break;
					} else { // Create a string for the subscription buttons.
						this.subscriptions += "<div class='subscribe-button' id='" + availableSubscription.productId + "'>" + availableSubscription.duration + " subscription for " + availableSubscription.price + "</div>";
						isShowSubscriptions = true;
					}
				}
			}
			
			// Determine the login label for the drop down menu.
			loginLbl = adobeDPS.authenticationService.isUserAuthenticated ? this.LBL_SIGN_OUT: this.LBL_SIGN_IN;
		} else { // Placeholder values for testing on the desktop.
			this.subscriptions += "<div class='subscribe-button' id='1year'>1 Year Subscription for $12.99</div>";
			this.subscriptions += "<div class='subscribe-button' id='1month'>1 Month Subscription for $1.99</div>";
			loginLbl = this.LBL_SIGN_IN;
		}
		
		var html = "";

		if (ADOBE.Config.IS_ENTITLEMENT_VIEWER) {
			// Displays the entitlement banner if this is an entitlement viewer.
			// Code should be added to allow a user to register. Keep in mind that
			// <a> tags open in the current window.
			html += "<div id='banner'>";
			html += "</div>"
		}

			html += "<div id='header'>";
			html += 	"<div id='header-left-column-container'>";
			// If API is not available then testing on the desktop so show the button, otherwise only if this is an entitlement viewer.
		if (!isAPIAvailable || ADOBE.Config.IS_ENTITLEMENT_VIEWER)
			html +=     	"<div id='print-subscriber-login'>" + loginLbl + "</div>";

			// If API is not available then testing on the desktop so show the button, otherwise only if subscriptions are available.
			html +=     	"<div id='subscribe'>Subscribe</div>";
			html +=		"</div>";

		if (ADOBE.Config.IS_HEADER_TEXT)
			html +=		"<div id='title'>Local</div>";
		else
			html +=		"<img id='title-image' src=''>";
			
			var index = ADOBE.Config.IS_ONE_UP_VIEW_DEFAULT || window.isOneUpViewDefault == "one-up" ? 0 : 1; // window.isOneUpViewDefault is set from the configurator.
			html +=     "<div class='navbar' id='navbar' default-selected-index='" + index + "'>";
			html +=         "<div off-skin-style='view-toggle-big-off' on-skin-style='view-toggle-big-on'></div>";
			html +=         "<div off-skin-style='view-toggle-grid-off' on-skin-style='view-toggle-grid-on'></div>";
			html +=     "</div>";

			html +=     "<div class='drop-down' id='header-drop-down'>";
			html +=         "<div id='restore-all-purchases'>" + this.LBL_RESTORE_ALL_PURCHASES + "</div>";

		// If testing on desktop then include the switch otherwise make sure it is supported.
		if (!isAPIAvailable || adobeDPS.settingsService.autoArchive.isSupported)
			html +=     	"<div id='auto-archive' class='flip-switch' state='" + (!isAPIAvailable || adobeDPS.settingsService.autoArchive.isEnabled ? "on" : "off") + "'>Auto Archive</div>";

			html +=     "</div>";
		    html += "</div>";

		    // The container to hold the grid of folios.
		    html += "<div id='grid'>";
			html += 	"<div id='subscription-tile'></div>";
			html += 	"<div id='loading'>Loading...</div>";
		    html += "</div>"
		    html += "<div id='show-more'>Show More <img src='images/icon_down_arrow.png'></div>"

		// Uncomment the textarea below to enable debug output via debug().
		//html += "<textarea class='debug'></textarea>";
		window.debug = function(value) {
			$(".debug").val($(".debug").val() + ($(".debug").val() == "" ? "" : "\n") + value);
		}
		
		$("body").html(html);
		
		$("body").addClass("grid");
		this.$grid = $("#grid");
		
		if (isAPIAvailable && (!isShowSubscriptions || userOwnsLatestFolio)){
			$("#subscribe").css("display", "none");
			$("#subscription-tile").css("display", "none");
		}
		
		// Entitlement banner isn't displayed so add spacing.
		if (!ADOBE.Config.IS_ENTITLEMENT_VIEWER) {
			this.$grid.css("margin-top", 23);
		} else {
			$("#banner").on("click", function() {
				ADOBE.Utils.openIFrame(ADOBE.Config.BANNER_TARGET_URL);
			});
		}
		
		// Init the controls.
		$("#navbar").navbar();
		$("#header-drop-down").dropDown({verticalGap: 12});
		
		this.showMore = $("#show-more");
		
		var scope = this;
		
		// Handler for the auto archive switch in the drop down.
		$("body").on("change", "#auto-archive", function(e, isOn){ scope.autoArchive_changeHandler(e, isOn) });

		// Handler for the drop down menu.
		$("body").on("change", "#header-drop-down", function(e){ scope.header_dropDownChangeHandler(e) });
		
		// Toggles between grid and one-up view.
		$("#navbar").on("change", function(e){ scope.navbar_changeHandler(e) });
		
		// Click handler for "show more" link at the bottom of the grid.
		this.showMore.on("click", function(){ scope.addFolios() });
		
		// Click handler for the subscibe button and tile.
		$("#subscribe, #subscription-tile").on("click", function(){ scope.displaySubscribeDialog() });
		
		// Click handler for the login dialog.
		$("#print-subscriber-login").on("click", function(){ scope.displayLoginDialog() });
		
		$("#banner-right").on("click", function() { scope.displayCreateAccount() });
		
		$(window).on("resize", function(){ scope.setGridHeight() });
		
		$("body").on("subscribeButtonClicked", function(){ scope.displaySubscribeDialog() });
		
		if (ADOBE.isAPIAvailable) {
			// The collection creates a clone of the folio objects so addFolios() passes a reference to the object.
			// Since the folios are not on a server we don't need to load anything so pass the folios to the constructor.
			this.libraryCollection = new ADOBE.LibraryCollection(this.folios);
			
			// Add the folios which are currently available. On the first launch this
			// does not guarentee that all folios are immediately available. The callback
			// below for folioMap.addedSignal will handle folios which are added after
			// startup. Added does not mean, pushed from folio producer, rather they
			// are folios that the viewer becomes aware of after startup.
			this.addFolios();
			
			// Add a listener for when new folios are added.
			adobeDPS.libraryService.folioMap.addedSignal.add(function(folios) {
				for (var i = 0; i < folios.length; i++) {
					scope.addFolio(folios[i]);
				}
			}, this);
		} else {
			_.bindAll(this, "addFolios");
			this.libraryCollection = new ADOBE.LibraryCollection();
			this.libraryCollection.url = ADOBE.Config.FULFILLMENT_URL;
			this.libraryCollection.on("all", this.addFolios);
			this.libraryCollection.fetch({dataType: "xml"});
		}
		
		if (ADOBE.Config.IS_ONE_UP_VIEW_DEFAULT || window.isOneUpViewDefault == "one-up") // window.isOneUpViewDefault is set from the configurator.
			this.navbar_changeHandler({currentTarget: $("#navbar")});
		
		// Global function for the configurator to switch views.
		window.setView = function(value) {
			var selectedIndex = $("#navbar").navbar("getSelectedIndex");
			var newIndex;
			if (value == "one-up") {
				newIndex = 0;
			} else {
				newIndex = 1;
			}
			
			if (newIndex != selectedIndex) {
				$("#navbar").navbar("setSelectedIndex", newIndex);
				scope.navbar_changeHandler({currentTarget: $("#navbar")});
			}
		};
		
		// Add to global for the configurator to set values.
		window.Config = ADOBE.Config;
	},
	
	addFolios: function() {
		if (this.libraryCollection.length > 0)
			$("#loading").remove();
		else
			return;
			
		var startIndex = this.getNumFoliosVisible();
		var endIndex = Math.min(startIndex + this.foliosPerPage, this.libraryCollection.length);
		for (var i = startIndex; i < endIndex; i++) {
			// When using the DPS api this is a clone of the original folio.
			var folio = this.libraryCollection.at(i);
			
			// Testing on the desktop so create the path to the image.
			if (!ADOBE.isAPIAvailable)
				folio.attributes.libraryPreviewUrl +=  "/portrait";
				
			var view = new ADOBE.FolioItemView({model: folio});
			var el = view.render().el;
			this.$grid.append(el);
			
			this.folioItemViewArray.push(view);
		}
		
		// Testing on the desktop and the XML has loaded so explicitly set the data.
		if (!ADOBE.isAPIAvailable && (ADOBE.Config.IS_ONE_UP_VIEW_DEFAULT || window.isOneUpViewDefault == "one-up")) // window.isOneUpViewDefault is set from the configurator.
			$("#large-view").slideshow("setData", this.libraryCollection);
			
		this.updateNavStatus();
		
		this.setGridHeight();
	},

	getNumFoliosVisible: function() {
		return this.$grid.children().length - 1;
	},
	
	// This will be triggered when folios are added through the API.
	addFolio: function(folio) {
		$("#loading").remove();
		
		var len = this.folios.length;
		// Find the insert index. Folios are sorted by publicationDate with the most recent first.
		for (var i = 0; i < len; i++) {
			if (folio.publicationDate >= this.folios[i].publicationDate)
				break;
		}
		
		// Add the folio to the collection.
		this.libraryCollection.add(folio, {at: i});
		
		if (this.slideshowCollection && folio.state >= ADOBE.FolioStates.PURCHASABLE)
			this.slideshowCollection.add(folio);
		
		// Add the folio to the folios.
		this.folios.splice(i, 0, folio);
		
		// Figure out if the user has or is entitled to the latest folio or has a subscription covering today's date.
		// If the latest folio is not purchasable then the user is entitled to it.
		// If true then do not display the subscription button or tile.
		var userOwnsLatestFolio = false;
		if (this.folios.length > 0) {
			var latestFolio = this.folios[0];
			userOwnsLatestFolio = latestFolio.state != ADOBE.FolioStates.PURCHASABLE;
		}

		if (!userOwnsLatestFolio) {
			var availableSubscriptions = adobeDPS.receiptService.availableSubscriptions;
			for (var s in availableSubscriptions) {
				var availableSubscription = availableSubscriptions[s];
				if (availableSubscription.isActive()) { // Users owns a subscription so do not display the subscription menu option. 
					userOwnsLatestFolio = true;
					break;
				}
			}
		}
		
		// Figure out if this folio should be dispayed.
		// Folios can be added in any order so see if this folio is within the range of publication
		// dates of the folios that are currently displayed.
		var numFoliosDisplayed = this.getNumFoliosVisible();
		var endIndex = Math.max(this.foliosPerPage, numFoliosDisplayed);
		if (i < endIndex) {
			var view;
			// See more button is visible so remove the last folio view before inserting a new one.
			if (numFoliosDisplayed >= this.foliosPerPage) {
				$("#grid div.folio-item-view:last-child").remove();
				 view = this.folioItemViewArray.pop();
				 view.clear();
			}
				
			view = new ADOBE.FolioItemView({model: this.libraryCollection.at(i)});
			var el = view.render().el;
			
			if (numFoliosDisplayed == 0)
				this.$grid.append(el);
			else
				$("#grid div.folio-item-view").eq(i).before(el);
				
			this.folioItemViewArray.splice(i, 0, view);
		}
		
		// Hide the subscribe button and tile.
		if (userOwnsLatestFolio) {
			$("#subscribe").css("display", "none");
			$("#subscription-tile").css("display", "none");
			// Hide the subscribe button from the first folio.
			this.folioItemViewArray[0].showSubscribeButton(false);

			if (this.$largeView && $("#large-view").slideshow("getSelectedIndex") == 0)
				$("#large-view").slideshow("getSelectedRenderer").showSubscribeButton(false);
			
			this.folios[0].isShowSubscribeButton = false;
		} else {
			// Only the first folio should display the subscribe button.
			this.folioItemViewArray[0].showSubscribeButton(true);
			
			if (this.$largeView && $("#large-view").slideshow("getSelectedIndex") == 0)
				$("#large-view").slideshow("getSelectedRenderer").showSubscribeButton(true);

			this.folios[0].isShowSubscribeButton = true;
		}
		
		// In case a folio was added at the zero index then hide
		// the subscribe button of the previous visible subscribe button.
		this.folioItemViewArray[1].showSubscribeButton(false);
		this.folios[1].isShowSubscribeButton = false;
		
		this.setGridHeight();
	},
	
	setGridHeight: function() {
		var windowWidth = $(window).width();
		// Need to explicitly set the width otherwise it doesn't always update if width=100% in css.
		$("#header").width(windowWidth);
		var numFoliosDisplayed = this.getNumFoliosVisible();
		this.$grid.css("height", Math.ceil(numFoliosDisplayed / 2) * (windowWidth > $(window).height() ? 177 : 222));
		this.showMore.css("display", numFoliosDisplayed < this.libraryCollection.length ? "block" : "none");
	},
	
	// Handler for the drop down menu.
	header_dropDownChangeHandler: function(e) {
		var selectedLabel = $(e.target).dropDown("getSelectedLabel");
		if (selectedLabel == this.LBL_RESTORE_ALL_PURCHASES) {	// Display the restore dialog.
			var restoreDialog = new ADOBE.RestoreDialog();
			$("body").append(restoreDialog.render().el);
			restoreDialog.open();
		}
	},
	
	displayLoginDialog: function() {
		if (!ADOBE.isAPIAvailable || !adobeDPS.authenticationService.isUserAuthenticated) {
			var loginDialog = new ADOBE.LoginDialog();
			$("body").append(loginDialog.render().el);
			
			var scope = this;
			// Triggered from the dialog when a login is successful.
			loginDialog.$el.on("loginSuccess", function() {
				$("#print-subscriber-login").html(scope.LBL_SIGN_OUT);
				
				if (scope.slideshowCollection) {
					setTimeout(function() {
						scope.setSlideshowCollection();
						$("#large-view").slideshow("setData", scope.slideshowCollection);
						scope.updateNavStatus();
					}, 1000);
				}
			});
		} else {
			var transaction = adobeDPS.authenticationService.logout();
			
			if (this.slideshowCollection) {
				transaction.completedSignal.addOnce(function() {
					if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
						var scope = this;
						setTimeout(function() {
							scope.setSlideshowCollection();
							$("#large-view").slideshow("setData", scope.slideshowCollection);
							scope.updateNavStatus();
						}, 1000);
					}
				}, this);
			}
			$("#print-subscriber-login").html(this.LBL_SIGN_IN);
		}
	},
	
	displaySubscribeDialog: function() {
		if (!this.subscribeDialog) {
			this.subscribeDialog = new ADOBE.SubscribeDialog({model: this.subscriptions});

			var scope = this;
			this.subscribeDialog.$el.on("subscribeDialogClosed", function() {
				scope.subscribeDialog = null;
			});
			
			$("body").append(this.subscribeDialog.render().el);
			
			// Triggered from the dialog when a purchase is successful.
			$("body").on("subscriptionPurchased", function() {
				// Remove the subscribe button from the dropdown.
				$("#subscribe").css("display", "none");
				$("#subscription-tile").css("display", "none");
				
				scope.folioItemViewArray[0].showSubscribeButton(false);
				
				if (scope.$largeView && $("#large-view").slideshow("getSelectedIndex") == 0)
					$("#large-view").slideshow("getSelectedRenderer").showSubscribeButton(false);
		
				scope.folios[0].isShowSubscribeButton = false;
				
				$("body").off("subscriptionPurchased");
			});
		}
	},
	
	// Handler for when a user changes the auto archive setting.
	autoArchive_changeHandler: function(e, isOn) {
		adobeDPS.settingsService.autoArchive.toggle(isOn);
	},
	
	updateNavStatus: function() {
		if (this.$largeView) {
			$("#nav-status-current-page").html(this.slideshowCollection.length - $("#large-view").slideshow("getSelectedIndex"));
			$("#nav-status-num-folios").html(this.slideshowCollection.length);
		}
	},
	
	// Handler for toggling the view between one-up and grid view.
	navbar_changeHandler: function(e) {
		var selectedIndex = $(e.currentTarget).navbar("getSelectedIndex");
		if (selectedIndex == 0) { // Display the large view.
			$("#banner").css("display", "none");
			this.$grid.css("display", "none");
			this.showMoreWasVisible = this.showMore.css("display") == "block";
			this.showMore.detach();
			
			$("body").removeClass("grid");
			$("body").addClass("large-view");
			
			var isInited = true;
			if (!this.$largeView) {
				var numFolios = this.libraryCollection.length;
				this.$largeView = $("<div id='large-view-wrapper'><div id='large-view' class='slideshow'></div><div class='nav-status'><span id='nav-status-current-page'>" + numFolios + "</span> of <span id='nav-status-num-folios'>" + numFolios + "</span></div></div>");
				this.$largeView.appendTo("body");
				isInited = false;
			}
			
			this.$largeView.css("display", "block");
			
			if (!isInited) {
				this.setSlideshowCollection();
				$("#large-view").slideshow({
											renderer: ADOBE.LargeFolioItemView, // Renders each item in the slideshow.
											data: this.slideshowCollection,		// The data used to pass to each renderer.
											portraitItemWidth: 520,				// The width of each item.
											landscapeItemWidth: 653,
											horizontalGap: 30
										   });
				
				this.updateNavStatus();
				var scope = this;
				// Add a listener for when a swipe ends so the nav status is updated.
				$("#large-view").on("webkitTransitionEnd", function(e){ scope.updateNavStatus() });
			}
		} else { // Display the grid view. This is the default view.
			$("#banner").css("display", "block");
			this.$largeView.css("display", "none");
			this.$grid.css("display", "block");
			
			$("body").removeClass("large-view");
			$("body").addClass("grid");

			if (this.showMoreWasVisible)
				this.showMore.appendTo("body");
		}
	},
	
	setSlideshowCollection: function() {
		this.slideshowCollection = new Backbone.Collection(this.libraryCollection.toJSON());
		this.slideshowCollection.comparator = function(model) {	return -model.get("publicationDate") };
		
		if (ADOBE.isAPIAvailable) {
			var startIndex = this.slideshowCollection.length - 1;
			for (var i = startIndex; i >= 0; i--) {
				var folio = adobeDPS.libraryService.folioMap.internal[this.slideshowCollection.at(i).attributes.id];
				if (folio.state < ADOBE.FolioStates.PURCHASABLE) {
					this.slideshowCollection.remove(folio);
				}
			}	
		}
			
	}
});
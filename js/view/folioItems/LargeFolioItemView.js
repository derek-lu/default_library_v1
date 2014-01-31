/**
 * Displays a folio in the one up view.
 */
var ADOBE = ADOBE || {};

ADOBE.LargeFolioItemView = Backbone.View.extend({
	tagName:  "div",
	
	className: "large-folio-item-view",
	
	initialize: function() {
		var html  = "<div class='folio-image-container'><img id='folio-image' onmousedown='return false'/></div>";
		    html += "<div class='off-fade'></div>";
		    html += "<div class='row'>";
		    html +=     "<div class='left'>";
		    html +=         "<div class='magazine-title'><%= title %></div>";
			html +=			"<div class='folio-number'><%= folioNumber %></div>";
		    html +=     "</div>";
		    html +=     "<div class='right'>";
		    html +=         "<div class='button-row'><div class='grey-button button' id='left-button'>Archive</div><div class='grey-button button' id='buy-button'></div></div>";
		    html +=         "<div class='state'>FREE</div>";
		    html +=     "</div>";
		    html += "</div>";
			
		this.template = _.template(html);
	},
	
	updateDialog: null,
	
	isTrackingTransaction: false,
	
	// A reference to the current downloadTransaction. Used to pause and resume a download.
	currentDownloadTransaction: null,
	
	// A reference to the original folio since the collection uses a cloned copy.
	folio: null,
	
	isBuyButtonEnabled: true,
	
	previewImageTransaction: null,

	// Flag to track whether or not the download button initiated a download.
	// If it was clicked and the folio is viewable && Config.IS_AUTO_OPEN_DOWNLOADED_FOLIO then automatically open the folio.
	// This will not be the case if a user toggled views and a download is resumed.
	downloadButtonWasClicked: false,

	render: function() {
		if (this.model) {
			var json = this.model.toJSON();
			this.$el.html(this.template(json));

			if (this.folio && this.folio.id == json.id)
				return;

			if (ADOBE.isAPIAvailable) {
				this.clear();
					
				// Get a reference to the original folio object.
				this.folio = adobeDPS.libraryService.folioMap.internal[this.model.attributes.id];

				// Load the preview image.
				// Hide the img before it loads otherwise a grey border is visible.
				this.$el.find("#folio-image").css("visibility", "hidden");
				this.previewImageTransaction = this.folio.getPreviewImage(600, 800, true);
				this.previewImageTransaction.completedSignal.addOnce(this.getPreviewImageHandler, this);
				
				this.showLeftButton(false);
				this.showDownloadStatus(false);
				
				if (this.folio.isShowSubscribeButton)
					this.showSubscribeButton(true);

				this.updateView();

				// Add the handlers for the buttons.
				var scope = this;
				this.$el.find("#buy-button").on("click", function() { scope.buyButton_clickHandler() });
				this.$el.find("#left-button").on("click", function() { scope.leftButton_clickHandler() });
				
				// Add a handler to listen for updates.
				this.folio.updatedSignal.add(this.updatedSignalHandler, this);
	
				// Determine if the folio was in the middle of downloading.
				// If the folio is downloading then find the paused transaction and resume.
				if (this.folio.state == ADOBE.FolioStates.DOWNLOADING) {
					var transactions = this.folio.currentTransactions;
					var len = transactions.length;
					for (var i = 0; i < len; i++) {
						var transaction = transactions[i];
						if (transaction.state == adobeDPS.transactionManager.transactionStates.PAUSED ||
							transaction.state == adobeDPS.transactionManager.transactionStates.ACTIVE) {
							if (transaction.state == adobeDPS.transactionManager.transactionStates.PAUSED)
								transaction.resume();
							
							transaction.stateChangedSignal.add(this.download_stateChangedSignalHandler, this);
							transaction.progressSignal.add(this.download_progressSignalHandler, this);
							transaction.completedSignal.add(this.download_completedSignalHandler, this);
							this.currentDownloadTransaction = transaction;
							break;
						}
					}
				}
			} else { // Testing on the desktop.
				this.$el.find("#folio-image").attr("src", json.libraryPreviewUrl);
				this.$el.find(".state").html("$.98");
				this.$el.find("#buy-button").html("Buy");
			}
		} else {
			this.$el.html("");
			this.clear();
		}
		
		return this;
	},
	
	getPreviewImageHandler: function(transaction) {
		if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED && transaction.previewImageURL != null) {
			this.$el.find("#folio-image").attr("src", transaction.previewImageURL);
			this.$el.find("#folio-image").css("visibility", "visible");
		} else if (transaction.previewImageURL == null) { // Sometimes previewImageURL is null so attempt another reload.
			var scope = this;
			this.reloadAttemptTimeout = setTimeout(function() {
				scope.previewImageTransaction = scope.folio.getPreviewImage(600, 800, true);
				scope.previewImageTransaction.completedSignal.addOnce(scope.getPreviewImageHandler, scope);
			}, 200);
		}
	},
	
	clear: function() {
		this.$el.off();
		this.$el.find("#buy-button").off();
		this.$el.find("#left-button").off();
		
		// Since these renderers are recycled, make sure to remove listeners.
		if (this.folio) {
			this.folio.updatedSignal.remove(this.updatedSignalHandler, this);
			this.folio = null;
			
			this.previewImageTransaction.completedSignal.remove(this.getPreviewImageHandler, this);		
		}
		
		if (this.currentDownloadTransaction) {
			this.currentDownloadTransaction.stateChangedSignal.remove(this.download_stateChangedSignalHandler, this);
			this.currentDownloadTransaction.progressSignal.remove(this.download_progressSignalHandler, this);
			this.currentDownloadTransaction.completedSignal.remove(this.download_completedSignalHandler, this);
			this.currentDownloadTransaction = null;
		}
		
		this.showSubscribeButton(false);
		
		clearTimeout(this.reloadAttemptTimeout);
	},
	
	updatedSignalHandler: function(properties) {
		this.updateView();
		
		// The buy button is disabled before downloading so if it is made viewable
		// during the download then enable it again. 
		if (properties.indexOf("isViewable") > -1 && this.folio.isViewable) {
			this.enableBuyButton(true);
			
			if (this.downloadButtonWasClicked && ADOBE.Config.IS_AUTO_OPEN_DOWNLOADED_FOLIO)
				this.folio.view();
		}

		if ((properties.indexOf("state") > -1 || properties.indexOf("currentTransactions") > -1) && this.folio.currentTransactions.length > 0)
			this.trackTransaction();
	},
	
	// Updates the label of the buy button and state based on folio.state.
	updateView: function() {
		var state = "";
		var label = "";
		switch (this.folio.state) {
			case ADOBE.FolioStates.INVALID:
				state = "Invalid";
				label = "Error";
				break;
			case ADOBE.FolioStates.UNAVAILABLE:
				state = "Unavailable";
				label = "Error";
				break;
			case ADOBE.FolioStates.PURCHASABLE:
				state = this.folio.price;
				label = "Buy";
				break;
			case ADOBE.FolioStates.ENTITLED:
				this.showLeftButton(false);
				this.showDownloadStatus(false);
				this.enableBuyButton(true);
				
				state = this.folio.isFree() ? "FREE" : "Purchased";
				label = "Download";
				break;
			case ADOBE.FolioStates.DOWNLOADING:
				if (!this.folio.isViewable)
					this.enableBuyButton(false);
				
				this.showDownloadStatus(true);
				this.showLeftButton(true);
				this.setLeftButtonLabel("Cancel");
				
				if (!this.currentDownloadTransaction || (this.currentDownloadTransaction && this.currentDownloadTransaction.progress == 0)) {
					this.setDownloadPercent(0);
					state = "Waiting";
				} else {
					// Set state to the current state otherwise it will flash.
					state = this.$el.find(".state").html();
				}
				
				label = "View";
				break;
			case ADOBE.FolioStates.INSTALLED:
				this.showDownloadStatus(false);
				this.showLeftButton(true);
				this.setLeftButtonLabel("Archive");

				label = "View";
				break;
			case ADOBE.FolioStates.PURCHASING:
				label = "View";
				break;
			case ADOBE.FolioStates.EXTRACTING:
			case ADOBE.FolioStates.EXTRACTABLE:
				state = "Extracting";
				label = "View";
				break;
		}
		
		// Never display the subscribe button if the user is entitled to the folio.
		if (this.folio.state > 101)
			this.showSubscribeButton(false);
		
		this.$el.find(".state").html(state);
		this.$el.find("#buy-button").html(label);
	},

	trackTransaction: function() {
		if (this.isTrackingTransaction)
			return;
	
		var transaction;
		for (var i = 0; i < this.folio.currentTransactions.length; i++) {
	        transaction = this.folio.currentTransactions[i];
	        if (transaction.isFolioStateChangingTransaction()) {
	            // found one, so break and attach to this one
	            break;
	        } else {
	            // null out transaction since we didn't find a traceable one
	            transaction = null;
	        }
	    }
	
		if (!transaction)
			return;
		
		var transactionType = transaction.jsonClassName;
		if (transactionType != "DownloadTransaction" &&
			transactionType != "UpdateTransaction" &&
			transactionType != "PurchaseTransaction" &&
			transactionType != "ArchiveTransaction" &&
			transactionType != "ViewTransaction") {
				return;
		}
			
		// Check if the transaction is active yet
		if (transaction.state == adobeDPS.transactionManager.transactionStates.INITALIZED) {
			// This transaction is not yet started, but most likely soon will
			// so setup a callback for when the transaction starts
			transaction.stateChangedSignal.addOnce(this.trackTransaction, this);
			return;
		}
		
		this.isTrackingTransaction = true;
		
		this.currentDownloadTransaction = null;
		if (transactionType == "DownloadTransaction" || transactionType == "UpdateTransaction") {
			transaction.stateChangedSignal.add(this.download_stateChangedSignalHandler, this);
			transaction.progressSignal.add(this.download_progressSignalHandler, this);
			transaction.completedSignal.add(this.download_completedSignalHandler, this);
			this.currentDownloadTransaction = transaction;
		} else {
			var state;
			if (transactionType == "PurchaseTransaction")
				state = "Purchasing...";
			else if (transactionType == "ArchiveTransaction")
				state = "Archiving...";
			else if (transactionType == "ViewTransaction")
				state = "Loading...";
			
			this.$el.find(".state").html(state);
			
			// Add a callback for the transaction.
			transaction.completedSignal.addOnce(function() {
				this.$el.find(".state").html("");
				this.isTrackingTransaction = false;
				
				// If this was an archive transaction then hide the button.
				if (transactionType == "ArchiveTransaction")
					this.showLeftButton(false);
			}, this)
		}
	},
	
	// Handler for when a user clicks the buy button.
	buyButton_clickHandler: function() {
		var state = this.folio.state;
		
		if (state == ADOBE.FolioStates.PURCHASABLE) {
			this.purchase();
		} else if (state == ADOBE.FolioStates.INSTALLED || this.folio.isViewable) {
			if (this.folio.isUpdatable)
				this.displayUpdateDialog();
			else
				this.folio.view();
		} else if (state == ADOBE.FolioStates.ENTITLED) {
			if (this.isBuyButtonEnabled)
				this.folio.download();
		}
		
		this.downloadButtonWasClicked = true;
	},
	
	// Handler for when a user clicks archive/subscribe/cancel.
	leftButton_clickHandler: function() {
		if (this.folio.state == ADOBE.FolioStates.DOWNLOADING) {
			if (!this.currentDownloadTransaction)
				return;
			
			if (this.$el.find("#left-button").html() == "Resume") {
				this.$el.find(".state").html("Waiting");	
				this.currentDownloadTransaction.resume();
			} else{
				this.currentDownloadTransaction.cancel();
			}
		} else if (this.folio.state == ADOBE.FolioStates.INSTALLED){
			try {
				var transaction = this.folio.archive();
				transaction.completedSignal.addOnce(function(transaction) {
					if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED)
						this.showLeftButton(false);
				}, this);
			} catch (e) {
				alert("Unable to archive: " + e);
			}
		}
	},
	
	// Changes the opacity of the buyButton to give an enabled or disabled state.
	enableBuyButton: function(value) {
		this.$el.find("#buy-button").css("opacity", value ? 1 : .6);
		
		this.isBuyButtonEnabled = value;
	},
	
	// Purchases the folio.
	purchase: function() {
		var transaction = this.folio.purchase();
		transaction.completedSignal.addOnce(function(transaction) {
			if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
				this.isTrackingTransaction = false;
				this.folio.download();
				this.showSubscribeButton(false);
			} else if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
				alert("Sorry, unable to purchase");
			}
			
			this.updateView();
		}, this);
	},
	
	// Displays the dialog for confirmation of whether or not to update the folio.
	displayUpdateDialog: function() {
		var desc = "An updated version of " + this.folio.title + " is available. Do you want to download this update now?";
		var html  = "<div id='update-dialog-modal-background' class='modal-background'>"; // Make the dialog modal.
			html +=     "<div id='update-dialog' class='dialog'>";
			html += 	    "<p id='description'>" + desc + "</p>";
			html += 	    "<button id='no'>No</button><button id='yes'>Yes</button>";
			html +=     "</div>";
			html += "</div>";

		this.updateDialog = $(html);
		
		this.updateDialog.appendTo("body");
		
		$("#update-dialog").addClass("pop");
		$("#update-dialog-modal-background").css("display", "inline");
		
		var scope = this;
		$("#update-dialog").on("click", "#no", function() { scope.no_updateDialogHandler() });
		$("#update-dialog").on("click", "#yes", function() { scope.yes_updateFolio() });
	},
	
	// Handler for the "Yes" button of the update dialog.
	yes_updateFolio: function() {
		this.updateDialog.remove();
		this.folio.update();
	},
	
	// Handler for the "No" button of the update dialog.
	no_updateDialogHandler: function() {
		this.updateDialog.remove();
		this.folio.view();
	},
	
	// Downloads are automatically paused if another one is initiated so watch for changes with this callback.
	download_stateChangedSignalHandler: function(transaction) {
		if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
			//alert("Unable to download folio.");
			//this.download_completedSignalHandler(transaction);
			//this.updateView();
			//this.enableBuyButton(true);
		} else if (this.currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
			this.$el.find(".state").html("Download Paused");
			this.setLeftButtonLabel("Resume");
		} else {
			this.setLeftButtonLabel("Cancel");
		}
	},
	
	// Updates the progress bar for downloads and updates.
	download_progressSignalHandler: function(transaction) {
		this.setDownloadPercent(transaction.progress);
	},
	
	// Handler for when a download or update completes.
	download_completedSignalHandler: function(transaction) {
		transaction.stateChangedSignal.remove(this.download_stateChangedSignalHandler, this);
		transaction.progressSignal.remove(this.download_progressSignalHandler, this);
		transaction.completedSignal.remove(this.download_completedSignalHandler, this);
		this.isTrackingTransaction = false;
	},
	
	// Displays/Hides the download/update progress bar.
	showDownloadStatus: function(value) {
		if (value) {
			if (!this.downloadStatus) {
				var html  = "<div class='progress-track'><div class='progress-bar' /></div>";
					html += "</div>";
				
				this.downloadStatus = $(html);
				this.$el.find(".right").append(this.downloadStatus);
			}
		} else {
			if (this.downloadStatus) {
				this.downloadStatus.remove();
				this.downloadStatus = null;
			}
		}
	},
	
	// Sets the download progress bar.
	setDownloadPercent: function(value) {
		value *= .01;
		
		var maxWidth = 205; // 205 is max width of track.
		this.$el.find(".progress-bar").css("width", Math.min(maxWidth * value, maxWidth));
		
		this.$el.find(".state").html(Math.round(value * (this.folio.downloadSize / 1000000)) + " MB of " + Math.round(this.folio.downloadSize / 1000000) + " MB");
	},
	
	setState: function(value) {
		if (value == "on") {
			this.$el.find(".off-fade").css("opacity", 0);
			this.$el.find(".row").css("opacity", 1);
			this.$el.find(".progress-bar-middle").css("opacity", 1);
		} else if (value == "off") {
			this.$el.find(".off-fade").css("opacity", .5);
			this.$el.find(".row").css("opacity", 0);
			this.$el.find(".progress-bar-middle").css("opacity", 0);
		}
	},
	
	setLeftButtonLabel: function(value) {
		this.$el.find("#left-button").html(value);
	},

	// This button is only visible during download or if the folio is downloaded.
	showLeftButton: function(value) {
		this.$el.find("#left-button").css("display", value ? "inline-block" : "none");
	},

	showSubscribeButton: function(value) {
		if (value) {
			if (this.$el.find("#subscribe-button").length == 0) {
				var html = "<div class='grey-button button' id='subscribe-button'>Subscribe</div>";
				this.$el.find(".right").append(html);
				
				var scope = this;
				this.$el.find("#subscribe-button").on("click", function(){ scope.$el.trigger("subscribeButtonClicked") });
			}
		} else {
			this.$el.find("#subscribe-button").off();
			this.$el.find("#subscribe-button").remove();
		}
	}
});

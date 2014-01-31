(function($) {
$.fn.slideshow = function(method) {
	if ( this[0][method] ) {
		return this[0][ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
	} else if ( typeof method === 'object' || ! method ) {
		return this.each(function() {
			var ANIMATION_DURATION = .6;		// The duration to flick the content. In seconds.
			var MOVE_THRESHOLD = 10;			// Since touch points can move slightly when initiating a click this is the
												// amount to move before allowing the element to dispatch a click event.
											
			var itemWidth;
			var portraitItemWidth;
			var landscapeItemWidth;
			
			var horizontalGap;
			var $this = $(this);
			var collection;
		
			var viewItems = [];
			
			var touchStartTransformX;			// The start transformX when the user taps.
			var touchStartX;					// The start x coord when the user taps.
			var interval;						// Interval used for measuring the drag speed.
			var wasContentDragged;				// Flag for whether or not the content was dragged. Takes into account MOVE_THRESHOLD.
			var targetTransformX;				// The target transform X when a user flicks the content.
			var touchDragCoords = [];			// Used to keep track of the touch coordinates when dragging to measure speed.
			var touchstartTarget;				// The element which triggered the touchstart.
			var selectedIndex = 0;				// The current visible page.
			var viewPortWidth;					// The width of the div that holds the horizontal content.
			
			var isAnimating;
			
			var pageMovedRight;
			
			// The x coord when the items are reset.
			var resetX;
			
			var delayTimeout;
			
			init(method);
			
			function init(options) {
				collection = options.data;
				renderer = options.renderer;
				horizontalGap = options.horizontalGap;
				
				portraitItemWidth = options.portraitItemWidth;
				landscapeItemWidth = options.landscapeItemWidth;
				
				initLayout();
		
				$this[0].addEventListener("touchstart", touchstartHandler);
				$this[0].addEventListener("mousedown", touchstartHandler);
				
				viewPortWidth = $this.width();
				$this.on("webkitTransitionEnd", transitionEndHandler);
				
				// Hack: The callback is not getting triggered to addDataItem() is called instead.
				collection.on("add", addItem);

				$(window).on("resize", updateLayout);
			}
			
			function getItemWidth() {
				return $this.width() > $this.height() ? landscapeItemWidth : portraitItemWidth;
			}
			
			function initLayout() {
				// Layout five items. The one in the middle is always the selected one.
				for (var i = 4; i >= 0; i--) {
					var viewItem;
					if (i > 1 && collection.at(i - 2)) // Start at the one in the middle. Subtract 2 so data index starts at 0.
						viewItem = new renderer({model: collection.at(i - 2)});
					else
						viewItem = new renderer();
					
					viewItem.render().$el.appendTo($this);
					viewItem.$el.css("left", itemWidth * (4 - i) + horizontalGap * (4 - i));
					
					viewItem.setState(i != 2 ? "off" : "on");
					
					viewItems.push(viewItem);
				}

				updateLayout();
			}
			
			function updateLayout() {
				// On the device the resize event is sometimes triggered when adding and removing
				// this view so make sure there are valid dimensions.
				if ($this.width() == 0 || $this.height() == 0)
					return;
				
				itemWidth = getItemWidth();
				
				layoutItems();
				
				// Center the first viewItem
				resetX = itemWidth * 2 - ($this.width() - itemWidth - horizontalGap * 4) / 2;
				setTransformX(-resetX);
			}
			
			function layoutItems() {
				// Reset the layout of the items.
				for (var i = 0; i < 5; i++) {
					var viewItem = viewItems[i];
					viewItem.$el.css("left", itemWidth * i + horizontalGap * i);
					
					viewItem.setState(i != 2 ? "off" : "on");
				}
			}
			
			function getCssLeft($el) {
				var left = $el.css("left");
				return Number(left.split("px")[0]);
			}
			
			function transitionEndHandler() {
				if (pageMovedRight != undefined) {
					var viewItem;
					if (pageMovedRight) {
						// Move the last item to the beginning.
						viewItem = viewItems.pop();
						viewItems.splice(0, 0, viewItem);
						viewItem.model = collection.at(selectedIndex + 2);
					} else {
						// Move the first item to the end.
						viewItem = viewItems.shift();
						viewItems.push(viewItem);
						viewItem.model = collection.at(selectedIndex - 2);
					}
					
					viewItem.render();

					layoutItems();
				
					// Reset the transformX so we don't run into any rendering limits. Can't find a definitive answer for what the limits are.
					$this.css("-webkit-transition", "none");
					setTransformX(-resetX);
					
					pageMovedRight = undefined;
				}
			}
			
			function touchstartHandler(e) {
				clearInterval(interval);
				
				wasContentDragged = false;
				
				transitionEndHandler();
				
				// Prevent the default so the window doesn't scroll and links don't open immediately.
				e.preventDefault();	
				
				// Get a reference to the element which triggered the touchstart.
				touchstartTarget = e.target;
				
				// Check for device. If not then testing on desktop.
				touchStartX = window.Touch ? e.touches[0].clientX : e.clientX;
				
				// Get the current transformX before the transition is removed.
				touchStartTransformX = getTransformX();
				
				// Set the transformX before the animation is stopped otherwise the animation will go to the end coord
				// instead of stopping at its current location which is where the drag should begin from.
				setTransformX(touchStartTransformX);
				
				// Remove the transition so the content doesn't tween to the spot being dragged. This also moves the animation to the end.
				$this.css("-webkit-transition", "none");
				
				// Create an interval to monitor how fast the user is dragging.
				interval = setInterval(measureDragSpeed, 20);
				
				document.addEventListener("touchmove", touchmoveHandler);
				document.addEventListener("touchend", touchendHandler);
				document.addEventListener("mousemove", touchmoveHandler);
				document.addEventListener("mouseup", touchendHandler);
			}
			
			function measureDragSpeed() {
				touchDragCoords.push(getTransformX());
			}
			
			function touchmoveHandler(e) {
				var deltaX = (window.Touch ? e.touches[0].clientX : e.clientX) - touchStartX;
				if (wasContentDragged || Math.abs(deltaX) > MOVE_THRESHOLD) { // Keep track of whether or not the user dragged.
					wasContentDragged = true;
					setTransformX(touchStartTransformX + deltaX);
				}
			}
			
			function touchendHandler(e) {
				document.removeEventListener("touchmove", touchmoveHandler);
				document.removeEventListener("touchend", touchendHandler);
				document.removeEventListener("mousemove", touchmoveHandler);
				document.removeEventListener("mouseup", touchendHandler);
				
				clearInterval(interval);
				
				e.preventDefault();
				
				if (wasContentDragged) { // User dragged more than MOVE_THRESHOLD so transition the content. 
					var previousX = getTransformX();
					var bSwitchPages;
					// Compare the last 5 coordinates
					for (var i = touchDragCoords.length - 1; i > Math.max(touchDragCoords.length - 5, 0); i--) {
						if (touchDragCoords[i] != previousX) {
							bSwitchPages = true;
							break;
						}
					}
					
					// User dragged more than halfway across the screen.
					if (!bSwitchPages && Math.abs(touchStartTransformX - getTransformX()) > (viewPortWidth / 2))
						bSwitchPages = true;
		
					if (bSwitchPages) {
						if (previousX > touchStartTransformX) { // User dragged to the right. go to next page.
							if (selectedIndex + 1 < collection.length) {// Make sure user is not on the last page otherwise stay on the same page.
								selectedIndex++;
								tweenTo(touchStartTransformX + itemWidth + horizontalGap);
								pageMovedRight = true;
							} else {
								tweenTo(touchStartTransformX);
								pageMovedRight = undefined;
							}
						} else { // User dragged to the left. go to next page.
							if (selectedIndex > 0) { // Make sure user is not on the first page otherwise stay on the same page.
								selectedIndex--;
								tweenTo(touchStartTransformX - itemWidth - horizontalGap);
								pageMovedRight = false;
							} else {
								tweenTo(touchStartTransformX);
								pageMovedRight = undefined;
							}
						}
					} else {
						tweenTo(touchStartTransformX);
						pageMovedRight = undefined;
					}
				} else { // User dragged less than MOVE_THRESHOLD trigger a click event.
					var event = document.createEvent("MouseEvents");
					event.initEvent("click", true, true);
					touchstartTarget.dispatchEvent(event);
				}
			}
			
			// Returns the x of the transform matrix.
			function getTransformX() {
				var transformArray = $this.css("-webkit-transform").split(","); // matrix(1, 0, 0, 1, 0, 0)
				var transformElement = $.trim(transformArray[4]); // remove the leading whitespace.
				return transformX = Number(transformElement); // Remove the ). 
			}
			
			// Sets the x of the transform matrix.
			function setTransformX(value) {
				$this.css("-webkit-transform", "translateX("+ Math.round(value) + "px)");
			}
			
			function tweenTo(value) {
				isAnimating = true;
				targetTransformX = value;
				// Set the style for the transition.
				$this.css("-webkit-transition", "-webkit-transform " + ANIMATION_DURATION + "s");
				
				// Need to set the timing function each time -webkit-transition is set.
				// The transition is set to ease-out.
				$this.css("-webkit-transition-timing-function", "cubic-bezier(0, 0, 0, 1)");
				setTransformX(targetTransformX);
			}
			
			function addItem(data) {
				clearTimeout(delayTimeout);
				// Create a timeout in case multiple items are added in the same frame.
				// When the timeout completes all of the view items will have their model
				// updated. The renderer should check to make sure the model is different
				// before making any changes.
				delayTimeout = setTimeout(function(data) {
					var index = collection.models.indexOf(data);
					var dataIndex = index;
					var firstIndex = selectedIndex - 2;
					var dataIndex = firstIndex;
					var viewItem;
					for (var i = 0; i < viewItems.length; i++) {
						viewItem = viewItems[4 - i];
						
						if (dataIndex >= 0 && dataIndex < collection.length) {
							viewItem.model = collection.at(dataIndex);
							viewItem.render();
						}
						
						viewItem.setState(i != 2 ? "off" : "on");

						dataIndex += 1;
					}
				}, 200);
			}
			
			// Called when the data source has changed. Resets the view with the new data source.
			this.setData = function(data) {
				$this.empty();
				viewItems = [];
				collection = data;
				selectedIndex = 0;
				initLayout();
			}
			
			this.getSelectedIndex = function(){
				return selectedIndex;
			}
			
			this.getSelectedRenderer = function() {
				// The visible renderer should always be the middle one.
				return viewItems[2];
			}
		});
	} else {
		$.error( 'Method ' +  method + ' does not exist on Slideshow' );
	} 
}
})(jQuery);

(function($) {
$.fn.navbar = function(method) {
	if ( this[0][method] ) {
		return this[0][ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
	} else if ( typeof method === 'object' || ! method ) {
		return this.each(function() {
			var $this = $(this);
			var selectedIndex;
			var $selectedEl;
			
			init();
			
			function init() {
				selectedIndex = Number($this.attr("default-selected-index")) || 0;
				
				$this.children().each(function(index, value) {
					var $el = $(value);
					$el.on("click", function(e) {
						if ($(e.currentTarget).index() != selectedIndex) {
							$selectedEl.removeClass($selectedEl.attr("on-skin-style"));
							$selectedEl.addClass($selectedEl.attr("off-skin-style"));
		
							$selectedEl = $(e.currentTarget);
							$selectedEl.removeClass($selectedEl.attr("off-skin-style"));
							$selectedEl.addClass($selectedEl.attr("on-skin-style"));
							
							selectedIndex = $selectedEl.index();
							
							$this.trigger("change");
						}
					});
		
					if (index == selectedIndex) {
						$el.addClass($el.attr("on-skin-style"));
						$selectedEl = $el;
					} else {
						$el.addClass($el.attr("off-skin-style"));
					}
				});
			}
			
			this.getSelectedIndex = function(){
				return selectedIndex;
			}
			
			this.setSelectedIndex = function(value) {
				selectedIndex = value;
				
				$selectedEl.removeClass($selectedEl.attr("on-skin-style"));
				$selectedEl.addClass($selectedEl.attr("off-skin-style"));
				
				$selectedEl = $this.children().eq(value);
				$selectedEl.removeClass($selectedEl.attr("off-skin-style"));
				$selectedEl.addClass($selectedEl.attr("on-skin-style"));
			}
		});
	} else {
		$.error( 'Method ' +  method + ' does not exist on jQuery.navbar' );
	} 
}
})(jQuery);

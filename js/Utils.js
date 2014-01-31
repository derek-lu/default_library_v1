var ADOBE = ADOBE || {};

ADOBE.Utils = {};

ADOBE.Utils.openIFrame = function (url) {
	var html  = "<div class='iframe-container'>";
		html += 	"<div class='iframe-header'>";
		html +=			"<button>Done</button>";
		html +=		"</div>";
		html += 	"<iframe class='external-link-iframe' seamless='seamless' src='" + url + "' ></iframe>";
		html += "</div>";

	$("body").append(html);
	$(".iframe-container button").on("click", function() {
		window.scrollTo(0, 0);
		$(".iframe-container button").off("click");
		$(".iframe-container").remove();
	});
}
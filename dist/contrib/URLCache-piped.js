LocalStorage.URLCache = (function() {
	function URLCache() {

	}

	URLCache.prototype = {

	};

	return {
		applyTo: function(lls, options) {
			if (!pipeline.isPipeline(lls)) {
				lls.toPipeline();
			}
		}
	}
});
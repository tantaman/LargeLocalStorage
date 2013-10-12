var LocalStorageProvider = (function(Q) {
	return {
		init: function() {
			return Q({type: 'LocalStorage'});
		}
	}
})(Q);
define(['Q'], function(Q) {
	return {
		init: function() {
			return Q({type: 'LocalStorage'});
		}
	}
});
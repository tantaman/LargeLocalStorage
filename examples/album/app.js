(function() {
	'use strict';

	var storage = new LargeLocalStorage({
		size: 20 * 1024 * 1024
	});

	storage.initialized.then(function() {
		console.log(storage.getCapacity());
		$('.storageNotice').css('display-none');
	}, function() {
		console.log('denied');
	});
})();
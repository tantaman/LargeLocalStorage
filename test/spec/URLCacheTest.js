(function(lls) {
	function fail(err) {
		console.log(err);
		expect(true).to.equal(false);
	}

	var blob = new Blob(['<p>worthless</p>'], {type: 'text/html'});

	var storage = new lls({name: 'lls-urlcache-test', size: 10 * 1024 * 1024});
	LargeLocalStorage.contrib.URLCache.addTo(storage);
	var cacheObj = storage.pipe.getHandler('URLCache').cache;

	// for debug
	// window.cacheObj = cacheObj;
	// window.storage = storage;

	// TODO: spy on LargeLocalStorage to ensure that 
	// revokeAttachmentURL is being called.
	// And also spy to make sure piped methods are receiving their calls.

	function loadTests() {
	describe('URLCache', function() {
		it('Caches getAttachmentURL operations',
		function(done) {
			storage.setAttachment('doc', 'attach', blob)
			.then(function() {
				console.log('Getting attach url');
				return storage.getAttachmentURL('doc', 'attach');
			})
			.then(function(url) {
				console.log('Comparison');
				expect(url).to.equal(cacheObj.main.doc.attach);
				expect(cacheObj.reverse[url]).to.eql({
					docKey: 'doc',
					attachKey: 'attach'
				});
			}).done(done);
		});

		it('Removes the URL from the cache when updating the attachment',
		function(done) {
			storage.setAttachment('doc', 'attach', blob)
			.then(function() {
				expect(cacheObj.main.doc.attach).to.equal(undefined);
				expect(cacheObj.reverse).to.eql({});
			}).done(done);
		});

		it('Removes the URL from the cache when removing the attachment',
		function(done) {
			var theUrl;
			storage.getAttachmentURL('doc', 'attach').then(function(url) {
				expect(url).to.equal(cacheObj.main.doc.attach);
				theUrl = url;
				return storage.rmAttachment('doc', 'attach');
			}).then(function() {
				expect(cacheObj.main.doc.attach).to.equal(undefined);
				expect(cacheObj.reverse[theUrl]).to.equal(undefined);
			}).done(done);
		});

		it('Removes the URL from the cache when removing the attachment via removing the host document',
		function(done) {
			storage.setAttachment('doc2', 'attach', blob)
			.then(function() {
				return storage.rm('doc2');
			}).then(function() {
				expect(cacheObj.main.doc2).to.equal(undefined);
				expect(cacheObj.reverse).to.eql({});
			}).done(done);
		});

		it('Removes the URL from the cache when revoking the URL',
		function(done) {
			storage.setAttachment('doc3', 'attach', blob)
			.then(function() {
				return storage.getAttachmentURL('doc3', 'attach');
			}).then(function(url) {
				expect(url).to.equal(cacheObj.main.doc3.attach);
				expect(cacheObj.reverse[url]).to.eql({
					docKey: 'doc3',
					attachKey: 'attach'
				});
				storage.revokeAttachmentURL(url);
				expect(cacheObj.main.doc3.attach).to.equal(undefined);
				expect(cacheObj.reverse).to.eql({});
			}).done(done);
		});

		it('Removes all URLs when emptying the database',
		function(done) {
			Q.all([storage.setAttachment('doc4', 'attach', blob),
			storage.setAttachment('doc5', 'attach', blob)])
			.then(function() {
				return storage.clear();
			}).then(function() {
				expect(cacheObj.reverse).to.eql({});
				expect(cacheObj.main).to.eql({});
			}).done(done);
		});
	});
	}

	loadTests();
	storage.initialized.then(function() {
		window.runMocha();
	});
})(LargeLocalStorage);
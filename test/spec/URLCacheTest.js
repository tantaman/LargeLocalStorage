(function(lls) {
	function fail(err) {
		console.log(err);
		expect(true).to.equal(false);
	}

	var blob = new Blob(['<p>worthless</p>'], {type: 'text/html'});

	var storage = new lls({size: 10 * 1024 * 1024});
	var cacheObj = LargeLocalStorage.URLCache._applyTo(storage)._cache;

	function loadTests() {
	describe('URLCache', function() {
		it('Caches getAttachmentURL operations',
		function(done) {
			storage.setAttachment('doc', 'attach', blob)
			.then(function() {
				return storage.getAttachmentURL('doc', 'attach');
			}).then(function(url) {
				expect(url).to.equal(cacheObj.main.doc.attach);
				done();
			}).catch(function(err) {
				fail(err);
				done();
			});
		});

		it('Removes the URL from the cache when updating the attachment',
		function(done) {
			storage.setAttachment('doc', 'attach', blob)
			.then(function() {
				expect(cacheObj.main.doc.attach).to.equal(undefined);
				done();
			}).catch(function(err) {
				fail(err);
				done();
			});
		});

		it('Removes the URL from the cache when removing the attachment',
		function(done) {
			storage.getAttachmentURL('doc', 'attach').then(function(url) {
				expect(url).to.equal(cacheObj.main.doc.attach);
				return storage.rmAttachment('doc', 'attach');
			}).then(function() {
				expect(cacheObj.main.doc.attach).to.equal(undefined);
				done();
			}).catch(function(err) {
				fail(err);
				done();
			});
		});

		it('Removes the URL from the cache when removing the attachment via removing the host document',
		function(done) {
			storage.getAttachmentURL('doc', 'attach').then(function(url) {
				
			})
		});

		// it('Removes the URL from the cache when revoking the URL',
		// function(done) {

		// });
	});
	}

	//loadTests();
	storage.initialized.then(function() {
		window.runMocha();
	});
})(LargeLocalStorage);
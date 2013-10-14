(function(lls) {
	var storage = new lls({
		size: 10 * 1024 * 1024
		// forceProvider: 'WebSQL' // force a desired provider.
	});

	storage.initialized.then(function() {
		var runner = mocha.run();
	}, function(err) {
		console.log(err);
		alert('Could not initialize storage.  Did you not authorize it? ' + err);
	});

	function countdown(n, cb) {
		var args = [];
		return function() {
			for (var i = 0; i < arguments.length; ++i)
				args.push(arguments[i]);
			n -= 1;
			if (n == 0)
				cb.apply(this, args);
		}
	}

	function fail(err) {
		console.log(err);
		expect(true).to.equal(false);
	}

	function getAttachment(a, cb) {
        var xhr = new XMLHttpRequest(),
            blob;

        xhr.open("GET", a, true);
        xhr.responseType = "blob";

        xhr.addEventListener("load", function () {
            if (xhr.status === 200) {
                blob = xhr.response;
                cb(blob);
            }
        }, false);
        xhr.send();
    }

	describe('LargeLocalStorage', function() {
		it('Allows string contents to be set and read', function(done) {
			storage.setContents("testFile", "contents").then(function() {
				return storage.getContents("testFile");
			}).then(function(contents) {
				expect(contents).to.equal("contents");
				done();
			}).catch(function(err) {
				fail(err);
				done();
			})
		});

		// well.... maybe not anymore... need to think about this ability.
		it('Allows js objects to be set and read', function(done) {
			var jsondoc = {
				a: 1,
				b: 2,
				c: {a: true}
			};
			storage.setContents("testfile2", JSON.stringify(jsondoc)).then(function() {
				return storage.getContents("testfile2");
			}).then(function(contents) {
				expect(jsondoc).to.eql(JSON.parse(contents));
				done();
			}).catch(function(err) {
				fail(err);
				done();
			});
		});

		it('Allows items to be deleted', function(done) {
			storage.setContents("testfile3", "contents").then(function() {
				return storage.rm("testfile3");
			}).then(function() {
				return storage.getContents("testfile3");
			}).then(function(contents) {
				expect("File should not have been found").to.equal("");
			}).catch(function(err) {
				expect(err != null).to.equal(true);
				done();
			});
		});


		it('Allows attachments to be written, read', function(done) {
			getAttachment("elephant.jpg", function(blob) {
				storage.setContents("testfile4", "file...").then(function() {
					return storage.setAttachment("testfile4/ele", blob);
				}).then(function() {
					return storage.getAttachment("testfile4/ele");
				}).then(function(attach) {
					expect(attach instanceof Blob).to.equal(true);
					done();
				}).catch(function(err) {
					fail(err);
					done();
				});
			});
		});


		// Apparently these tests are being run sequentially...
		// so taking advantage of that...
		it('Allows us to get attachments as urls', function(done) {
			storage.getAttachmentURL("testfile4/ele").then(function(url) {
				// urls are pretty opaque since they could be from
				// filesystem api, indexeddb, or websql
				expect(typeof url === 'string').to.equal(true);
				$(document.body).append('<img src="' + url + '">');
				done();
			}).catch(function(err) {
				fail(err);
				done();
			});
		});

		it('Allows attachments to be deleted', function(done) {
			storage.rmAttachment("testfile4/ele").then(function() {
				done();
			}).catch(function(err) {
				fail(err);
				done();
			});
		});

		it('Removes all attachments when removing a file', function(done) {
			getAttachment("pie.jpg", function(blob) {
				storage.setContents("testfile5", "fileo").then(function() {
					return storage.setAttachment("testfile5/pie", blob);
				}).then(function() {
					return storage.setAttachment("testfile5/pie2", blob);
				}).then(function() {
					return storage.rm("testfile5");
				}).then(function() {
					return storage.getAttachment("testfile5/pie");
				}).then(function() {
					fail();
					done();
				}).catch(function(err) {
					expect(err != null).to.equal(true);
					storage.getAttachment("testfile5/pie2")
					.then(function(a) {
						fail(a);
						done();
					}, function(err) {
						expect(err != null).to.equal(true);
						done();
					});
				});
			});
		});

		it('Allows one to revoke attachment urls', function() {
			storage.revokeAttachmentURL('');
		});

		it('Allows all attachments to be gotten in one shot', function(done) {
			var c = countdown(2, continuation);
			getAttachment("pie.jpg", function(pie) {
				c(pie);
			});

			getAttachment("elephant.jpg", function(ele) {
				c(ele);
			});

			function continuation(blob1, blob2) {
				Q.all([
					storage.setAttachment("testfile6/blob1", blob1),
					storage.setAttachment("testfile6/blob2", blob2)
				]).then(function() {
					return storage.getAllAttachments("testfile6");
				}).then(function(attachments) {
					expect(attachments.length).to.equal(2);
					done();
				}).catch(function(err) {
					fail(err);
					done();
				});
			}
		});

		it('Allows all attachment urls to be gotten in one shot', function(done) {
			storage.getAllAttachmentURLs('testfile6').then(function(urls) {
				expect(urls.length).to.equal(2);
				urls.forEach(function(url) {
					$(document.body).append('<img src="' + url + '"></img>');
				});
				done();
			}, function(e) {
				fail(e);
				done();
			});
		});
	});
})(LargeLocalStorage);
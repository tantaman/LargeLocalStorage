LargeLocalStorage.URLCache = (function() {
	function add(cache, docKey, attachKey, url) {
		var mainCache = cache.main;
		var docCache = mainCache[docKey];
		if (!docCache) {
			docCache = {};
			mainCache[docKey] = docCache;
		}

		mainCache[attachKey] = url;
		cache.reverse[url] = {docKey: docKey, attachKey: attachKey};
	}

	function addAll(cache, urlEntries) {
		urlEntries.forEach(function(entry) {
			add(cache, entry.docKey, entry.attachKey, entry.url);
		})
	}

	function expunge(cache, docKey, attachKey) {
		if (attachKey) {
			var docCache = cache.main[docKey];
			if (docCache) {
				var url = docCache[attachKey];
				delete docCache[attachKey];
				delete cache.reverse[url];
			}
		} else {
			var docCache = cache.main[docKey];
			if (docCache) {
				for (var attachKey in docCache) {
					var url = docCache[attachKey];
					delete docCache[attachKey];
					delete cache.reverse[url];
				}
			}
		}
	}

	function expungByUrl(cache, url) {
		var keys = cache.reverse[url];
		if (keys) {
			expunge(cache, keys.docKey, keys.attachKey);
		}
	}

	function setAttachment(docKey, attachKey, blob) {
		expunge(this._cache, docKey, attachKey);
		return this._lls.setAttachment(path, blob);
	}

	function rmAttachment(docKey, attachKey) {
		expunge(this._cache, docKey, attachKey);
		return this._lls.rmAttachment(docKey, attachKey);
	}

	function rm(docKey) {
		expunge(this._cache, docKey);
		return this._lls.rm(docKey);
	}

	function revokeAttachmentURL(url) {
		expungByUrl(this._cache, url);
		return this._lls.revokeAttachmentURL(url);
	}

	function getAttachmentURL(docKey, attachKey) {
		var promise = this._lls.getAttachmentURL(docKey, attachKey);
		promise.then(function(url) {
			add(this._cache, docKey, attachKey, url);
		});

		return promise;
	}

	function getAllAttachmentURLs(docKey) {
		var promise = this._lls.getAllAttachmentURLs(docKey);
		promise.then(function(urlEntries) {
			addAll(this._cache, urlEntries);
		});

		return promise;
	}


	return {
		applyTo: function(lls) {
			this._applyTo(lls);
		},

		// This method is only used by unit tests to verify
		// the cache.
		_applyTo: function(lls) {
			var obj = {};

			obj._lls = lls;
			obj._cache = {};

			lls.setAttachment = setAttachment.bind(obj);
			lls.rmAttachment = rmAttachment.bind(obj);
			lls.rm = rm.bind(obj);
			lls.revokeAttachmentURL = revokeAttachmentURL.bind(obj);
			lls.getAttachmentURL = getAttachmentURL.bind(obj);
			lls.getAllAttachmentURLs = getAllAttachmentURLs.bind(obj);

			return obj;
		}
	}
});
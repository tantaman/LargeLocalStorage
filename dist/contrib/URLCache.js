LargeLocalStorage.URLCache = (function() {

	// TODO: we need to know if we have outstanding requests
	// for a given URL and not get a new URL if that is so.

	// TODO: should we revoke the URL when removing it from the
	// cache?

	// TODO: provide an option for the cache to manage URL revocation.

	// TODO: provide a "revokeAllCachedURLS" method

	// TODO: change this to an adapter style interface
	// so we don't befuddle the original object.

	function add(cache, docKey, attachKey, url) {
		var mainCache = cache.main;
		var docCache = mainCache[docKey];
		if (!docCache) {
			docCache = {};
			mainCache[docKey] = docCache;
		}

		docCache[attachKey] = url;
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
		return this.setAttachment.call(this._lls, docKey, attachKey, blob);
	}

	function rmAttachment(docKey, attachKey) {
		expunge(this._cache, docKey, attachKey);
		return this.rmAttachment.call(this._lls, docKey, attachKey);
	}

	function rm(docKey) {
		expunge(this._cache, docKey);
		return this.rm.call(this._lls, docKey);
	}

	function revokeAttachmentURL(url) {
		expungByUrl(this._cache, url);
		return this.revokeAttachmentURL.call(this._lls, url);
	}

	function getAttachmentURL(docKey, attachKey) {
		var promise = this.getAttachmentURL.call(this._lls, docKey, attachKey);
		var self = this;
		promise.then(function(url) {
			add(self._cache, docKey, attachKey, url);
		});

		return promise;
	}

	function getAllAttachmentURLs(docKey) {
		var promise = this.getAllAttachmentURLs.call(this._lls, docKey);
		var self = this;
		promise.then(function(urlEntries) {
			addAll(self._cache, urlEntries);
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

			obj._cache = {
				main: {},
				reverse: {}
			};
			obj._lls = lls;

			obj.setAttachment = lls.setAttachment;
			lls.setAttachment = setAttachment.bind(obj);

			obj.rmAttachment = lls.rmAttachment;
			lls.rmAttachment = rmAttachment.bind(obj);

			obj.rm = lls.rm;
			lls.rm = rm.bind(obj);

			obj.revokeAttachmentURL = lls.revokeAttachmentURL;
			lls.revokeAttachmentURL = revokeAttachmentURL.bind(obj);

			obj.getAttachmentURL = lls.getAttachmentURL;
			lls.getAttachmentURL = getAttachmentURL.bind(obj);

			obj.getAllAttachmentURLs = lls.getAllAttachmentURLs;
			lls.getAllAttachmentURLs = getAllAttachmentURLs.bind(obj);

			return obj;
		}
	}
})();
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
		if (cache.options.manageRevocation)
			this.expunge(cache, docKey, attachKey);

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
			this.add(cache, entry.docKey, entry.attachKey, entry.url);
		}, this);
	}

	function expunge(cache, docKey, attachKey) {
		function delAndRevoke(attachKey) {
			var url = docCache[attachKey];
			delete docCache[attachKey];
			delete cache.reverse[url];
			if (cache.option.manageRevocation)
				this.revokeAttachmentURL(url);
		}

		var docCache = cache.main[docKey];
		if (docCache) {
			if (attachKey) {
				delAndRevoke.call(this, attachKey);
			} else {
				for (var attachKey in docCache) {
					delAndRevoke.call(this, attachKey);
				}
				delete cache.main[docKey];
			}
		}
	}

	function expungeByUrl(cache, url) {
		var keys = cache.reverse[url];
		if (keys) {
			this.expunge(cache, keys.docKey, keys.attachKey);
		}
	}


	function setAttachment(docKey, attachKey, blob) {
		this.expunge(this._cache, docKey, attachKey);
		return this.setAttachment.call(this._lls, docKey, attachKey, blob);
	}

	function rmAttachment(docKey, attachKey) {
		this.expunge(this._cache, docKey, attachKey);
		return this.rmAttachment.call(this._lls, docKey, attachKey);
	}

	function rm(docKey) {
		this.expunge(this._cache, docKey);
		return this.rm.call(this._lls, docKey);
	}

	function revokeAttachmentURL(url) {
		this.expungeByUrl(this._cache, url);
		return this.revokeAttachmentURL.call(this._lls, url);
	}

	function getAttachmentURL(docKey, attachKey) {
		var pendingKey = docKey + attachKey;
		var pending = this._pending[pendingKey];
		if (pending)
			return pending;

		var promise = this.getAttachmentURL.call(this._lls, docKey, attachKey);
		var self = this;
		promise.then(function(url) {
			add(self._cache, docKey, attachKey, url);
			delete self._pending[pendingKey];
		});

		this._pending[pendingKey] = promise;

		return promise;
	}

	// TODO: pending between this and getAttachmentURL...
	// Execute this as an ls and then
	// a loop on getAttachmentURL instead???
	// doing it the way mentiond above
	// will prevent us from leaking blobs.
	function getAllAttachmentURLs(docKey) {
		var promise = this.getAllAttachmentURLs.call(this._lls, docKey);
		var self = this;
		promise.then(function(urlEntries) {
			addAll(self._cache, urlEntries);
		});

		return promise;
	}

	var defaultOptions = {
		manageRevocation: true
	};

	function defaults(options, defaultOptions) {
		for (var k in defaultOptions) {
			if (options[k] === undefined)
				options[k] = defaultOptions[k];
		}
	}

	return {
		applyTo: function(lls, options) {
			this._applyTo(lls, options);
		},

		// This method is only used by unit tests to verify
		// the cache.
		_applyTo: function(lls, options) {
			var obj = {};

			obj._cache = {
				main: {},
				reverse: {}
			};
			obj._pending = {};
			obj._lls = lls;

			obj._cache.options = defaults(options || {}, defaultOptions);

			obj.expunge = expunge;
			obj.expungeByUrl = expungeByUrl;
			obj.add = add;
			obj.addAll = addAll;

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
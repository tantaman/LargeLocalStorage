LargeLocalStorage.URLCache = (function() {

	function add(cache, path, url) {
		var parts = path.split('/');
	}

	function expunge(cache, path) {

	}

	function expungByUrl(cache, url) {

	}

	function setAttachment(path, blob) {
		expunge(this._cache, path);
		return this._lls.setAttachment(path, blob);
	}

	function rmAttachment(path) {
		expunge(this._cache, path);
		return this._lls.rmAttachment(path);
	}

	function rm(path) {
		delete this._cache[path];
		return this._lls.rm(path);
	}

	function revokeAttachmentURL(url) {
		expungByUrl(this._cache, url);
		return this._lls.revokeAttachmentURL(url);
	}

	function getAttachmentURL(path) {
		var promise = this._lls.getAttachmentURL(path);
		promise.then(function(url) {
			add(this._cache, path, url);
		});

		return promise;
	}

	function getAllAttachmentURLs(path) {
		var promise = this._lls.getAllAttachmentURLs(path);
		promise.then(function(urls) {
			// TODO: the return will have to be a urls,paths pair...
			addAll(this._cache, path, urls);
		});

		return promise;
	}


	return {
		apply: function(lls) {
			var obj = {};

			obj._lls = lls;
			obj._cache = {};

			lls.setAttachment = setAttachment.bind(obj);
			lls.rmAttachment = rmAttachment.bind(obj);
			lls.rm = rm.bind(obj);
			lls.revokeAttachmentURL = revokeAttachmentURL.bind(obj);
			lls.getAttachmentURL = getAttachmentURL.bind(obj);
			lls.getAllAttachmentURLs = getAllAttachmentURLs.bind(obj);

			return lls;
		}
	}
});
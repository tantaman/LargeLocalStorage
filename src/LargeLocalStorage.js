var LargeLocalStorage = (function(Q) {

	var sessionMeta = localStorage.getItem('LargeLocalStorage-meta');
	if (sessionMeta)
		sessionMeta = JSON.parse(sessionMeta);
	else
		sessionMeta = {};

	function getImpl(type) {
		switch(type) {
			case 'FileSystemAPI':
				return FilesystemAPIProvider.init();
			case 'IndexedDB':
				return IndexedDBProvider.init();
			case 'WebSQL':
				return WebSQLProvider.init();
			case 'LocalStorage':
				return LocalStorageProvider.init();
		}
	}

	var providers = {
		FileSystemAPI: FilesystemAPIProvider,
		IndexedDB: IndexedDBProvider,
		WebSQL: WebSQLProvider,
		LocalStorage: LocalStorageProvider
	}

	function selectImplementation(config) {
		if (config.forceProvider) {
			return providers[config.forceProvider].init(config);
		}

		return FilesystemAPIProvider.init(config).then(function(impl) {
			return Q(impl);
		}, function() {
			return IndexedDBProvider.init(config);
		}).then(function(impl) {
			return Q(impl);
		}, function() {
			return WebSQLProvider.init(config);
		}).then(function(impl) {
			return Q(impl);
		}, function() {
			return LocalStorageProvider.init(config);
		});
	}

	function copyOldData(from, to) {
		from = getImpl(from);
	}

	function LargeLocalStorageProvider(config) {
		var self = this;
		var deferred = Q.defer();
		selectImplementation(config).then(function(impl) {
			console.log('Selected: ' + impl.type);
			self._impl = impl;
			if (sessionMeta.lastStorageImpl != self._impl.type) {
				copyOldData(sessionMeta.lastStorageImpl, self._impl);
			}
			sessionMeta.lastStorageImpl = impl.type;
			deferred.resolve(self);
		}).catch(function(e) {
			// This should be impossible
			console.log(e);
			deferred.reject('No storage provider found');
		});

		this.initialized = deferred.promise;
	}

	LargeLocalStorageProvider.prototype = {
		supportsAttachments: function() {
			this._checkAvailability();
			return this._impl.supportsAttachments();
		},

		ready: function() {
			return true;
		},

		ls: function(path) {
			this._checkAvailability();
			return this._impl.ls(path);
		},

		rm: function(path) {
			// check for attachments on this path
			// delete attachments in the storage as well.
			this._checkAvailability();
			return this._impl.rm(path);
		},

		getContents: function(path) {
			this._checkAvailability();
			return this._impl.getContents(path);
		},

		setContents: function(path, data) {
			this._checkAvailability();
			return this._impl.setContents(path, data);
		},

		getAttachment: function(path) {
			this._checkAvailability();
			return this._impl.getAttachment(path);
		},

		getAttachmentURL: function(path) {
			this._checkAvailability();
			return this._impl.getAttachmentURL(path);
		},

		revokeAttachmentURL: function(url) {
			this._checkAvailability();
			return this._impl.revokeAttachmentURL(url);
		},

		setAttachment: function(path, data) {
			this._checkAvailability();
			return this._impl.setAttachment(path, data);
		},

		rmAttachment: function(path) {
			this._checkAvailability();
			return this._impl.rmAttachment(path);
		},

		getCapacity: function() {
			this._checkAvailability();
			if (this._impl.getCapacity)
				return this._impl.getCapacity();
			else
				return -1;
		},

		_checkAvailability: function() {
			if (!this._impl) {
				throw {
					msg: "No storage implementation is available yet.  The user most likely has not granted you app access to FileSystemAPI or IndexedDB",
					code: "NO_IMPLEMENTATION"
				};
			}
		}
	};

	return LargeLocalStorageProvider;
})(Q);
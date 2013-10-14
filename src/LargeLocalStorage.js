var LargeLocalStorage = (
/**
* @exports LargeLocalStorage
*/
function(Q) {
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
			console.error('Unable to create any storage implementations.  Using LocalStorage');
			return LocalStorageProvider.init(config);
		});
	}

	function copyOldData(from, to) {
		// from = getImpl(from);
		console.log('Underlying implementation change.');
	}

	/**
	 * Constructor to create an instance of LLS.
	 * The LLS will be immediately returned but not necessarily 
	 * immediately ready for use.
	 *
	 * The `initialized` property of the constructed LLS
	 * object is a promise which will return once
	 * construction of the storage area has completed.
	 *
	 * So usage of LLS would typical be:
	 * ```
	 * var storage = new LargeLocalStorage(config);
	 * storage.initialized.then(function() {
	 *   // storage ready to be used.
	 * })
	 * ```
	 *
	 * The reason that storage may not be immediately ready for
	 * use is that some browser's require confirmation from the
	 * user before a storage area may be created.  Also,
	 * the browser's native storage APIs are asynchronous.
	 *
	 * If an LLS instance is used before the storage
	 * area is ready then any
	 * calls to it will throw an exception with code: "NO_IMPLEMENTATION"
	 *
	 * This behavior is useful when you want the application
	 * to continue to function--regardless of whether or
	 * not the user has allowed it to store data--and would
	 * like to know when your storage calls fail at the point
	 * of those calls.
	 *
	 * LLS-contrib has utilities to queue storage calls until
	 * the implementation is ready.  If an implementation
	 * is never ready this could obviously lead to memory issues
	 * which is why it is not the default behavior.
	 *
	 * The config object allows you to specify the desired
	 * size of the storage in bytes.
	 *
	 * ```
	 * {
	 *    size: 75 * 1024 * 1024, // request 75MB
	 *    
	 *    // force us to use IndexedDB or WebSQL or the FilesystemAPI
	 *    // this option is for debugging purposes.
	 *    forceProvider: 'IndexedDB' or 'WebSQL' or 'FilesystemAPI'
	 * }
	 * ```
	 *
	 * @constructor
	 * @param {object} config
	 */
	function LargeLocalStorage(config) {
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

	LargeLocalStorage.prototype = {
		/**
		* Whether or not the implementation supports attachments.
		* This will only be true except in the case
		* that WebSQL, IndexedDB, and FilesystemAPI are
		* all not present in the browser.
		* In that case LLS falls back to regular
		* old DOMStorage (or LocalStorage).
		*
		* You can still store attachments via DOMStorage but it
		* isn't advisable due to the space limit (2.5mb or 5.0mb
		* depending on the browser)
		*/
		supportsAttachments: function() {
			this._checkAvailability();
			return this._impl.supportsAttachments();
		},

		/**
		* Whether or not LLS is ready to store data
		*/
		ready: function() {
			return this._impl != null;
		},

		/**
		* List all attachments under a given key.
		*
		* List all documents if no key is provided.
		*
		* Returns a promise that is fulfilled with
		* the listing.
		*
		* @param {string} [docKey]
		* @returns {promise}
		*/
		ls: function(docKey) {
			this._checkAvailability();
			return this._impl.ls(docKey);
		},

		/**
		* Remove the specified document and all
		* of its attachments.
		*
		* Returns a promise that is fulfilled when the
		* removal completes.
		*
		* @param {string} docKey
		* @returns {promise}
		*/
		rm: function(docKey) {
			// check for attachments on this path
			// delete attachments in the storage as well.
			this._checkAvailability();
			return this._impl.rm(docKey);
		},

		/**
		* Get the contents of a document identified by docKey
		* TODO: normalize all implementations to allow storage
		* and retrieval of JS objects?
		*
		* @param {string} docKey
		* @returns {promise}
		*/
		getContents: function(docKey) {
			this._checkAvailability();
			return this._impl.getContents(docKey);
		},

		/**
		* Set the contents identified by docKey with data.
		*
		* @param {string} docKey
		* @param {any} data
		* @returns {promise} fulfilled when set completes
		*/
		setContents: function(docKey, data) {
			this._checkAvailability();
			return this._impl.setContents(docKey, data);
		},

		/**
		* Get the attachment identified by docKey and attachKey
		*
		* @param {string} [docKey] optional.  Defaults to __nodoc__
		* @param {string} attachKey key of the attachment
		* @returns {promise} fulfilled with the attachment or
		* rejected if it could not be found.  code: 1
		*/
		getAttachment: function(docKey, attachKey) {
			if (!docKey) docKey = '__nodoc__';
			this._checkAvailability();
			return this._impl.getAttachment(docKey, attachKey);
		},

		setAttachment: function(docKey, attachKey, data) {
			if (!docKey) docKey = '__nodoc__';
			this._checkAvailability();
			return this._impl.setAttachment(docKey, attachKey, data);
		},

		getAttachmentURL: function(docKey, attachKey) {
			if (!docKey) docKey = '__nodoc__';
			this._checkAvailability();
			return this._impl.getAttachmentURL(docKey, attachKey);
		},

		getAllAttachments: function(docKey) {
			if (!docKey) docKey = '__nodoc__';
			this._checkAvailability();
			return this._impl.getAllAttachments(docKey);
		},

		getAllAttachmentURLs: function(docKey) {
			if (!docKey) docKey = '__nodoc__';
			this._checkAvailability();
			return this._impl.getAllAttachmentURLs(docKey);
		},

		revokeAttachmentURL: function(url) {
			this._checkAvailability();
			return this._impl.revokeAttachmentURL(url);
		},

		rmAttachment: function(docKey, attachKey) {
			if (!docKey) docKey = '__nodoc__';
			this._checkAvailability();
			return this._impl.rmAttachment(docKey, attachKey);
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

	return LargeLocalStorage;
})(Q);
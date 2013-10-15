var LargeLocalStorage = (function(Q) {
	var sessionMeta = localStorage.getItem('LargeLocalStorage-meta');
	if (sessionMeta)
		sessionMeta = JSON.parse(sessionMeta);
	else
		sessionMeta = {};

	function defaults(options, defaultOptions) {
		for (var k in defaultOptions) {
			if (options[k] === undefined)
				options[k] = defaultOptions[k];
		}

		return options;
	}

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

	var defaultConfig = {
		size: 10 * 1024 * 1024,
		name: 'lls'
	};

	function selectImplementation(config) {
		if (!config) config = {};
		config = defaults(config, defaultConfig);

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
	 * 
	 * LargeLocalStorage (or LLS) gives you a large capacity 
	 * (up to several gig with permission from the user)
	 * key-value store in the browser.
	 *
	 * For storage, LLS uses the [FilesystemAPI](https://developer.mozilla.org/en-US/docs/WebGuide/API/File_System)
	 * when running in Crome and Opera, 
	 * [InexedDB](https://developer.mozilla.org/en-US/docs/IndexedDB) in Firefox and IE
	 * and [WebSQL](http://www.w3.org/TR/webdatabase/) in Safari.
	 *
	 * When IndexedDB becomes available in Safari, LLS will
	 * update to take advantage of that storage implementation.
	 *
	 *
	 * Upon construction a LargeLocalStorage (LLS) object will be 
	 * immediately returned but not necessarily immediately ready for use.
	 *
	 * A LLS object has an `initialized` property which is a promise
	 * that is resolved when the LLS object is ready for us.
	 *
	 * Usage of LLS would typically be:
	 * ```
	 * var storage = new LargeLocalStorage({size: 75*1024*1024});
	 * storage.initialized.then(function(grantedCapacity) {
	 *   // storage ready to be used.
	 * });
	 * ```
	 *
	 * The reason that LLS may not be immediately ready for
	 * use is that some browsers require confirmation from the
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
	 * @example
	 *	var desiredCapacity = 50 * 1024 * 1024; // 50MB
	 *	var storage = new LargeLocalStorage({
	 *		// desired capacity, in bytes.
	 *		size: desiredCapacity,
	 *
	 * 		// optional name for your LLS database. Defaults to lls.
	 *		// This is the name given to the underlying
	 *		// IndexedDB or WebSQL DB or FSAPI Folder.
	 *		// LLS's with different names are independent.
	 *		name: 'myStorage'
	 *
	 *		// the following is an optional param 
	 *		// that is useful for debugging.
	 *		// force LLS to use a specific storage implementation
	 *		// forceProvider: 'IndexedDB' or 'WebSQL' or 'FilesystemAPI'
	 *	});
	 *	storage.initialized.then(function(capacity) {
	 *		if (capacity != -1 && capacity != desiredCapacity) {
	 *			// the user didn't authorize your storage request
	 *			// so instead you have some limitation on your storage
	 *		}
	 *	})
	 *
	 * @class LargeLocalStorage
	 * @constructor
	 * @param {object} config {size: sizeInByes, [forceProvider: force a specific implementation]}
	 * @return {LargeLocalStorage}
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

		/**
		* @property {promise} initialized
		*/
		this.initialized = deferred.promise;
	}

	LargeLocalStorage.prototype = {
		/**
		* Whether or not LLS is ready to store data.
		* The `initialized` property can be used to
		* await initialization.
		* @example
		*	// may or may not be true
		*	storage.ready();
		*	
		*	storage.initialized.then(function() {
		*		// always true
		*		storage.ready();
		*	})
		* @method ready
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
		* @example
		*	storage.ls().then(function(docKeys) {
		*		console.log(docKeys);
		*	})
		*
		* @method ls
		* @param {string} [docKey]
		* @returns {promise} resolved with the listing, rejected if the listing fails.
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
		* If no docKey is specified, this throws an error.
		*
		* To remove all files in LargeLocalStorage call
		* `lls.empty();`
		*
		* To remove all attachments that were written without
		* a docKey, call `lls.rm('__emptydoc__');`
		*
		* rm works this way to ensure you don't lose
		* data due to an accidently undefined variable.
		*
		* @example
		* 	stoarge.rm('exampleDoc').then(function() {
		*		alert('doc and all attachments were removed');
		* 	})
		*
		* @method rm
		* @param {string} docKey
		* @returns {promise} resolved when removal completes, rejected if the removal fails.
		*/
		rm: function(docKey) {
			this._checkAvailability();
			return this._impl.rm(docKey);
		},

		/**
		* An explicit way to remove all documents and
		* attachments from LargeLocalStorage.
		*
		* @example
		*	storage.empty().then(function() {
		*		alert('all data has been removed');
		*	});
		* 
		* @returns {promise} resolve when empty completes, rejected if empty fails.
		*/
		empty: function() {
			this._checkAvailability();
			return this._impl.empty();
		},

		/**
		* Get the contents of a document identified by `docKey`
		* TODO: normalize all implementations to allow storage
		* and retrieval of JS objects?
		*
		* @example
		* 	storage.getContents('exampleDoc').then(function(contents) {
		* 		alert(contents);
		* 	});
		*
		* @method getContents
		* @param {string} docKey
		* @returns {promise} resolved with the contents when the get completes
		*/
		getContents: function(docKey) {
			this._checkAvailability();
			return this._impl.getContents(docKey);
		},

		/**
		* Set the contents identified by `docKey` to `data`.
		* The document will be created if it does not exist.
		*
		* @example
		* 	storage.setContents('exampleDoc', 'some data...').then(function() {
		*		alert('doc written');
		* 	});
		*
		* @method setContents
		* @param {string} docKey
		* @param {any} data
		* @returns {promise} fulfilled when set completes
		*/
		setContents: function(docKey, data) {
			this._checkAvailability();
			return this._impl.setContents(docKey, data);
		},

		/**
		* Get the attachment identified by `docKey` and `attachKey`
		*
		* @example
		* 	storage.getAttachment('exampleDoc', 'examplePic').then(function(attachment) {
		*    	var url = URL.createObjectURL(attachment);
		*    	var image = new Image(url);
		*    	document.body.appendChild(image);
		*    	URL.revokeObjectURL(url);
		* 	})
		*
		* @method getAttachment
		* @param {string} [docKey] Defaults to `__emptydoc__`
		* @param {string} attachKey key of the attachment
		* @returns {promise} fulfilled with the attachment or
		* rejected if it could not be found.  code: 1
		*/
		getAttachment: function(docKey, attachKey) {
			if (!docKey) docKey = '__emptydoc__';
			this._checkAvailability();
			return this._impl.getAttachment(docKey, attachKey);
		},

		/**
		* Set an attachment for a given document.  Identified
		* by `docKey` and `attachKey`.
		*
		* @example
		* 	storage.setAttachment('myDoc', 'myPic', blob).then(function() {
		*    	alert('Attachment written');
		* 	})
		*
		* @method setAttachment
		* @param {string} [docKey] Defaults to `__emptydoc__`
		* @param {string} attachKey key for the attachment
		* @param {any} attachment data
		* @returns {promise} resolved when the write completes.  Rejected
		* if an error occurs.
		*/
		setAttachment: function(docKey, attachKey, data) {
			if (!docKey) docKey = '__emptydoc__';
			this._checkAvailability();
			return this._impl.setAttachment(docKey, attachKey, data);
		},

		/**
		* Get the URL for a given attachment.
		*
		* @example
		* 	storage.getAttachmentURL('myDoc', 'myPic').then(function(url) {
	 	*   	var image = new Image();
	 	*   	image.src = url;
	 	*   	document.body.appendChild(image);
	 	*   	storage.revokeAttachmentURL(url);
		* 	})
		*
		* This is preferrable to getting the attachment and then getting the
		* URL via `createObjectURL` (on some systems) as LLS can take advantage of 
		* lower level details to improve performance.
		*
		* @method getAttachmentURL
		* @param {string} [docKey] Identifies the document.  Defaults to `__emptydoc__`
		* @param {string} attachKey Identifies the attachment.
		* @returns {promose} promise that is resolved with the attachment url.
		*/
		getAttachmentURL: function(docKey, attachKey) {
			if (!docKey) docKey = '__emptydoc__';
			this._checkAvailability();
			return this._impl.getAttachmentURL(docKey, attachKey);
		},

		/**
		* Gets all of the attachments for a document.
		*
		* @example
		* 	storage.getAllAttachments('exampleDoc').then(function(attachEntries) {
		* 		attachEntries.map(function(entry) {
		*			var a = entry.data;
		*			// do something with it...
		* 			if (a.type.indexOf('image') == 0) {
		*				// show image...
		*			} else if (a.type.indexOf('audio') == 0) {
		*				// play audio...
		*			} else ...
		*		})
		* 	})
		*
		* @method getAllAttachments
		* @param {string} [docKey] Identifies the document.  Defaults to `__emptydoc__`
		* @returns {promise} Promise that is resolved with all of the attachments for
		* the given document.
		*/
		getAllAttachments: function(docKey) {
			if (!docKey) docKey = '__emptydoc__';
			this._checkAvailability();
			return this._impl.getAllAttachments(docKey);
		},

		/**
		* Gets all attachments URLs for a document.
		*
		* @example
		* 	storage.getAllAttachmentURLs('exampleDoc').then(function(urlEntries) {
		*		urlEntries.map(function(entry) {
		*			var url = entry.url;
		* 			// do something with the url...
		* 		})
		* 	})
		*
		* @method getAllAttachmentURLs
		* @param {string} [docKey] Identifies the document.  Defaults to the `__emptydoc__` document.
		* @returns {promise} Promise that is resolved with all of the attachment
		* urls for the given doc.
		*/
		getAllAttachmentURLs: function(docKey) {
			if (!docKey) docKey = '__emptydoc__';
			this._checkAvailability();
			return this._impl.getAllAttachmentURLs(docKey);
		},

		/**
		* Revoke the attachment URL as required by the underlying
		* storage system.
		*
		* This is akin to `URL.revokeObjectURL(url)`
		* URLs that come from `getAttachmentURL` or `getAllAttachmentURLs` 
		* should be revoked by LLS and not `URL.revokeObjectURL`
		*
		* @example
		* 	storage.getAttachmentURL('doc', 'attach').then(function(url) {
		*		// do something with the URL
		*		storage.revokeAttachmentURL(url);
		* 	})
		*
		* @method revokeAttachmentURL
		* @param {string} url The URL as returned by `getAttachmentURL` or `getAttachmentURLs`
		* @returns {void}
		*/
		revokeAttachmentURL: function(url) {
			this._checkAvailability();
			return this._impl.revokeAttachmentURL(url);
		},

		/**
		* Remove an attachment from a document.
		*
		* @example
		* 	storage.rmAttachment('exampleDoc', 'someAttachment').then(function() {
		* 		alert('exampleDoc/someAttachment removed');
		* 	}).catch(function(e) {
		*		alert('Attachment removal failed: ' + e);
		* 	});
		*
		* @method rmAttachment
		* @param {string} docKey
		* @param {string} attachKey
		* @returns {promise} Promise that is resolved once the remove completes
		*/
		rmAttachment: function(docKey, attachKey) {
			if (!docKey) docKey = '__emptydoc__';
			this._checkAvailability();
			return this._impl.rmAttachment(docKey, attachKey);
		},

		/**
		* Returns the actual capacity of the storage or -1
		* if it is unknown.  If the user denies your request for
		* storage you'll get back some smaller amount of storage than what you
		* actually requested.
		*
		* TODO: return an estimated capacity if actual capacity is unknown?
		* -Firefox is 50MB until authorized to go above,
		* -Chrome is some % of available disk space,
		* -Safari unlimited as long as the user keeps authorizing size increases
		* -Opera same as safari?
		*
		* @example
		*	// the initialized property will call you back with the capacity
		* 	storage.initialized.then(function(capacity) {
		*		console.log('Authorized to store: ' + capacity + ' bytes');
		* 	});
		*	// or if you know your storage is already available
		*	// you can call getCapacity directly
		*	storage.getCapacity()
		*
		* @method getCapacity
		* @returns {number} Capacity, in bytes, of the storage.  -1 if unknown.
		*/
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
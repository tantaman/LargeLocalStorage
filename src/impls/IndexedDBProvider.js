var IndexedDBProvider = (function(Q) {
	var URL = window.URL || window.webkitURL;

	var convertToBase64 = utils.convertToBase64;
	var dataURLToBlob = utils.dataURLToBlob;

	function IDB(db) {
		this._db = db;
		this.type = 'IndexedDB';

		var transaction = this._db.transaction(['attachments'], 'readwrite');
		this._supportsBlobs = true;
		try {
			transaction.objectStore('attachments')
			.put(Blob(["sdf"], {type: "text/plain"}), "featurecheck");
		} catch (e) {
			this._supportsBlobs = false;
		}
	}

	// TODO: normalize returns and errors.
	IDB.prototype = {
		getContents: function(path) {
			var deferred = Q.defer();
			var transaction = this._db.transaction(['files'], 'readonly');

			var get = transaction.objectStore('files').get(path);
			get.onsuccess = function(e) {
				deferred.resolve(e.target.result);
			};

			get.onerror = function(e) {
				deferred.reject(e);
			};

			return deferred.promise;
		},

		setContents: function(path, data) {
			var deferred = Q.defer();
			var transaction = this._db.transaction(['files'], 'readwrite');

			var put = transaction.objectStore('files').put(data, path);
			put.onsuccess = function(e) {
				deferred.resolve(e);
			};

			put.onerror = function(e) {
				deferred.reject(e);
			};

			return deferred.promise;
		},

		rm: function(path) {
			var deferred = Q.defer();
			var finalDeferred = Q.defer();

			var transaction = this._db.transaction(['files', 'attachments'], 'readwrite');
			
			var del = transaction.objectStore('files').delete(path);

			del.onsuccess = function(e) {
				deferred.promise.then(function() {
					finalDeferred.resolve();
				});
			};

			del.onerror = function(e) {
				deferred.promise.catch(function() {
					finalDeferred.reject(e);
				});
			};

			var attachmentsStore = transaction.objectStore('attachments');
			var index = attachmentsStore.index('fname');
			var cursor = index.openCursor(IDBKeyRange.only(path));
			cursor.onsuccess = function(e) {
				var cursor = e.target.result;
				if (cursor) {
					cursor.delete();
					cursor.continue();
				} else {
					deferred.resolve();
				}
			};

			cursor.onerror = function(e) {
				deferred.reject(e);
			}

			return finalDeferred.promise;
		},

		getAttachment: function(path) {
			var deferred = Q.defer();

			var transaction = this._db.transaction(['attachments'], 'readonly');
			var get = transaction.objectStore('attachments').get(path);

			var self = this;
			get.onsuccess = function(e) {
				if (!e.target.result) {
					deferred.reject({code: 1});
					return;
				}

				var data = e.target.result.data;
				if (!self._supportsBlobs) {
					data = dataURLToBlob(data);
				}
				deferred.resolve(data);
			};

			get.onerror = function(e) {
				deferred.reject(e);
			};

			return deferred.promise;
		},

		getAllAttachments: function(path) {
			var deferred = Q.defer();
			var self = this;

			var transaction = this._db.transaction(['attachments'], 'readonly');
			var index = transaction.objectStore('attachments').index('fname');

			var cursor = index.openCursor(IDBKeyRange.only(path));
			var values = [];
			cursor.onsuccess = function(e) {
				var cursor = e.target.result;
				if (cursor) {
					var data;
					if (!self._supportsBlobs) {
						data = dataURLToBlob(cursor.value.data)
					} else {
						data = cursor.value.data;
					}
					values.push(data);
					cursor.continue();
				} else {
					deferred.resolve(values);
				}
			};

			cursor.onerror = function(e) {
				deferred.reject(e);
			};

			return deferred.promise;
		},

		getAllAttachmentURLs: function(path) {
			var deferred = Q.defer();
			this.getAllAttachments(path).then(function(attachments) {
				var urls = attachments.map(function(a) {
					return URL.createObjectURL(a);
				});

				deferred.resolve(urls);
			}, function(e) {
				deferred.reject(e);
			});

			return deferred.promise;
		},

		getAttachmentURL: function(path) {
			var deferred = Q.defer();
			this.getAttachment(path).then(function(attachment) {
				deferred.resolve(URL.createObjectURL(attachment));
			}, function(e) {
				deferred.reject(e);
			});

			return deferred.promise;
		},

		revokeAttachmentURL: function(url) {
			URL.revokeObjectURL(url);
		},

		setAttachment: function(path, data) {
			var parts = utils.splitAttachmentPath(path);
			var deferred = Q.defer();

			if (data instanceof Blob && !this._supportsBlobs) {
				var self = this;
				convertToBase64(data, function(data) {
					continuation.call(self, data);
				});
			} else {
				continuation.call(this, data);
			}

			function continuation(data) {
				var obj = {
					path: path,
					fname: parts[0],
					data: data
				};
				var transaction = this._db.transaction(['attachments'], 'readwrite');
				var put = transaction.objectStore('attachments').put(obj);

				put.onsuccess = function(e) {
					deferred.resolve(e);
				};

				put.onerror = function(e) {
					deferred.reject(e);
				};
			}

			return deferred.promise;
		},

		rmAttachment: function(path) {
			var deferred = Q.defer();
			var transaction = this._db.transaction(['attachments'], 'readwrite');
			var del = transaction.objectStore('attachments').delete(path);

			del.onsuccess = function(e) {
				deferred.resolve(e);
			};

			del.onerror = function(e) {
				deferred.reject(e);
			};

			return deferred.promise;
		}
	};

	return {
		init: function() {
			var deferred = Q.defer();

			var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
			IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction,
			dbVersion = 2;

			if (!indexedDB || !IDBTransaction) {
				deferred.reject("No IndexedDB");
				return deferred.promise;
			}

			var request = indexedDB.open("largelocalstorage", dbVersion);

			function createObjectStore(db) {
				db.createObjectStore("files");
				var attachStore = db.createObjectStore("attachments", {keyPath: 'path'});
				attachStore.createIndex('fname', 'fname', {unique: false})
			}

			// TODO: normalize errors
			request.onerror = function (event) {
				deferred.reject(event);
			};
		 
			request.onsuccess = function (event) {
				var db = request.result;
		 
				db.onerror = function (event) {
					console.log(event);
				};
				
				// Chrome workaround
				if (db.setVersion) {
					if (db.version != dbVersion) {
						var setVersion = db.setVersion(dbVersion);
						setVersion.onsuccess = function () {
							createObjectStore(db);
							deferred.resolve();
						};
					}
					else {
						deferred.resolve(new IDB(db));
					}
				} else {
					deferred.resolve(new IDB(db));
				}
			}
			
			request.onupgradeneeded = function (event) {
				createObjectStore(event.target.result);
			};

			return deferred.promise;
		}
	}
})(Q);
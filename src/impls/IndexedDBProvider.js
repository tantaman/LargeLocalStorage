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
		getContents: function(docKey) {
			var deferred = Q.defer();
			var transaction = this._db.transaction(['files'], 'readonly');

			var get = transaction.objectStore('files').get(docKey);
			get.onsuccess = function(e) {
				deferred.resolve(e.target.result);
			};

			get.onerror = function(e) {
				deferred.reject(e);
			};

			return deferred.promise;
		},

		setContents: function(docKey, data) {
			var deferred = Q.defer();
			var transaction = this._db.transaction(['files'], 'readwrite');

			var put = transaction.objectStore('files').put(data, docKey);
			put.onsuccess = function(e) {
				deferred.resolve(e);
			};

			put.onerror = function(e) {
				deferred.reject(e);
			};

			return deferred.promise;
		},

		rm: function(docKey) {
			var deferred = Q.defer();
			var finalDeferred = Q.defer();

			var transaction = this._db.transaction(['files', 'attachments'], 'readwrite');
			
			var del = transaction.objectStore('files').delete(docKey);

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
			var cursor = index.openCursor(IDBKeyRange.only(docKey));
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

		getAttachment: function(docKey, attachKey) {
			var deferred = Q.defer();

			var transaction = this._db.transaction(['attachments'], 'readonly');
			var get = transaction.objectStore('attachments').get(docKey + '/' + attachKey);

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

		ls: function(docKey) {
			var deferred = Q.defer();

			if (!docKey) {
				// list docs
				var store = 'files';
			} else {
				// list attachments
				var store = 'attachments';
			}

			var transaction = this._db.transaction([store], 'readonly');
			var cursor = transaction.objectStore(store).openCursor();
			var listing = [];

			cursor.onsuccess = function(e) {
				var cursor = e.target.result;
				if (cursor) {
					listing.push(!docKey ? cursor.key : cursor.key.split('/')[1]);
					cursor.continue();
				} else {
					deferred.resolve(listing);
				}
			};

			cursor.onerror = function(e) {
				deferred.reject(e);
			};

			return deferred.promise;
		},

		clear: function() {
			var deferred1 = Q.defer();
			var deferred2 = Q.defer();

			var t = this._db.transaction(['attachments', 'files'], 'readwrite');


			var req1 = t.objectStore('attachments').clear();
			var req2 = t.objectStore('files').clear();

			req1.onsuccess = function() {
				deferred1.resolve();
			};

			req2.onsuccess = function() {
				deferred2.resolve();
			};

			req1.onerror = function(err) {
				deferred1.reject(err);
			};

			req2.onerror = function(err) {
				deferred2.reject(err);
			};

			return Q.all([deferred1, deferred2]);
		},

		getAllAttachments: function(docKey) {
			var deferred = Q.defer();
			var self = this;

			var transaction = this._db.transaction(['attachments'], 'readonly');
			var index = transaction.objectStore('attachments').index('fname');

			var cursor = index.openCursor(IDBKeyRange.only(docKey));
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
					values.push({
						data: data,
						docKey: docKey,
						attachKey: cursor.primaryKey.split('/')[1] // TODO
					});
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

		getAllAttachmentURLs: function(docKey) {
			var deferred = Q.defer();
			this.getAllAttachments(docKey).then(function(attachments) {
				var urls = attachments.map(function(a) {
					a.url = URL.createObjectURL(a.data);
					delete a.data;
					return a;
				});

				deferred.resolve(urls);
			}, function(e) {
				deferred.reject(e);
			});

			return deferred.promise;
		},

		getAttachmentURL: function(docKey, attachKey) {
			var deferred = Q.defer();
			this.getAttachment(docKey, attachKey).then(function(attachment) {
				deferred.resolve(URL.createObjectURL(attachment));
			}, function(e) {
				deferred.reject(e);
			});

			return deferred.promise;
		},

		revokeAttachmentURL: function(url) {
			URL.revokeObjectURL(url);
		},

		setAttachment: function(docKey, attachKey, data) {
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
					path: docKey + '/' + attachKey,
					fname: docKey,
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

		rmAttachment: function(docKey, attachKey) {
			var deferred = Q.defer();
			var transaction = this._db.transaction(['attachments'], 'readwrite');
			var del = transaction.objectStore('attachments').delete(docKey + '/' + attachKey);

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
		init: function(config) {
			var deferred = Q.defer();

			var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
			IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction,
			dbVersion = 2;

			if (!indexedDB || !IDBTransaction) {
				deferred.reject("No IndexedDB");
				return deferred.promise;
			}

			var request = indexedDB.open(config.name, dbVersion);

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
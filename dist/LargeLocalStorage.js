(function(glob) {
	
var utils = (function() {
	return {
		convertToBase64: function(blob, cb) {
			var fr = new FileReader();
			fr.onload = function(e) {
					cb(e.target.result);
			}
			fr.onerror = function(e) {
			};
			fr.onabort = function(e) {
			};
			fr.readAsDataURL(blob);
		},

		dataURLToBlob: function(dataURL) {
				var BASE64_MARKER = ';base64,';
				if (dataURL.indexOf(BASE64_MARKER) == -1) {
					var parts = dataURL.split(',');
					var contentType = parts[0].split(':')[1];
					var raw = parts[1];

					return new Blob([raw], {type: contentType});
				}

				var parts = dataURL.split(BASE64_MARKER);
				var contentType = parts[0].split(':')[1];
				var raw = window.atob(parts[1]);
				var rawLength = raw.length;

				var uInt8Array = new Uint8Array(rawLength);

				for (var i = 0; i < rawLength; ++i) {
					uInt8Array[i] = raw.charCodeAt(i);
				}

				return new Blob([uInt8Array.buffer], {type: contentType});
		},

		splitAttachmentPath: function(path) {
			var parts = path.split('/');
			if (parts.length == 1) 
				parts.unshift('__nodoc__');
			return parts;
		},

		mapAsync: function(fn, promise) {
			var deferred = Q.defer();
			promise.then(function(data) {
				_mapAsync(fn, data, [], deferred);
			}, function(e) {
				deferred.reject(e);
			});

			return deferred.promise;
		}
	};

	function _mapAsync(fn, data, result, deferred) {
		fn(data[result.length], function(v) {
			result.push(v);
			if (result.length == data.length)
				deferred.resolve(result);
			else
				_mapAsync(fn, data, result, deferred);
		}, function(err) {
			deferred.reject(err);
		})
	}
})();
var FilesystemAPIProvider = (function(Q) {
	function makeErrorHandler(deferred, msg) {
		// TODO: normalize the error so
		// we can handle it upstream
		return function(e) {
			console.log(e);
			console.log(msg);
			deferred.reject(e);
		}
	}

	function getAttachmentPath(path) {
		var parts = utils.splitAttachmentPath(path);
		var dir = parts[0];
		var attachmentsDir = dir + "-attachments";
		return {
			dir: attachmentsDir,
			path: attachmentsDir + "/" + parts[1]
		};
	}

	function readDirEntries(reader, result) {
		var deferred = Q.defer();

		_readDirEntries(reader, result, deferred);

		return deferred.promise;
	}

	function _readDirEntries(reader, result, deferred) {
		reader.readEntries(function(entries) {
			if (entries.length == 0) {
				deferred.resolve(result);
			} else {
				result = result.concat(entries);
				_readDirEntries(reader, result, deferred);
			}
		}, function(err) {
			deferred.reject(err);
		});
	}

	function entryToFile(entry, cb, eb) {
		entry.file(cb, eb);
	}

	function entryToURL(entry) {
		return entry.toURL();
	}

	function FSAPI(fs, numBytes) {
		this._fs = fs;
		this._capacity = numBytes;
		this.type = "FilesystemAPI";
	}

	FSAPI.prototype = {
		getContents: function(path) {
			var deferred = Q.defer();
			this._fs.root.getFile(path, {}, function(fileEntry) {
				fileEntry.file(function(file) {
					var reader = new FileReader();

					reader.onloadend = function(e) {
						var data = e.target.result;
						deferred.resolve(data);
					};

					reader.readAsText(file);
				}, makeErrorHandler(deferred));
			}, makeErrorHandler(deferred));

			return deferred.promise;
		},

		// create a file at path
		// and write `data` to it
		setContents: function(path, data) {
			var deferred = Q.defer();

			this._fs.root.getFile(path, {create:true}, function(fileEntry) {
				fileEntry.createWriter(function(fileWriter) {
					var blob;
					fileWriter.onwriteend = function(e) {
						fileWriter.onwriteend = function() {
							deferred.resolve();
						};
						fileWriter.truncate(blob.size);
					}

					fileWriter.onerror = makeErrorHandler(deferred);

					if (data instanceof Blob) {
						blob = data;
					} else {
						blob = new Blob([data], {type: 'text/plain'});
					}

					fileWriter.write(blob);
				}, makeErrorHandler(deferred, "creating writer"));
			}, makeErrorHandler(deferred, "getting file entry"));

			return deferred.promise;
		},

		rm: function(path) {
			var deferred = Q.defer();
			var finalDeferred = Q.defer();

			// remove attachments that go along with the path
			var attachmentsDir = path + "-attachments";

			this._fs.root.getFile(path, {create:false},
				function(entry) {
					entry.remove(function() {
						finalDeferred.resolve(deferred);
					});
				},
				makeErrorHandler(finalDeferred, "getting file entry"));

			this._fs.root.getDirectory(attachmentsDir, {},
				function(entry) {
					entry.removeRecursively(function() {
						deferred.resolve();
					});
				},
				function(err) {
					if (err.code === FileError.NOT_FOUND_ERROR) {
						deferred.resolve({code: 1});
					} else {
						makeErrorHandler(deferred, "get attachment dir for rm " + attachmentsDir)(err);
					}
			});

			return finalDeferred.promise;
		},

		getAttachment: function(path) {
			var attachmentPath = getAttachmentPath(path).path;

			var deferred = Q.defer();
			this._fs.root.getFile(attachmentPath, {}, function(fileEntry) {
				fileEntry.file(function(file) {
					deferred.resolve(file);
				}, makeErrorHandler(deferred, "getting attachment file"));
			}, makeErrorHandler(deferred, "getting attachment file entry"));

			return deferred.promise;
		},

		getAttachmentURL: function(path) {
			var attachmentPath = getAttachmentPath(path).path;

			var deferred = Q.defer();
			var url = 'filesystem:' + window.location.protocol + '//' + window.location.host + '/persistent/' + attachmentPath;
			deferred.resolve(url);
			// this._fs.root.getFile(attachmentPath, {}, function(fileEntry) {
			// 	deferred.resolve(fileEntry.toURL());
			// }, makeErrorHandler(deferred, "getting attachment file entry"));

			return deferred.promise;
		},

		getAllAttachments: function(path) {
			var deferred = Q.defer();
			var attachmentsDir = path + "-attachments";

			this._fs.root.getDirectory(attachmentsDir, {},
			function(entry) {
				var reader = entry.createReader();
				deferred.resolve(
					utils.mapAsync(entryToFile, readDirEntries(reader, [])));
			}, function(err) {
				deferred.reject(err);
			});

			return deferred.promise;
		},

		getAllAttachmentURLs: function(path) {
			var deferred = Q.defer();
			var attachmentsDir = path + "-attachments";

			this._fs.root.getDirectory(attachmentsDir, {},
			function(entry) {
				var reader = entry.createReader();
				readDirEntries(reader, []).then(function(entries) {
					deferred.resolve(entries.map(entryToURL));
				});
			}, function(err) {
				deferred.reject(err);
			});

			return deferred.promise;
		},

		revokeAttachmentURL: function(url) {
			// we return FS urls so this is a no-op
			// unless someone is being silly and doing
			// createObjectURL(getAttachment()) ......
		},

		// Create a folder at dirname(path)+"-attachments"
		// add attachment under that folder as basename(path)
		setAttachment: function(path, data) {
			var attachInfo = getAttachmentPath(path);

			var deferred = Q.defer();

			var self = this;
			this._fs.root.getDirectory(attachInfo.dir, {create:true}, function(dirEntry) {
				deferred.resolve(self.setContents(attachInfo.path, data));
			}, makeErrorHandler(deferred, "getting attachment dir"));

			return deferred.promise;
		},

		// rm the thing at dirname(path)+"-attachments/"+basename(path)
		rmAttachment: function(path) {
			var attachmentPath = getAttachmentPath(path).path;

			var deferred = Q.defer();
			this._fs.root.getFile(attachmentPath, {create:false},
				function(entry) {
					entry.remove(function() {
						deferred.resolve();
					}, makeErrorHandler(deferred, "removing attachment"));
			}, makeErrorHandler(deferred, "getting attachment file entry for rm"));

			return deferred.promise;
		},

		getCapacity: function() {
			return this._capacity;
		}
	};

	return {
		init: function(config) {
			var deferred = Q.defer();
			window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
			var persistentStorage = navigator.persistentStorage || navigator.webkitPersistentStorage;

			if (!requestFileSystem) {
				deferred.reject("No FS API");
				return deferred.promise;
			}

			persistentStorage.requestQuota(config.size,
			function(numBytes) {
				requestFileSystem(window.PERSISTENT, numBytes,
				function(fs) {
					deferred.resolve(new FSAPI(fs, numBytes));
				}, function(err) {
					// TODO: implement various error messages.
					console.log(err);
					deferred.reject(err);
				});
			}, function(err) {
				// TODO: implement various error messages.
				console.log(err);
				deferred.reject(err);
			});

			return deferred.promise;
		}
	}
})(Q);
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
var LocalStorageProvider = (function(Q) {
	return {
		init: function() {
			return Q({type: 'LocalStorage'});
		}
	}
})(Q);
var WebSQLProvider = (function(Q) {
	var URL = window.URL || window.webkitURL;
	var convertToBase64 = utils.convertToBase64;
	var dataURLToBlob = utils.dataURLToBlob;

	function WSQL(db) {
		this._db = db;
		this.type = 'WebSQL';
	}

	WSQL.prototype = {
		getContents: function(path) {
			var deferred = Q.defer();
			this._db.transaction(function(tx) {
				tx.executeSql('SELECT value FROM files WHERE fname = ?', [path],
				function(tx, res) {
					if (res.rows.length == 0) {
						deferred.reject({code: 1});
					} else {
						deferred.resolve(res.rows.item(0).value);
					}
				});
			}, function(err) {
				deferred.reject(err);
			});

			return deferred.promise;
		},

		setContents: function(path, data) {
			var deferred = Q.defer();
			this._db.transaction(function(tx) {
				tx.executeSql(
				'INSERT OR REPLACE INTO files (fname, value) VALUES(?, ?)', [path, data]);
			}, function(err) {
				deferred.reject(err);
			}, function() {
				deferred.resolve();
			});

			return deferred.promise;
		},

		rm: function(path) {
			var deferred = Q.defer();
			this._db.transaction(function(tx) {
				tx.executeSql('DELETE FROM files WHERE fname = ?', [path]);
				tx.executeSql('DELETE FROM attachments WHERE fname = ?', [path]);
			}, function(err) {
				deferred.reject(err);
			}, function() {
				deferred.resolve();
			});

			return deferred.promise;
		},

		getAttachment: function(path) {
			var parts = utils.splitAttachmentPath(path);
			var fname = parts[0];
			var akey = parts[1];
			var deferred = Q.defer();

			this._db.transaction(function(tx){ 
				tx.executeSql('SELECT value FROM attachments WHERE fname = ? AND akey = ?',
				[fname, akey],
				function(tx, res) {
					if (res.rows.length == 0) {
						deferred.reject({code: 1});
					} else {
						deferred.resolve(dataURLToBlob(res.rows.item(0).value));
					}
				});
			}, function(err) {
				deferred.reject(err);
			});

			return deferred.promise;
		},

		getAttachmentURL: function(path) {
			var deferred = Q.defer();
			this.getAttachment(path).then(function(blob) {
				deferred.resolve(URL.createObjectURL(blob));
			}, function() {
				deferred.reject();
			});

			return deferred.promise;
		},

		getAllAttachments: function(path) {
			var deferred = Q.defer();

			this._db.transaction(function(tx) {
				tx.executeSql('SELECT value FROM attachments WHERE fname = ?',
				[path],
				function(tx, res) {
					// TODO: ship this work off to a webworker
					// since there could be many of these conversions?
					var result = [];
					for (var i = 0; i < res.rows.length; ++i) {
						result.push(dataURLToBlob(res.rows.item(i).value))
					}

					deferred.resolve(result);
				});
			}, function(err) {
				deferred.reject(err);
			});

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

		revokeAttachmentURL: function(url) {
			URL.revokeObjectURL(url);
		},

		setAttachment: function(path, data) {
			var parts = utils.splitAttachmentPath(path);
			var fname = parts[0];
			var akey = parts[1];
			var deferred = Q.defer();

			var self = this;
			convertToBase64(data, function(data) {
				self._db.transaction(function(tx) {
					tx.executeSql(
					'INSERT OR REPLACE INTO attachments (fname, akey, value) VALUES(?, ?, ?)',
					[fname, akey, data]);
				}, function(err) {
					deferred.reject(err);
				}, function() {
					deferred.resolve();
				});
			});

			return deferred.promise;
		},

		rmAttachment: function(path) {
			var parts = utils.splitAttachmentPath(path);
			var fname = parts[0];
			var akey = parts[1];
			var deferred = Q.defer();
			this._db.transaction(function(tx) {
				tx.executeSql('DELETE FROM attachments WHERE fname = ? AND akey = ?',
				[fname, akey]);
			}, function(err) {
				deferred.reject(err);
			}, function() {
				deferred.resolve();
			});

			return deferred.promise;
		}
	};

	return {
		init: function(config) {
			var openDb = window.openDatabase;
			var deferred = Q.defer();
			if (!openDb) {
				deferred.reject("No WebSQL");
				return deferred.promise;
			}

			var db = openDb('largelocalstorage', '1.0', 'large local storage', config.size);

			db.transaction(function(tx) {
				tx.executeSql('CREATE TABLE IF NOT EXISTS files (fname unique, value)');
				tx.executeSql('CREATE TABLE IF NOT EXISTS attachments (fname, akey, value)');
				tx.executeSql('CREATE INDEX IF NOT EXISTS fname_index ON attachments (fname)');
				tx.executeSql('CREATE INDEX IF NOT EXISTS akey_index ON attachments (akey)');
				tx.executeSql('CREATE UNIQUE INDEX IF NOT EXISTS uniq_attach ON attachments (fname, akey)')
			}, function(err) {
				deferred.reject(err);
			}, function() {
				deferred.resolve(new WSQL(db));
			});

			return deferred.promise;
		}
	}
})(Q);
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

		// TODO: split and normalize the path at this level
		getAttachment: function(path) {
			this._checkAvailability();
			return this._impl.getAttachment(path);
		},

		setAttachment: function(path, data) {
			this._checkAvailability();
			return this._impl.setAttachment(path, data);
		},

		getAttachmentURL: function(path) {
			this._checkAvailability();
			return this._impl.getAttachmentURL(path);
		},

		getAllAttachments: function(path) {
			this._checkAvailability();
			return this._impl.getAllAttachments(path);
		},

		getAllAttachmentURLs: function(path) {
			this._checkAvailability();
			return this._impl.getAllAttachmentURLs(path);
		},

		revokeAttachmentURL: function(url) {
			this._checkAvailability();
			return this._impl.revokeAttachmentURL(url);
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
glob.LargeLocalStorage = LargeLocalStorage;
})(this);
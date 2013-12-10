var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
var persistentStorage = navigator.persistentStorage || navigator.webkitPersistentStorage;
var FilesystemAPIProvider = (function(Q) {
	function makeErrorHandler(deferred, finalDeferred) {
		// TODO: normalize the error so
		// we can handle it upstream
		return function(e) {
			if (e.code == 1) {
				deferred.resolve(undefined);
			} else {
				if (finalDeferred)
					finalDeferred.reject(e);
				else
					deferred.reject(e);
			}
		}
	}

	function getAttachmentPath(docKey, attachKey) {
		docKey = docKey.replace(/\//g, '--');
		var attachmentsDir = docKey + "-attachments";
		return {
			dir: attachmentsDir,
			path: attachmentsDir + "/" + attachKey
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

	function FSAPI(fs, numBytes, prefix) {
		this._fs = fs;
		this._capacity = numBytes;
		this._prefix = prefix;
		this.type = "FileSystemAPI";
	}

	FSAPI.prototype = {
		getContents: function(path, options) {
			var deferred = Q.defer();
			path = this._prefix + path;
			this._fs.root.getFile(path, {}, function(fileEntry) {
				fileEntry.file(function(file) {
					var reader = new FileReader();

					reader.onloadend = function(e) {
						var data = e.target.result;
						var err;
						if (options && options.json) {
							try {
								data = JSON.parse(data);
							} catch(e) {
								err = new Error('unable to parse JSON for ' + path);
							}
						}

						if (err) {
							deferred.reject(err);
						} else {
							deferred.resolve(data);
						}
					};

					reader.readAsText(file);
				}, makeErrorHandler(deferred));
			}, makeErrorHandler(deferred));

			return deferred.promise;
		},

		// create a file at path
		// and write `data` to it
		setContents: function(path, data, options) {
			var deferred = Q.defer();

			if (options && options.json)
				data = JSON.stringify(data);

			path = this._prefix + path;
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
				}, makeErrorHandler(deferred));
			}, makeErrorHandler(deferred));

			return deferred.promise;
		},

		ls: function(docKey) {
			var isRoot = false;
			if (!docKey) {docKey = this._prefix; isRoot = true;}
			else docKey = this._prefix + docKey + "-attachments";

			var deferred = Q.defer();

			this._fs.root.getDirectory(docKey, {create:false},
			function(entry) {
				var reader = entry.createReader();
				readDirEntries(reader, []).then(function(entries) {
					var listing = [];
					entries.forEach(function(entry) {
						if (!entry.isDirectory) {
							listing.push(entry.name);
						}
					});
					deferred.resolve(listing);
				});
			}, function(error) {
				deferred.reject(error);
			});

			return deferred.promise;
		},

		clear: function() {
			var deferred = Q.defer();
			var failed = false;
			var ecb = function(err) {
				failed = true;
				deferred.reject(err);
			}

			this._fs.root.getDirectory(this._prefix, {},
			function(entry) {
				var reader = entry.createReader();
				reader.readEntries(function(entries) {
					var latch = 
					utils.countdown(entries.length, function() {
						if (!failed)
							deferred.resolve();
					});

					entries.forEach(function(entry) {
						if (entry.isDirectory) {
							entry.removeRecursively(latch, ecb);
						} else {
							entry.remove(latch, ecb);
						}
					});

					if (entries.length == 0)
						deferred.resolve();
				}, ecb);
			}, ecb);

			return deferred.promise;
		},

		rm: function(path) {
			var deferred = Q.defer();
			var finalDeferred = Q.defer();

			// remove attachments that go along with the path
			path = this._prefix + path;
			var attachmentsDir = path + "-attachments";

			this._fs.root.getFile(path, {create:false},
				function(entry) {
					entry.remove(function() {
						deferred.promise.then(finalDeferred.resolve);
					}, function(err) {
						finalDeferred.reject(err);
					});
				},
				makeErrorHandler(finalDeferred));

			this._fs.root.getDirectory(attachmentsDir, {},
				function(entry) {
					entry.removeRecursively(function() {
						deferred.resolve();
					}, function(err) {
						finalDeferred.reject(err);
					});
				},
				makeErrorHandler(deferred, finalDeferred));

			return finalDeferred.promise;
		},

		getAttachment: function(docKey, attachKey) {
			var attachmentPath = this._prefix + getAttachmentPath(docKey, attachKey).path;

			var deferred = Q.defer();
			this._fs.root.getFile(attachmentPath, {}, function(fileEntry) {
				fileEntry.file(function(file) {
					if (file.size == 0)
						deferred.resolve(undefined);
					else
						deferred.resolve(file);
				}, makeErrorHandler(deferred));
			}, function(err) {
				if (err.code == 1) {
					deferred.resolve(undefined);
				} else {
					deferred.reject(err);
				}
			});

			return deferred.promise;
		},

		getAttachmentURL: function(docKey, attachKey) {
			var attachmentPath = this._prefix + getAttachmentPath(docKey, attachKey).path;

			var deferred = Q.defer();
			var url = 'filesystem:' + window.location.protocol + '//' + window.location.host + '/persistent/' + attachmentPath;
			deferred.resolve(url);
			// this._fs.root.getFile(attachmentPath, {}, function(fileEntry) {
			// 	deferred.resolve(fileEntry.toURL());
			// }, makeErrorHandler(deferred, "getting attachment file entry"));

			return deferred.promise;
		},

		getAllAttachments: function(docKey) {
			var deferred = Q.defer();
			var attachmentsDir = this._prefix + docKey + "-attachments";

			this._fs.root.getDirectory(attachmentsDir, {},
			function(entry) {
				var reader = entry.createReader();
				deferred.resolve(
					utils.mapAsync(function(entry, cb, eb) {
						entry.file(function(file) {
							cb({
								data: file,
								docKey: docKey,
								attachKey: entry.name
							});
						}, eb);
					}, readDirEntries(reader, [])));
			}, function(err) {
				deferred.resolve([]);
			});

			return deferred.promise;
		},

		getAllAttachmentURLs: function(docKey) {
			var deferred = Q.defer();
			var attachmentsDir = this._prefix + docKey + "-attachments";

			this._fs.root.getDirectory(attachmentsDir, {},
			function(entry) {
				var reader = entry.createReader();
				readDirEntries(reader, []).then(function(entries) {
					deferred.resolve(entries.map(
					function(entry) {
						return {
							url: entry.toURL(),
							docKey: docKey,
							attachKey: entry.name
						};
					}));
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
		setAttachment: function(docKey, attachKey, data) {
			var attachInfo = getAttachmentPath(docKey, attachKey);

			var deferred = Q.defer();

			var self = this;
			this._fs.root.getDirectory(this._prefix + attachInfo.dir,
			{create:true}, function(dirEntry) {
				deferred.resolve(self.setContents(attachInfo.path, data));
			}, makeErrorHandler(deferred));

			return deferred.promise;
		},

		// rm the thing at dirname(path)+"-attachments/"+basename(path)
		rmAttachment: function(docKey, attachKey) {
			var attachmentPath = getAttachmentPath(docKey, attachKey).path;

			var deferred = Q.defer();
			this._fs.root.getFile(this._prefix + attachmentPath, {create:false},
				function(entry) {
					entry.remove(function() {
						deferred.resolve();
					}, makeErrorHandler(deferred));
			}, makeErrorHandler(deferred));

			return deferred.promise;
		},

		getCapacity: function() {
			return this._capacity;
		}
	};

	return {
		init: function(config) {
			var deferred = Q.defer();

			if (!requestFileSystem) {
				deferred.reject("No FS API");
				return deferred.promise;
			}

			var prefix = config.name + '/';

			persistentStorage.requestQuota(config.size,
			function(numBytes) {
				requestFileSystem(window.PERSISTENT, numBytes,
				function(fs) {
					fs.root.getDirectory(config.name, {create: true},
					function() {
						deferred.resolve(new FSAPI(fs, numBytes, prefix));
					}, function(err) {
						console.error(err);
						deferred.reject(err);
					});
				}, function(err) {
					// TODO: implement various error messages.
					console.error(err);
					deferred.reject(err);
				});
			}, function(err) {
				// TODO: implement various error messages.
				console.error(err);
				deferred.reject(err);
			});

			return deferred.promise;
		},

		isAvailable: function() {
			return requestFileSystem != null;
		}
	}
})(Q);
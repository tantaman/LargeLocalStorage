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
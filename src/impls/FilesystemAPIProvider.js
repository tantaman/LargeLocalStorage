var FilesystemAPIProvider = (function(Q) {
	function dirName(path) {
		var i = path.lastIndexOf('/');
		if (i !== -1) {
			return path.substring(0, i);
		} else {
			return '';
		}
	}

	  /**
	  * Returns the base name of the path
	  * e.g., baseName("path/to/some/file.txt") will return "file.txt"
	  * baseName("path/to/some/file.txt", "txt") will return "file"
	  * baseName("path/to/some/dir/") will return "dir"
	  * @method baseName
	  * @param {String} path the path
	  * @param {String} [extension] extension to be stripped
	  * @returns {String} base name
	  */
	function baseName(path, extension) {
		var idx;
		if (path[path.length - 1] === "/") {
			path = path.substring(0, path.length - 1);
		}
		idx = path.lastIndexOf("/");
		if (idx !== -1 && idx + 1 < path.length) {
			path = path.substring(idx + 1, path.length);
		}
		if (extension != null) {
			idx = path.lastIndexOf(extension);
			if (idx + extension.length === path.length) {
				path = path.substring(0, idx);
			}
		}
		return path;
	}

	//
	// myPres.strut
	// myPres.strut-attachments/
	//  -a1
	//  -a2
	// otherPres.strut
	// otherPres.strut-attachments/
	//  -a1
	//  -a2...

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
		var dir = dirName(path);
		var attachmentsDir = dir + "-attachments";
		return {
			dir: attachmentsDir,
			path: attachmentsDir + "/" + baseName(path)
		};
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
						deferred.resolve();
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
			this._fs.root.getFile(attachmentPath, {}, function(fileEntry) {
				deferred.resolve(fileEntry.toURL());
			}, makeErrorHandler(deferred, "getting attachment file entry"));

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
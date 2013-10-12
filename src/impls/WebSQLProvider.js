var WebSQLProvider = (function(Q) {
	var URL = window.URL || window.webkitURL;
	var convertToBase64 = utils.convertToBase64;
	var dataURLToBlob = utils.dataURLToBlob;

	function WSQL(db) {
		this._db = db;
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
			var parts = path.split('/');
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

		revokeAttachmentURL: function(url) {
			URL.revokeObjectURL(url);
		},

		setAttachment: function(path, data) {
			var parts = path.split('/');
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
			var parts = path.split('/');
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
			}, function(err) {
				deferred.reject(err);
			}, function() {
				deferred.resolve(new WSQL(db));
			});

			return deferred.promise;
		}
	}
})(Q);
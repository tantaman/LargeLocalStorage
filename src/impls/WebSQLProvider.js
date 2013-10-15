var WebSQLProvider = (function(Q) {
	var URL = window.URL || window.webkitURL;
	var convertToBase64 = utils.convertToBase64;
	var dataURLToBlob = utils.dataURLToBlob;

	function WSQL(db) {
		this._db = db;
		this.type = 'WebSQL';
	}

	WSQL.prototype = {
		getContents: function(docKey) {
			var deferred = Q.defer();
			this._db.transaction(function(tx) {
				tx.executeSql('SELECT value FROM files WHERE fname = ?', [docKey],
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

		setContents: function(docKey, data) {
			var deferred = Q.defer();
			this._db.transaction(function(tx) {
				tx.executeSql(
				'INSERT OR REPLACE INTO files (fname, value) VALUES(?, ?)', [docKey, data]);
			}, function(err) {
				deferred.reject(err);
			}, function() {
				deferred.resolve();
			});

			return deferred.promise;
		},

		rm: function(docKey) {
			var deferred = Q.defer();
			this._db.transaction(function(tx) {
				tx.executeSql('DELETE FROM files WHERE fname = ?', [docKey]);
				tx.executeSql('DELETE FROM attachments WHERE fname = ?', [docKey]);
			}, function(err) {
				deferred.reject(err);
			}, function() {
				deferred.resolve();
			});

			return deferred.promise;
		},

		getAttachment: function(fname, akey) {
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

		getAttachmentURL: function(docKey, attachKey) {
			var deferred = Q.defer();
			this.getAttachment(docKey, attachKey).then(function(blob) {
				deferred.resolve(URL.createObjectURL(blob));
			}, function() {
				deferred.reject();
			});

			return deferred.promise;
		},

		getAllAttachments: function(fname) {
			var deferred = Q.defer();

			this._db.transaction(function(tx) {
				tx.executeSql('SELECT value, akey FROM attachments WHERE fname = ?',
				[fname],
				function(tx, res) {
					// TODO: ship this work off to a webworker
					// since there could be many of these conversions?
					var result = [];
					for (var i = 0; i < res.rows.length; ++i) {
						var item = res.rows.item(i);
						result.push({
							docKey: fname,
							attachKey: item.akey,
							data: dataURLToBlob(item.value)
						});
					}

					deferred.resolve(result);
				});
			}, function(err) {
				deferred.reject(err);
			});

			return deferred.promise;
		},

		getAllAttachmentURLs: function(fname) {
			var deferred = Q.defer();
			this.getAllAttachments(fname).then(function(attachments) {
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

		revokeAttachmentURL: function(url) {
			URL.revokeObjectURL(url);
		},

		setAttachment: function(fname, akey, data) {
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

		rmAttachment: function(fname, akey) {
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
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
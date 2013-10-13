(function() {
	'use strict';

	var storage = new LargeLocalStorage({
		size: 20 * 1024 * 1024,
		forceProvider: 'WebSQL'
	});

	storage.initialized.then(function() {
		console.log(storage.getCapacity());
		var $storageNotice = $('.storageNotice');
		$storageNotice.css('opacity', 0);
		setTimeout(function() {
			$storageNotice.css('display', 'none');	
		}, 1100);

		bind();
	}, function() {
		console.log('denied');
	});

	function bind() {
		var dndArea = new Album($('.dndArea'));
	}

	function Album($el) {
		this.$el = $el;
		this._drop = this._drop.bind(this);
		this._photoAdded = this._photoAdded.bind(this);
		this._appendImage = this._appendImage.bind(this);
		this.$el.on('dragover', copyDragover);
		this.$el.on('drop', this._drop);
		this.$thumbs = this.$el.find('.thumbnails');

		this._renderExistingPhotos();
	}

	Album.prototype = {
		_drop: function(e) {
			e.stopPropagation();
			e.preventDefault();

			e = e.originalEvent;

			foreach(this._photoAdded, keep(isImage, e.dataTransfer.files));
		},

		_photoAdded: function(file) {
			// TOOD: see if already exists??
			storage.setAttachment('album/' + file.name, file)
			.then(function() {
				return storage.getAttachmentURL('album/' + file.name);
			}).then(this._appendImage);
		},

		_appendImage: function(url) {
			// TODO: correctly scale the img (preserving aspect ratio)
			this.$thumbs.append('<div class="col-sm-6 col-md-3">' +
				'<img src="' + url + '" style="width: 171px; height: 180px"></img>' +
				'</div>');
			// storage.revokeAttachmentURL(url);
		},

		_renderExistingPhotos: function() {
			// storage.getAllAttachmentURLs('album/')
			// .then(function(urls) {
			// 	foreach(this._appendImage, urls);
			// });
		}
	};


	function copyDragover(e) {
		e.stopPropagation();
		e.preventDefault();
		e = e.originalEvent;
		e.dataTransfer.dropEffect = 'copy';
	}

	function foreach(cb, arr) {
		for (var i = 0; i < arr.length; ++i) {
			cb(arr[i]);
		}
	}

	function isImage(file) {
		return file.type.indexOf('image') == 0;
	}

	function keep(pred, arr) {
		return filter(not(pred), arr);
	}

	function not(pred) {
		return function(e) {
			return !pred(e);
		}
	}

	function filter(pred, arr) {
		var result = [];
		for (var i = 0; i < arr.length; ++i) {
			var e = arr[i];
			if (!pred(e))
				result.push(e);
		}

		return result;
	}
})();
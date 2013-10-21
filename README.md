LargeLocalStorage
=================


**Problem:** You need a large key-value store in the browser.

To make things worse: 
* DOMStorage only gives you 5mb
* Chrome doesn't let you store blobs in IndexedDB
* Safari doesn't support IndexedDB,
* IE and Firefox both support IndexedDB but not the FilesystemAPI.

`LargeLocalStorage` bridges all of that to give you a large capacity (up to several GB when authorized by the user) key-value store in the browser
(IE 10, Chrome, Safari 6+, Firefox, Opera). 

* [docs](http://tantaman.github.io/LargeLocalStorage/doc/classes/LargeLocalStorage.html)
* [tests](http://tantaman.github.io/LargeLocalStorage/test/)
* [demo app](http://tantaman.github.io/LargeLocalStorage/examples/album/)

## Basic Rundown / Examples

### Creating a database

```javascript
// Specify desired capacity in bytes
var desiredCapacity = 125 * 1024 * 1024;

// Create a 125MB key-value store
var storage = new LargeLocalStorage({size: desiredCapacity, name: 'myDb'});

// Await initialization of the storage area
storage.initialized.then(function(grantedCapacity) {
  // Check to see how much space the user authorized us to actually use.
  // Some browsers don't indicate how much space was granted in which case
  // grantedCapacity will be 1.
  if (grantedCapacity != -1 && grantedCapacity != desiredCapacity) {
  }
});
```
  
### Setting data

```javascript  
// You can set the contents of "documents" which are identified by a key.
// Documents can only contains strings for their values but binary
// data can be added as attachments.
// All operations are asynchronous and return Q promises
storage.setContents('docKey', "the contents...").then(function() {
  alert('doc created/updated');
});
  
// Attachments can be added to documents.
// Attachments are Blobs or any subclass of Blob (e.g, File).
// Attachments can be added whether or not a corresponding document exists.
// setAttachment returns a promise so you know when the set has completed.
storage.setAttachment('myDoc', 'titleImage', blob).then(function() {
    alert('finished setting the titleImage attachment');
});
```

### Retrieving Data

```javascript
// get the contents of a document
storage.getContents('myDoc').then(function(content) {
});

// Call getAttachment with the docKey and attachmentKey
storage.getAttachment('myDoc', 'titleImage').then(function(titleImage) {
    // Create an image element with the retrieved attachment
    // (or video or sound or whatever you decide to attach and use)
    var img = new Image();
    img.src = URL.createObjectURL(titleImage);
    document.body.appendChild(img);
    URL.revokeObjectURL(titleImage);
});


// If you just need a URL to your attachment you can get
// the attachment URL instead of the attachment itself
storge.getAttachmentURL('somePreviouslySavedDoc', 'someAttachment').then(function(url) {
  // do something with the attachment URL
  // ...
    
  // revoke the URL
  storage.revokeAttachmentURL(url);
});
```

### Listing
```javascript
// You can do an ls to get all of the keys in your data store
storage.ls().then(function(listing) {
  // listing is a list of all of the document keys
  alert(listing);
});
  
// Or get a listing of a document's attachments
storage.ls('somePreviouslySavedDoc').then(function(listing) {
  // listing is a list of all attachments belonging to `somePreviouslySavedDoc`
  alert(listing);
});
```

### Removing
```javascript
// you can remove a document with rm
// removing a document also removes all of that document's
// attachments.
storage.rm('somePreviouslySavedDoc');
  
// you can also rm an attachment
storage.rmAttachment('someOtherDocKey', 'attachmentKey');

// removals return promises as well so you know when the removal completes (or fails).
storage.rm('docKey').then(function() {
  alert('Removed!');
}, function(err) {
  console.error('Failed removal');
  console.error(err);
});

// clear the entire database
storage.clear();
```

More:
* Read the [docs](http://tantaman.github.io/LargeLocalStorage/doc/classes/LargeLocalStorage.html)
* Run the [tests](http://tantaman.github.io/LargeLocalStorage/test/)
* View the [demo app](http://tantaman.github.io/LargeLocalStorage/examples/album/)

##Including

Include it on your page with a script tag:

```
<script src="path/to/LargeLocalStorage.js"></script>
```

Or load it as an amd module:

```
define(['components/lls/dist/LargeLocalStorage'], function(lls) {
  var storage = new lls({size: 100 * 1024 * 1024});
});
```

LLS depends on [Q](https://github.com/kriskowal/q) so you'll have to make sure you have that dependency.

##Getting
downlad it directly

* (dev) https://raw.github.com/tantaman/LargeLocalStorage/master/dist/LargeLocalStorage.js
* (min) https://raw.github.com/tantaman/LargeLocalStorage/master/dist/LargeLocalStorage.min.js

Or `bower install lls`

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

* Run the [tests](http://tantaman.github.io/LargeLocalStorage/test/)
* Read the [docs](http://tantaman.github.io/LargeLocalStorage/doc/classes/LargeLocalStorage.html)
* View the [examples](http://tantaman.github.io/LargeLocalStorage/examples/album/)


##Using

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

##Getting
downlad it directly: https://raw.github.com/tantaman/LargeLocalStorage/master/dist/LargeLocalStorage.js

Or `bower install lls`

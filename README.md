LargeLocalStorage
=================


**Problem:** You need a large key-value store in the browser.

To make things worse: 
* DOMStorage only gives you 5mb
* Chrome doesn't let you store blobs in IndexedDB
* Safari doesn't support IndexedDB,
* IE and Firefox both support IndexedDB but not the FilesystemAPI.

`LargeLocalStorage` bridges all of that to give you a large (several hundred MB) key-value store in the browser
(IE 10, Chrome, Safari 6+, Firefox, Opera). 

* Run the [tests](http://tantaman.github.io/LargeLocalStorage/test/)
* Read the [docs](http://tantaman.github.io/LargeLocalStorage/doc/classes/LargeLocalStorage.html)
* View the [examples](http://tantaman.github.io/LargeLocalStorage/examples/album/)

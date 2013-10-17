
	return LargeLocalStorage;
}

if (typeof define === 'function' && define.amd) {
	define(['Q'], definition);
} else {
	glob.LargeLocalStorage = definition.call(glob, Q);
}

}).call(this, this);
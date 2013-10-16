
/**
@author Matt Crinklaw-Vogt
*/
(function(root) {
function PipeContext(handlers, nextMehod, end) {
	this._handlers = handlers;
	this._next = nextMehod;
	this._end = end;

	this._i = 0;
}

PipeContext.prototype = {
	next: function() {
		// var args = Array.prototype.slice.call(arguments, 0);
		// args.unshift(this);
		this.__pipectx = this;
		return this._next.apply(this, arguments);
	},

	_nextHandler: function() {
		if (this._i >= this._handlers.length) return this._end;

		var handler = this._handlers[this._i].handler;
		this._i += 1;
		return handler;
	},

	length: function() {
		return this._handlers.length;
	}
};

function indexOfHandler(handlers, len, target) {
	for (var i = 0; i < len; ++i) {
		var handler = handlers[i];
		if (handler.name === target || handler.handler === target) {
			return i;
		}
	}

	return -1;
}

function forward(ctx) {
	return ctx.next.apply(ctx, Array.prototype.slice.call(arguments, 1));
}

function coerce(methodNames, handler) {
	methodNames.forEach(function(meth) {
		if (!handler[meth])
			handler[meth] = forward;
	});
}

var abstractPipeline = {
	addFirst: function(name, handler) {
		coerce(this._pipedMethodNames, handler);
		this._handlers.unshift({name: name, handler: handler});
	},

	addLast: function(name, handler) {
		coerce(this._pipedMethodNames, handler);
		this._handlers.push({name: name, handler: handler});
	},

 	/**
 	Add the handler with the given name after the 
 	handler specified by target.  Target can be a handler
 	name or a handler instance.
 	*/
	addAfter: function(target, name, handler) {
		coerce(this._pipedMethodNames, handler);
		var handlers = this._handlers;
		var len = handlers.length;
		var i = indexOfHandler(handlers, len, target);

		if (i >= 0) {
			handlers.splice(i+1, 0, {name: name, handler: handler});
		}
	},

	/**
	Add the handler with the given name after the handler
	specified by target.  Target can be a handler name or
	a handler instance.
	*/
	addBefore: function(target, name, handler) {
		coerce(this._pipedMethodNames, handler);
		var handlers = this._handlers;
		var len = handlers.length;
		var i = indexOfHandler(handlers, len, target);

		if (i >= 0) {
			handlers.splice(i, 0, {name: name, handler: handler});
		}
	},

	/**
	Replace the handler specified by target.
	*/
	replace: function(target, newName, handler) {
		coerce(this._pipedMethodNames, handler);
		var handlers = this._handlers;
		var len = handlers.length;
		var i = indexOfHandler(handlers, len, target);

		if (i >= 0) {
			handlers.splice(i, 1, {name: newName, handler: handler});
		}
	},

	removeFirst: function() {
		return this._handlers.shift();
	},

	removeLast: function() {
		return this._handlers.pop();
	},

	remove: function(target) {
		var handlers = this._handlers;
		var len = handlers.length;
		var i = indexOfHandler(handlers, len, target);

		if (i >= 0)
			handlers.splice(i, 1);
	}
};

function createPipeline(pipedMethodNames) {
	var end = {};
	var endStubFunc = function() { return end; };
	var nextMethods = {};

	function Pipeline(pipedMethodNames) {
		this.pipe = {
			_handlers: [],
			_contextCtor: PipeContext,
			_nextMethods: nextMethods,
			end: end,
			_pipedMethodNames: pipedMethodNames
		};
	}

	var pipeline = new Pipeline(pipedMethodNames);
	for (var k in abstractPipeline) {
		pipeline.pipe[k] = abstractPipeline[k];
	}

	pipedMethodNames.forEach(function(name) {
		end[name] = endStubFunc;

		nextMethods[name] = new Function(
			"var handler = this._nextHandler();" +
			"handler.__pipectx = this.__pipectx;" +
			"return handler." + name + ".apply(handler, arguments);");

		pipeline[name] = new Function(
			"var ctx = new this.pipe._contextCtor(this.pipe._handlers, this.pipe._nextMethods." + name + ", this.pipe.end);"
			+ "return ctx.next.apply(ctx, arguments);");
	});

	return pipeline;
}

createPipeline.isPipeline = function(obj) {
	return obj instanceof Pipeline;
}

if (typeof define === 'function' && define.amd) {
	define(createPipeline);
} else if (typeof exports === "object") {
	module.exports = createPipeline;
} else {
	root.pipeline = createPipeline;
}

})(this);
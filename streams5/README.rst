Javascript Streams 5: Composition and Currying
==============================================

.. contents:: :local:

Training Objective
------------------

After this training, you will have a better understanding of working with functions as return values (like with ``bind``) by being introduced to function composition and function currying.

Overview
--------

Now that we've extracted information from ``build.gradle`` in order to identify dependencies, we notice that the modules outside of the ``modules`` folder (such as ``portal-impl`` and ``portal-service``) do not have a ``build.gradle`` file at all, so our code doesn't actually handle all the different module types.

However, filling in those details does not actually help us with understanding streams, so this work is already done for you.

Instead, what we'll focus on this time is understanding streams in a more general sense as operations on single elements, and broaden our understanding of what we can see as a single element and what we can see as operations.

Streams as Events
-----------------

It's common to think of streams where the data consists of single elements and stream functions as functions that operate on just one element at a time. In fact, the remainder of this will actually cover how we can force certain classes of functions to work in this way.

However, it's important to remind ourselves before we get too lost in that conceptualization that it's not the only way streams work, especially since they deal with asynchronous data sources. As such, before we get started with coding, we'll start with a common abstraction associated with streams: time (the availability of stream elements).

Towards that end, there are functions that allow you to bundle a stream of single elements into a stream of arrays (or bundle them into streams of arrays and then condense those arrays back down into single elements) based on certain time-related criteria.

One example is to simply bundle them based on fixed sizes, or fixed sizes also bounded by time. You can think of them as similar to the Lucene commit interval, where whichever criterion is satisfied first is used as the batching criteria.

* `batch <http://highlandjs.org/#batch>`__
* `batchWithTimeOrCount <Stream.batchWithTimeOrCount(ms, n)>`__

You can also limit the processing of elements to a steady time interval.

* `ratelimit <http://highlandjs.org/#ratelimit>`__

Another approach is to make sure that you don't get overwhelmed with data. Therefore, you use time as a measure for how you wish to discard data.

* `debounce <http://highlandjs.org/#debounce>`__
* `throttle <http://highlandjs.org/#throttle>`__
* `debounce vs. throttle <https://css-tricks.com/the-difference-between-throttling-and-debouncing/>`__

Function Currying
-----------------

Function currying is a way to convert a multi-argument function into a chain of single-argument functions. In a way, this is like having a partial function that doesn't evaluate until all arguments have been provided.

* `Why Curry Helps <https://hughfdjackson.com/javascript/why-curry-helps/>`__

Because currying always emits a chain of single-argument functions, you can take advantage of this in order to take a function that accepts a variable number of arguments, such as ``path.join``, and return another variant of it that only accepts a specific number of arguments (no more, no less). This is particularly useful when using variable argument functions with ``map`` and ``forEach``, which will pass too many arguments when often you only care about the first argument and the others will cause the function to behave incorrectly.

Coincidentally, the ``highland`` module provides a function ``ncurry`` which is normally used for function currying.

* `highland.ncurry <http://highlandjs.org/#ncurry>`__

Note that the idea of currying down to exactly one argument is also known as converting a function to a unary function. A popular Javascript library ``lodash`` provides a currying function as well as two variants (``ary`` and ``unary``) that allow for limiting a function to some number of arguments (setting an upper bound) as well as exactly one argument.

* `lodash.ary <https://lodash.com/docs#ary>`__
* `lodash.unary <https://lodash.com/docs#unary>`__

Example
~~~~~~~

In ``lib/streams3.js``, we implemented a function ``getModuleIncludeFolders`` by creating a function ``isValidSourceFolder`` that was the result of binding the ``folder`` as the first argument to the function ``isValidSourcePath``.

.. code-block:: javascript

	var isValidSourcePath = streams3.isValidSourcePath;

	function getModuleIncludeFolders(folder) {
		var isValidSourceFolder = isValidSourcePath.bind(null, folder);

		// other code here
	};

While this works, if we were to curry the ``isValidSourcePath`` function, we no longer have to explicitly use ``bind``, because calling the function with one argument automatically returns another function.

.. code-block:: javascript

	var isValidSourcePath = highland.ncurry(2, streams3.isValidSourcePath);

	function getModuleIncludeFolders(folder) {
		var isValidSourceFolder = isValidSourcePath(folder);

		// other code here
	};

This has been done in the function ``getCoreIncludeFolders``.

Checkpoint
~~~~~~~~~~

In order to protect against the possibility that ``getFilePath`` one day updates its message signature to take in multiple variables, we declare our own version of ``getFilePath`` that restricts it to two variables, ignoring however many variables the original function takes in.

.. code-block:: javascript

	var getFilePath = function(item1, item2) {
		return streams2.getFilePath(item1, item2);
	};

Redefine this function using function currying.

Function Flipping
-----------------

One of the interesting side-effects of having a curried function with a limited number of parameters is that if you create a function that accepts exactly two parameters, you can reverse the arguments.

* `flip <http://highlandjs.org/#flip>`__

Checkpoint
~~~~~~~~~~

Update ``flipGetFilePath`` to take advantage of flipping arguments.

Function Composition
--------------------

If you call ``map`` and then immediately chain its result into another function, this has a slight memory overhead penalty because each ``map`` emits a new array as the result. In these cases, it would be nice if there were some way to easily chain the result without the intermediate array.

It turns out that in order to do that, we can compose the functions and create a new function :math:`h(x) = f(g(x))`.

* `Function Composition <https://en.wikipedia.org/wiki/Function_composition>`__

The ``highland`` module provides the ``compose`` method to perform function composition. Note that like regular function composition, you read off the name of the functions from the outermost function to the innermost function. Therefore, the first function that receives the value is the last argument to ``compose``.

Example
~~~~~~~

We had the following code in ``isModuleFolder`` for checking whether something was a module folder.

.. code-block:: javascript

	return validSubfiles.map(getPath).every(isFile) &&
		!invalidSubFiles.map(getPath).some(isFile) &&
		subfolders.map(getPath).some(isDirectory);

While this works, calling ``map`` followed by ``every`` isn't always a clear intent, nor is calling ``map`` followed by ``some``. The performance is also suboptimal in this case as well. This could be updated through function composition to read as follows.

.. code-block:: javascript

	return validSubfiles.every(highland.compose(isFile, getPath)) &&
		!invalidSubFiles.some(highland.compose(isFile, getPath)) &&
		subfolders.some(highland.compose(isDirectory, getPath));

If the ordering of the functions feels counterintuitive, ``highland`` also provides the ``seq`` function which inverts the order so that you can treat it as a sequence of function calls (or a pipeline of data transformations) rather than as function composition.

.. code-block:: javascript

	return validSubfiles.every(highland.seq(getPath, isFile)) &&
		!invalidSubFiles.some(highland.seq(getPath, isFile)) &&
		subfolders.some(highland.seq(getPath, isDirectory));

Each person has their own preference on how this works, so in practice, feel free to choose whichever makes the most sense for you from a readability perspective.

Checkpoint
~~~~~~~~~~

In ``lib/streams5.js``, we have a very similar function named ``isCoreFolder``. Perform both of the above changes and confirm that the program still returns the same output.
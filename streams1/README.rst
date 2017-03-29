Javascript Streams 1: Functions as First-Class Citizens
=======================================================

.. contents:: :local:

Training Objective
------------------

After this training, you will be familiar with the idea of functions as first-class citizens of a language. This includes the idea of passing a function as a parameter to another function as well as the idea of having functions that return functions as a return value.

As a result of this training, you will be able to reflect on some of your childhood exposure to functions and have a vague understanding of ``filter``, ``map``, and ``reduce`` as they relate to the pure numeric functions you learned in school. It's okay if you don't have a deep understanding, as elaborating this will be the goal of a future training session.

From a Javascript perspective, you will have a better understanding of how ``this`` differs between Java and Javascript, and you will also be introduced to the idea of reflection as an embodiment of functions being first-class citizens. You will recognize ``bind``, ``call``, and ``apply``, which are found frequently throughout libraries you debug on a daily basis, and understand what they do and how they differ from normal invocations of a function.

Finally, you will understand how ``bind`` and ``apply`` can be used to generate families of functions, particularly when those functions take advantage of the implied ``arguments`` parameter passed to every Javascript function.

SOLDIER, First Class
--------------------

A function describes the relationship between something in an input space and something in an output space. Often you either hear this described as *relating* something from a domain to the codomain, or *mapping* something from a domain to the codomain.

* `Functions as Relations <http://www.mathsisfun.com/sets/function.html>`__
* `Domain, Range, and Codomain <http://www.mathsisfun.com/sets/domain-range-codomain.html>`__

When a function is treated as a first-class citizen, that means that the language allows you to focus on passing around these building blocks of input to output converters. We pass them around as parameter values, as return values, and as variable values without requiring that you have them be wrapped in another top level object during the hand-off.

* `First-Class Citizen <https://en.wikipedia.org/wiki/First-class_citizen>`__

Childhood Mathematics
---------------------

Since we all come from different backgrounds, we first introduce the concept behind functions as first-class citizens as you may have learned about them through your primary school experiences. We will cover the ideas behind the functions ``filter``, ``map``, and ``reduce`` that will be further elaborated in another training.

We will also use some of slightly more advanced notation you would have learned as a secondary school student as an excuse to use MathJax for pretty mathematical symbols.

* `MathJax <https://www.mathjax.org/>`__

``filter``
~~~~~~~~~~

Early in life, you were probably introduced to categorizations where you were asked, "Is this a plant?" or "Is this an animal?" To these kinds of questions, you would identify attributes that would make things members of a set (:math:`x \in S`) and attributes that would allow you to reject them as members of that set (:math:`x \notin S`).

* `Element <https://en.wikipedia.org/wiki/Element_(mathematics)>`__

Essentially, you were provided a single element and you would use some algorithm in order to produce a yes or a no answer. Here, you were introduced to the idea that a single input could somehow relate to a single output. Though you wouldn't know it then, this process of applying a function to a single input to yield an output is known as a unary function.

* `Unary Function <https://en.wikipedia.org/wiki/Unary_function>`__

Put another way, you learned that there were two ways of thinking about the problem of applying the animal/plant filter to a collection. The first is you could look at the element, apply the algorithm for plant, apply the algorithm for animal, and iterate. The second is you can generate a new algorithm which categorizes things as a plant or an animal or neither plant nor animal. In other words, you had your first exposure to the idea of a function being derived by combining other functions.

* `Function Composition <https://en.wikipedia.org/wiki/Function_composition>`__

``reduce``
~~~~~~~~~~

When you were introduced to mathematics as a formal discipline, you would have learned a new class of functions that accepted two values as input and related or mapped them to a value as output.

* `Binary Function <https://en.wikipedia.org/wiki/Binary_function>`__

In primary school, you started with addition, which you understood as a binary function of the form :math:`\mathbb{N} \times \mathbb{N} \rightarrow \mathbb{N}`. Applying this over and over again, you could collect a large number of numbers and boil them down to a single number.

Eventually, you learned about subtraction and later zero and you understood functions to be :math:`\mathbb{W} \times \mathbb{W} \rightarrow \mathbb{W}`. For subtraction, you were told that situations where the subtrahend was larger than the minuend were error states and should be treated as invalid inputs to the function.

Later you would learn about multiplication and order of operations (or operator precedence).

* `Order of Operations <https://www.khanacademy.org/math/pre-algebra/order-of-operations/order_of_operations/v/introduction-to-order-of-operations>`__

This allowed you to write arbitrary expressions that would ultimately reduce to a consistent value. You may not have realized it then, but at this time, operators became a type of function that could delay evaluation until other operations completed. In other words, you were introduced to the idea of functions returning other functions that would need to be evaluated in a certain order for you to arrive at the correct result.

* `Lazy Evaluation <https://en.wikipedia.org/wiki/Lazy_evaluation>`__

After understanding zero, you were introduced to division, where you had two numbers as input (dividend and divisor) and the function produced an ordered pair as output (quotient and remainder). You were told that the divisor could not be zero, and you implicitly understood division to be of the form :math:`\mathbb{W} \times \mathbb{N} \rightarrow \mathbb{W} \times \mathbb{W}`.

Here you realized that the idea of a "single value" was actually something that was very complex, because division returned an ordered pair. In other words, you learned that functions could return singular values, more functions, or objects with attributes.

``map``
~~~~~~~

Eventually, you wound up computing things like square roots, logarithms, the area of a circle, the surface area or volume of a sphere.

Like filtering functions, these were unary functions. However, rather than applying the result to a decision on categorization, the results were carried forward into another computation. In a way, you could think of each one as converting a number (such as the radius) into another number (such as the area of the circle).

Since these functions returned "irrational" numbers, you were introduced to :math:`\mathbb{R}`, and you learned that how to work with this set of numbers in your binary function toolkit. You may even have had contests about who knew more than 3 digits of :math:`\pi`, and you probably even heard some fun stories about the history of mathematics.

* `Pythagorean Rationality <https://www.khanacademy.org/math/recreational-math/vi-hart/vi-cool-stuff/v/what-was-up-with-pythagoras>`__

While you may have been introduced to the idea of distributing an operation before this (such as how multiplication distributes over addition), understanding how logarithms and square roots distributed over products and sums became important in order to avoid having to apply your logarithm or square root function multiple times manually. It wouldn't be until much later that you would learn that calculators and computers have no trouble doing this.

* `Vectorized Functions <http://alyssafrazee.com/vectorization.html>`__

Function Declarations
---------------------

To start our journey with Node.js, we will use the Node.js REPL (Read, Eval, Print, Loop). Essentially, it is a console interface to the engine, similar to what you find when working with other interpreted languages such as Python, Groovy, Clojure, or Scala. You access it simply by running ``node`` without specifying a script to execute.

.. code-block:: bash

	node

Functions are denoted with the ``function`` keyword, optionally followed by a function name, followed by parentheses. The function body is enclosed in curly braces.

* `Function <https://developer.mozilla.org/en-US/docs/Glossary/Function>`__

Most functions you encounter in the real world are defined such that the parentheses immediately follow the ``function`` keyword. These functions are anonymous functions. Functions where there is a name between the ``function`` keyword and the parentheses are named functions. Practically speaking, the only difference is where in the code you can call the function and expect it to be treated as defined.

* `Hoisting <https://developer.mozilla.org/en-US/docs/Glossary/Hoisting>`__

In general, you will find that the majority of functions you encounter will be anonymous and assigned as attributes of objects.

Functions as Callbacks
----------------------

One of the most important things about Javascript is that you essentially learn to believe that it executes in a single-threaded environment. In order to make sure that your functions get called, Javascript relies on the notion of events, where events is information that is emitted and listeners are things that are interested in being notified when that information is emitted.

* `Events <https://nodejs.org/docs/latest-v0.12.x/api/events.html>`__

In strongly-typed languages, you might create a specific type of object to subscribe to each specific type of emitted event.

* `java.awt.event <https://docs.oracle.com/javase/7/docs/api/java/awt/event/package-summary.html>`__

In Javascript, functions (which are first-class citizens of the language) are what you use for this subscription. A function used for this purpose is referred to as an asynchronous callback.

* `Callback <https://en.wikipedia.org/wiki/Callback_(computer_programming)>`__

One of the simplest version of a callback is the function that you pass to ``setTimeout``. In this case, the event is after some period of time elapses, and your callback is executed once that time has elapsed.

* `Demystifying Callbacks <http://www.sitepoint.com/demystifying-javascript-closures-callbacks-iifes/#callbacks>`__

It's common to think of callbacks as something where you do not care about the precise execution order, but rather you only care about being notified that something needs to be done. However, as-stated, this isn't intuitive to everyone, so various libraries provide abstractions that make things more concrete.

* `Async <https://github.com/caolan/async>`__
* `Promises <http://github.com/promises-aplus/promises-spec/>`__

Functions with Prototypes
-------------------------

Javascript is a prototype-based language.

* `Prototype-based programming <https://en.wikipedia.org/wiki/Prototype-based_programming>`__

Essentially, everything that you can use the ``new`` keyword with is a function with a ``prototype`` attribute, and that prototype attribute is used as a base template for the object returned from using the ``new`` keyword.

* `Understanding Javascript Prototypes <https://javascriptweblog.wordpress.com/2010/06/07/understanding-javascript-prototypes/>`__

It is not uncommon to make use of the ``prototype`` attribute in order to attempt to make Javascript resemble an object-oriented programming language.

* `A Plain English Guide to Javascript Prototypes <http://sporto.github.io/blog/2013/02/22/a-plain-english-guide-to-javascript-prototypes/>`__

When doing this, you need a bit of background to understand what is actually happening with prototypes, as well as the native features of Javascript that allow you to interact with prototypes as well as the original objects.

* `Mixins, Forwarding, Delegation <http://raganwald.com/2014/04/10/mixins-forwarding-delegation.html>`__

Before you go too far down the path of treating Javascript like an object-oriented programming language, though, you will need to understand what ``this`` means in Javascript, and how you can change that meaning.

``this``
~~~~~~~~

One of the learning curves associated with Javascript is that because functions are first-class citizens, the ``this`` variable means something very different, even when the function is an attribute of an object.

* `How "this" Works <http://www.2ality.com/2014/05/this.html>`__

As an example, run the following code in Node.js REPL, which creates an object ``Logger`` that has an attribute ``log`` which takes on a function as a value and calls it in a few different ways.

.. code-block:: javascript

	var Logger = {
		name: 'Logger',
		log: function() { console.log(this); },
	};

	Logger.log();

	var log = Logger.log;
	log();

	var AlternateLogger = {
		name: 'AlternateLogger',
		log: Logger.log
	};

	AlternateLogger.log();

	void(setTimeout(Logger.log, 1000));

Notice that the value logged for ``this`` changes depending on where the function is attached.

* When it is called as though it were an attribute of the ``Logger`` object, ``this`` refers to the ``Logger`` object
* When it is called as though it were a variable in the global scope, ``this`` refers to the ``global`` object
* When it is called as though it were an attribute of the ``AlternateLogger`` object, ``this`` refers to the ``AlternateLogger`` object
* When you attach the function as a listener to an event, ``this`` refers to the event emitter

``bind``
~~~~~~~~

In order to avoid having to deal with this potential ambiguity, every function has an attribute ``bind`` which is a function that returns a copy of the wrapping function. In this copy of the function, ``this`` is explicitly defined as the parameter you passed to ``bind``.

* `Function.bind <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind>`__

It is commonly used by developers for functions that are member attributes of an object (such as our ``Logger.log`` example) so that ``this`` refers to the enclosing object. You can re-run the same test and observe that the value for ``this`` is predictably the object we passed to ``bind``.

.. code-block:: javascript

	var Logger = {
		name: 'Logger',
		log: (function() { console.log(this); }).bind(Logger)
	};

	Logger.log();

	var log = Logger.log;
	log();

	var AlternateLogger = {
		name: 'AlternateLogger',
		log: Logger.log
	};

	AlternateLogger.log();

	void(setTimeout(Logger.log, 1000));

There is another use to ``bind`` as well: partial function application.

* `Partial Function Application for Humans <http://andrewberls.com/blog/post/partial-function-application-for-humans>`__

While it's called partial function application, it really is the idea of partial argument value application in the sense that it fixes the values for the initial arguments passed to a function.

.. code-block:: javascript

	var Logger = {
		log: function(prefix, message) { console.log(prefix, message); }
	};

	var foo = Logger.log.bind(Logger, '[FOO]');
	foo('Hello world!');

	var bar = Logger.log.bind(Logger, '[BAR]');
	bar('Hello world!');

Functions as Reflection
-----------------------

As you've noticed with ``bind``, if a function is a first-class citizen of a language, you can attach attributes to it that can essentially be of any type, including more functions. There are also functions that return more functions as a result.

Beyond treating functions as prototypes for objects, there is one more attribute to a function that is interesting to developers: the ability to take any function and invoke it with a guarantee for the value of ``this`` as well as a specified list of arguments. Since ``this`` is made explicit rather than implicit, this closely resembles reflection in object oriented programming languages.

* `java.lang.reflect.Method <https://docs.oracle.com/javase/7/docs/api/java/lang/reflect/Method.html>`__

``call``
~~~~~~~~

Sometimes, you do not need a reference to the function, but rather you wish to simply call it with a specific set of values but wish to specify what the value for ``this`` should be.

In order to provide a shorthand that clarifies that you intend to call the function immediately, every function has an attribute ``call``. This attribute is a function which accepts the object to pass to ``bind`` as well as arguments (if present) to pass to the resulting function.

* `Function.call <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call>`__

Beyond aesthetics, it's fundamentally no different from calling ``bind`` followed by immediately passing the arguments directly to the returned function.

.. code-block:: javascript

	var Logger = {
		log: function() { console.log(this); }
	};

	Logger.log.bind(Logger)();
	Logger.log.call(Logger);

``apply``
~~~~~~~~~

Sometimes, you are working with a function that can take a variable number of arguments such as ``console.log``.

* `console.log <https://developer.mozilla.org/en-US/docs/Web/API/Console/log>`__

These functions take advantage of a variable ``arguments`` that is available to every function.

* `arguments <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments>`__

In these cases, you may aggregate all of your items into an array, and this array may vary in length as well. In order to call such functions with pre-aggregated argument values, every function has an attribute ``apply``. This attribute is a function which accepts an object to pass to ``bind`` and automatically unravels any provided array to pass as separate arguments to the resulting function.

* `Function.apply <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply>`__

One of the variants of ``console.log`` recognizes ``%``-style string substitutions but requires each of the values used in the substitution to be passed as a separate parameter. To handle this when there are a variable number of substitutions, it's possible to collect the arguments you wish to pass into an array and know that it will automatically be unraveled via ``apply``.

.. code-block:: javascript

	var msg = 'only %d thing %d do %d words %d you';
	var values = [1, 2, 3, 4];
	console.log.apply(console, [msg].concat(values));

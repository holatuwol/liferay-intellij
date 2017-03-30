Javascript Streams 4: Regular Expressions
=========================================

.. contents:: :local:

Training Objective
------------------

After this training, you will be aware of tools that will help you in writing regular expressions. Additionally, you will have written code to extract metadata for a module by applying regular expressions to the contents of ``build.gradle``.

Overview
--------

Regular expressions are a compact way to express a very specific set of nondeterministic finite state automata where the input sequence begins matching once a certain set of characters is seen (the start of the regular expression) and enters a terminal state at the end of the regular expression.

* `Regular Expression to NFA <http://hackingoff.com/compilers/regular-expression-to-nfa-dfa>`__

Of course, there is a deterministic finite state automata equivalent as well.

* `Finite State Machines and Regular Expressions <http://www.gamedev.net/page/resources/_/technical/general-programming/finite-state-machines-and-regular-expressions-r3176>`__

There are two reasons you might use a regular expression. The first is to simply see if the match exists. The second is to accumulate all the matches that do exist as well as extract some extra information about those matches in the form of numbered capturing (or match) groups.

* `Grouping Constructs <https://msdn.microsoft.com/en-us/library/bs2twtah(v=vs.110).aspx>`__

If you are unfamiliar with the basics, there is a tutorial online that guides you through the process of learning to write regular expressions.

* `Learn Regular Expressions <http://regexone.com/>`__

Basic Module Dependencies
-------------------------

Module files contain information about library and project dependencies.

* library dependencies
* project dependencies

This information is contained in the ``build.gradle`` file in the module folder in the ``dependencies`` section. To extract our dependencies, we can load ``build.gradle`` using the ``readFile`` function provided by the ``fs`` module.

* `fs.readFile <https://nodejs.org/docs/latest-v0.12.x/api/fs.html#fs_fs_readfile_filename_options_callback>`__

Like in the case of ``readdir`` where we used the synchronous version ``readdirSync`` instead, we will use the ``readFileSync`` variant (which waits until we have our result) rather than ``readFile`` (which uses a callback to notify when the process completes). This leads us to the following initial implementation for ``getModuleDependencies``.

.. code-block:: javascript

	function getModuleDependencies(folder) {
		var buildGradlePath = path.join(folder, 'build.gradle');

		if (!isFile(buildGradlePath)) {
			return {};
		}

		var buildGradleContents = fs.readFileSync(buildGradlePath);

		// continue dependency extraction here

		return {};
	};

Regular Expressions 1
~~~~~~~~~~~~~~~~~~~~~

From here, we will want to extract the dependency text, which we can capture with a regular expression.

.. code-block:: javascript

	var dependencyTextRegex = /dependencies \{([^\}]*)\n\s*\}/g;
	var dependencyTextResult = null;

	while ((dependencyTextResult = dependencyTextRegex.exec(buildGradleContents)) !== null) {
		var dependencyText = dependencyTextResult[1];

		// continue dependency extraction here
	}

And that's essentially the first use of a regular expression! All it does is create a capture group where we expect there to be exactly one match, and we work with that one match.

Regular Expressions 2
~~~~~~~~~~~~~~~~~~~~~

Now that we have the dependency text extracted from the ``build.gradle`` file, we should be able to arrive at an array of dependency details. In order to do that, we need to have a regular expression that keeps track of multiple matches.

We start with a regular expression which can capture dependency information for libraries. Note that unlike Java where patterns and matchers are separate entities, the pattern and the matcher are essentially the same entity in Javascript. This means that you should not share the regular expression unless the regular expression will not track multiple matches within the same text.

* `Careful when reusing Javascript RegExp objects <http://siderite.blogspot.com/2011/11/careful-when-reusing-javascript-regexp.html>`__

In our case, though, we will want to keep tracking of multiple matches within the same dependencies text. Therefore, we will declare the regular expression as a local variable in the function where we use it. This will be the ``getModuleDependencies`` function.

.. code-block:: javascript

	var libraryDependencyRegex1 = /(?:test|compile|provided)[^\n]*\sgroup: ['"]([^'"]*)['"], name: ['"]([^'"]*)['"], [^\n]*version: ['"]([^'"]*)['"]/;
	var libraryDependencyRegex2 = /(?:test|compile|provided)[^\n]*\s['"]([^'"]*):([^'"]*):([^'"]*)['"]/;

Now that we have a regular expression, we know that we can create an object representing a match from any match result provided it has three items and they are always in ``group``, ``name``, and ``version`` order. This allows us to create the following extraction function.

.. code-block:: javascript

	function getLibraryDependency(matchResult) {
		if (matchResult == null) {
			return null;
		}

		var dependency = {
			type: 'library',
			group: matchResult[1],
			name: matchResult[2],
			version: matchResult[3]
		};

		if (dependency.version.indexOf('SNAPSHOT') != -1) {
			return null;
		}

		return dependency;
	};

Regular Expressions 3
~~~~~~~~~~~~~~~~~~~~~

We are going to apply the same sequence of operations for our dependency extraction where we repeatedly match against the dependency text using a specific regular expression and then perform an operation on each match.

Traditionally, if you wanted to repeatedly match against a body of text, you use a while loop like the following.

.. code-block:: javascript

	while ((matchResult = dependencyRegex.exec(dependencyText)) !== null) {
		// do something with the match result
	}

Create the following dummy function, which accepts a text, a function, and a regular expression.

.. code-block:: javascript

	function getDependenciesWithWhileLoop(dependencyText, dependencyExtractor, dependencyRegex) {
		var dependencies = [];

		while ((matchResult = dependencyRegex.exec(dependencyText)) !== null) {
			// do something with the match result
		}

		return dependencies;
	};

Update our ``getModuleDependencies`` function so that it uses this function in order to match against the dependency text and extract our library dependencies.

.. code-block:: javascript

	var moduleDependencies = {
		libraryDependencies: [],
		projectDependencies: []
	};

	var libraryDependencyRegex1 = /(?:test|compile|provided)[^\n]*\sgroup: ['"]([^'"]*)['"], name: ['"]([^'"]*)['"], [^\n]*version: ['"]([^'"]*)['"]/;
	var libraryDependencyRegex2 = /(?:test|compile|provided)[^\n]*\s['"]([^'"]*):([^'"]*):([^'"]*)['"]/;

	while ((dependencyTextResult = dependencyTextRegex.exec(buildGradleContents)) !== null) {
		var dependencyText = dependencyTextResult[1];

		Array.prototype.push.apply(
			moduleDependencies.libraryDependencies,
			getDependenciesWithWhileLoop(dependencyText, getLibraryDependency, libraryDependencyRegex1));

		Array.prototype.push.apply(
			moduleDependencies.libraryDependencies,
			getDependenciesWithWhileLoop(dependencyText, getLibraryDependency, libraryDependencyRegex2));
	}

	return moduleDependencies;

Checkpoint
~~~~~~~~~~

With all these pieces in place, all that's left is to update the ``getDependenciesWithWhileLoop`` function to return all the library details as an array. You should use the ``dependencyExtractor`` function argument on each match result and update the ``dependencies`` array.

Advanced Project Dependencies
-----------------------------

In order to shorten the method calls for readability, we could potentially use ``bind`` in order to pre-apply the values for the ``dependencyText`` and ``dependencyExtractor`` parameters.

.. code-block:: javascript

	var getLibraryDependencies = getDependenciesWithWhileLoop.bind(null, dependencyText, getLibraryDependency);

As shown above, the value of ``this`` doesn't actually matter in this case. When the value of ``this`` doesn't matter, binding to an arbitrary object such as ``null`` or ``undefined`` may be difficult to understand as explaining how the object should interpret ``this`` is somewhat confusing.

Partial Function Application 1
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To improve legibility, the ``highland`` module provides a ``partial`` function which makes this "I don't believe the context matters" more obvious.

* `highland.partial <http://highlandjs.org/#partial>`__

To use it, we first require the module.

.. code-block:: javascript

	var highland = require('highland');

Then we make use of the exported function.

.. code-block:: javascript

	var getLibraryDependencies = highland.partial(getDependenciesWithWhileLoop, dependencyText, getLibraryDependency);

We can then call it from ``getModuleDependencies`` and have the appropriate return value.

.. code-block:: javascript

	Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex1));
	Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex2));

Partial Function Application 2
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Inside of the dependency text, there are additional dependencies that are not declared as depending on a specific version of a library. These have the following form.

.. code-block:: groovy

	project(":apps:configuration-admin:configuration-admin-api")

We can create a regular expression that will be able to handle the second list of project dependencies. Assuming we had this regular expression, the dependency extraction function for a match result can look like the following.

.. code-block:: javascript

	function getProjectDependency(matchResult) {
		if (matchResult == null) {
			return null;
		}

		var dependency = {
			type: 'project',
			name: matchResult[1]
		};

		return dependency;
	};

Let's update ``getModuleDependencies`` to provide a partial function which retrieves project dependencies using the specified dependency extractor.

.. code-block:: javascript

	var getProjectDependencies = highland.partial(getDependenciesWithWhileLoop, dependencyText, getProjectDependency);

Checkpoint 1
~~~~~~~~~~~~

Define a regular expression in a variable ``projectDependencyRegex`` which you can pass to this partial function which will capture the names of all projects found in dependency text (``configuration-admin-api`` in the second case). With this regular expression, we can initialize our second set of project dependencies as follows.

.. code-block:: javascript

	Array.prototype.push.apply(moduleDependencies.projectDependencies, getProjectDependencies(projectDependencyRegex));

In case you need something to help debug your regular expressions, there are several online tools you can use which will help you determine if you've identified the correct regular expression.

* `RegEx101 <https://regex101.com/#javascript>`__
* `Debuggex <https://www.debuggex.com/>`__
* `RegViz <http://www.regviz.org/>`__
* `RegExr <http://regexr.com/>`__

Checkpoint 2
~~~~~~~~~~~~

As an aside, Liferay has lots of implicit dependencies that aren't readily known through the build.gradle file. One such example is that every test module implicitly depends on ``portal-test``, and may also depend on ``portal-test-integration``.

We can account for this with the following code.

.. code-block:: javascript

	if (isDirectory(path.join(folder, 'src/main/test')) ||
		isDirectory(path.join(folder, 'src/main/testIntegration'))) {

		moduleDependencies.projectDependencies.push({
			type: 'project',
			name: 'portal-test'
		});
	}

	if (isDirectory(path.join(folder, 'src/main/testIntegration'))) {
		moduleDependencies.projectDependencies.push({
			type: 'project',
			name: 'portal-test-integration'
		});
	}

Regular Expression Streams
--------------------------

In most cases involving a regular expression across a body of text, we match against regular expressions using a while loop. This is because we are repeatedly applying our regular expression to a body of text by making use of a global flag.

However, we have something unique when we deal with dependencies, because the way ``build.gradle`` files are parsed and handled, new lines have semantic meaning. As a result, dependencies cannot span across lines. This means that if we split ``dependencyText`` into separate lines, then we can apply the regular expression to each line separately and we no longer need the global flag.

In other words, we can generate a string array and then use the ``map`` and ``filter`` functions we are already familiar with in order to perform regular expression matching.

Checkpoint
~~~~~~~~~~

Let's replace the while loop with ``map`` and ``filter`` operations on the split array.

.. code-block:: javascript

	function getDependenciesWithStreams(dependencyText, dependencyExtractor, dependencyRegex) {
		return dependencyText.split('\n')
			// perform additional work here
	}

As a precaution, since we are now reusing the regular expression for each element using ``map`` (so the regular expression is shared), make sure that the regular expressions are no longer marked as global (remove the ``g`` flag for the same reasons noted before).

* `Careful when reusing Javascript RegExp objects <http://siderite.blogspot.com/2011/11/careful-when-reusing-javascript-regexp.html>`__

Update ``getDependenciesWithStreams`` to make use of ``RegExp.prototype.exec`` in order to generate all matches of the regular expression. As a hint, you may notice that you will need to consider the correct value of ``this`` to use for the function.
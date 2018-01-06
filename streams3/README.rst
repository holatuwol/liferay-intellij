Javascript Streams 3: Arrays as First-Class Citizens
====================================================

.. contents:: :local:

Training Objective
------------------

After this training, you will be comfortable converting code that you may have originally written using loops into code that leverages ``filter``, ``map``, and ``reduce``.

Higher Order Functions
----------------------

We commonly think of an array as an ordered collection of a fixed number of elements. In this kind of a model, you imagine of iterating over the array elements in order to perform work. In other words, you mentally represent an array as a tuple with no additional capabilities of its own.

* `Tuple <https://en.wikipedia.org/wiki/Tuple>`__

For example, now we have an array of folders, and our next step is to limit this to only those folders that are actually module roots. Normally, you might conceptualize solving this problem by iterating over each of the folders and selecting those that match some criteria in order to accomplish the filtering.

While this is a natural way to handle this step, we will instead achieve this by believing in the possibility that the array is capable of dispatching the work on its own rather than requiring that we unravel the array and perform each dispatch ourselves.

For this particular problem, there is not much of a conceptual difference, but the resulting code will actually look fairly different as we will need to recognize that the method of dispatch is that the array has higher order functions as attributes.

* `Higher Order Functions <http://eloquentjavascript.net/05_higher_order.html>`__

As noted above, a higher order function is a function that accepts another function as an argument. We've seen an example of this with ``setTimeout``, and we have also seen something similar with event listeners.

With arrays, the functions we are particularly interested in are ``filter``, ``map``, and ``reduce``.

Get Containing Folder
---------------------

``map``
~~~~~~~

Arrays in Javascript provide a shortcut for iterating over all elements in the array and calling a function on them and building a new array from the return values of that function. This is the ``map`` function.

* `Map <https://en.wikipedia.org/wiki/Map_(higher-order_function)>`__

While we normally think of ``map`` as a unary function, in Javascript it's implemented slightly differently in that there will be three arguments passed to the function: the value as the first argument, the index as the second argument, and the complete array as the third argument.

* `Array.map <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map>`__

Knowing that, we need to make sure that any mapping function we pass to ``map`` does not accept a variable number of arguments as input.

The functions ``getFolders`` and ``getModuleFolders`` have been from ``lib/streams2.js`` into our ``lib/streams3.js``. Looking at the ``getFolders`` function, we see that for every file, we perform the same ``getFilePath``. Now that we now about ``map``, we can now change our loop by binding our ``folderPath`` parameter as the first argument to the function, resulting in the following.

.. code-block:: javascript

	var filePaths = fileNames.map(getFilePath.bind(null, folderPath));

	for (var i = 0; i < filePaths.length; i++) {
		var filePath = filePaths[i];

		...
	}

Identify Module Folder
----------------------

``filter``
~~~~~~~~~~

Within our for loop in ``getFolders``, we have the following check.

.. code-block:: javascript

	if (isDirectory(filePath) && !isHidden(filePath)) {
		...
	}

The idea of finding something that is both a directory (``isDirectory``) and is not hidden (``isHidden``) is something that we could combine into a more clearly-named function.

.. code-block:: javascript

	function isVisibleDirectory(filePath) {
		return isDirectory(filePath) && !isHidden(filePath);
	};

It turns out that having this smaller function allows us to make another simplification to the for loop of ``getFolders``: the use of ``filter``.

* `Array.filter <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter>`__

As a programming concept, ``filter`` processes a data structure and returns a copy of the data structure but only with elements that satisfy some condition.

* `Filter <https://en.wikipedia.org/wiki/Filter_(higher-order_function)>`__

Knowing that, we could use ``filter`` and apply the following simplification to our loop and further reduce the nesting depth of our code.

.. code-block:: javascript

	var visibleDirectories = filePaths.filter(isVisibleDirectory);

	for (var i = 0; i < visibleDirectories.length; i++) {
		var filePath = visibleDirectories[i];

		...
	}

Checkpoint 1
~~~~~~~~~~~~

``filter`` is a higher-order function that accepts functions that return a boolean value. While we're all familiar with writing functions that return boolean values, let's make sure we're used to the idea of passing it to an array in order to achieve some desired behavior by updating our ``isModuleFolder`` function, which currently looks like this.

.. code-block:: javascript

	function isModuleFolder(folder) {
		if ((folder.indexOf('/sdk/') != -1) && (folder.indexOf('-templates') != -1)) {
			return false;
		}

		if (!isFile(getFilePath(folder, 'build.gradle'))) {
			return false;
		}

		if (!isFile(getFilePath(folder, 'bnd.bnd')) && !isFile(getFilePath(folder, 'package.json'))) {
			return false;
		}

		if (!isDirectory(getFilePath(folder, 'docroot')) && !isDirectory(getFilePath(folder, 'src'))) {
			return false;
		}

		return true;
	};


All Javascript arrays have a ``some`` function and an ``every`` function. ``some`` accepts a function and returns ``true`` if at least one of the values in the array map to a ``true`` value. ``every`` accepts a function and returns ``true`` if all values in the array map to a ``true`` value.

* `Array.some <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some>`__
* `Array.every <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every>`__

Update our ``isModuleFolder`` function to use ``map`` in order to convert the names contained in ``subfiles`` and ``subfolders`` into paths, and use ``every`` for the ``subfiles`` and ``some`` for the ``subfolders`` in order to determine if we have a module folder.

.. code-block:: javascript

	function isModuleFolder(folder) {
		if ((folder.indexOf('/archetype-resources') != -1) || (folder.indexOf('/gradleTest') != -1)) {
			return false;
		}

		var getPath = getFilePath.bind(null, folder);

		var requiredFiles = ['build.gradle'];
		var descriptors = ['bnd.bnd', 'package.json'];
		var sourceRoots = ['docroot', 'src'];

		// Determine whether it is potentially a module folder
		var isPotentialModuleFolder = ...;

		if (!isPotentialModuleFolder) {
			return false;
		}

		return true;
	};

Checkpoint 2
~~~~~~~~~~~~

We can perform the same transformation with ``isSubRepo``, but use ``map`` and ``filter`` in order to transform the various elements of the array into the contents of the ``.gitrepo`` files before we call ``isSubRepo`` on each element to determine if we are actually looking at a folder that has been split into a separate repository.

As a warning, because ``fs.readFileSync`` ordinarily takes in three parameters, it's not safe to use for ``map`` on an array. A wrapper ``readFileSync`` has been provided which is safe to use for ``map``.

.. code-block:: javascript

	function isSubRepo(folder) {
		var possibleGitRepoFileLocations = ['.gitrepo', '../.gitrepo', '../../.gitrepo'];

		// Determine whether some/any of the possibleGitRepoFileLocations
		// satisfy the isSubRepo function call.
		var isAnyGitRepoModePull = ...;

		return isAnyGitRepoModePull;
	};

Checkpoint 3
~~~~~~~~~~~~

Populate ``moduleFolders`` by replacing the for loop in ``getModuleFolders`` with a call to ``filter``. This is what our for loop currently looks like.

.. code-block:: javascript

	function getModuleFolders(folderPath, maxDepth) {
		var findResultFolders = getFolders(folderPath, maxDepth);
		var moduleFolders = [];

		for (var i = 0; i < findResultFolders.length; i++) {
			if (isModuleFolder(findResultFolders[i])) {
				moduleFolders.push(findResultFolders[i]);
			}
		}

		return moduleFolders;
	};

Build Module Details
--------------------

Our next step is to take our list of module folders and end up with a list of module details. Initially, we know for sure that we need a module name as well as a path that points to the module. For that we will also need the ``path`` module.

.. code-block:: javascript

	function getModuleOverview(folder) {
		return {
			moduleName: path.basename(folder),
			modulePath: folder.replace(/\\/g, '/')
		};
	};

Beyond that, there are many attributes that go into creating a module file, and we will steadily build out what we need through simple Javascript.

Identify Source Folders
-----------------------

Module files contain a list of source folders which IntelliJ uses in order to load source files.

* source folders
* JSP folders

IntelliJ sorts source folders into two major types: those associated with source code and those associated with test code. These types are further subdivided into folders containing only source code (such as Java files) and folders containing only resource files (such as XML files). We might have a function like the following.

.. code-block:: javascript

	function getModuleIncludeFolders(folder) {
		var moduleIncludeFolders = {
			sourceFolders: sourceFolders,
			resourceFolders: resourceFolders,
			testSourceFolders: testSourceFolders,
			testResourceFolders: testResourceFolders,
			webrootFolders: webrootFolders
		};

		return moduleIncludeFolders;
	};

We can fill in the source folder paths by checking for whether any of a certain set of subfolders match.

.. code-block:: javascript

	var sourceFolders = ['docroot/WEB-INF/service', 'docroot/WEB-INF/src', 'src/main/java', 'src/main/resources/archetype-resources/src/main/java'];
	var resourceFolders = ['src/main/resources', 'src/main/resources/archetype-resources/src/main/resources'];
	var testSourceFolders = ['src/test/java', 'src/testIntegration/java', 'test/integration', 'test/unit'];
	var testResourceFolders = ['src/test/resources', 'src/testIntegration/resources'];
	var webrootFolders = ['src/main/resources/META-INF/resources'];

Checkpoint
~~~~~~~~~~

Given any set of folders, we will need to filter which of the subfolders are present within the given module folder. We also add in the requirement that the subfolder, even if it exists, cannot contain a ``.touch`` file (which signifies that it is empty and is used by Liferay to ensure that folders get added to Git). We can represent that as a function.

.. code-block:: javascript

	function isValidSourcePath(moduleRoot, sourceFolder) {
		var sourceFolderPath = getPath(moduleRoot, sourceFolder);

		return isDirectory(sourceFolderPath) && !isFile(getPath(sourceFolderPath, '.touch'));
	};

As an exercise, update ``getModuleIncludeFolders`` so that it returns the proper values for the ``sourceFolders``, ``resourceFolders``, ``testSourceFolders``, ``testResourceFolders``, and ``webrootFolders`` attributes.

Note that it may be hard to read the output of all of the folders at once. Therefore, it is recommended that you update ``createProject`` to simply call the ``getModuleIncludeFolders`` with a smaller set of modules. To do that, you'll need to first export it as public API.

.. code-block:: javascript

	exports.getModuleIncludeFolders = getModuleIncludeFolders;

This is what this debugging code might look like if we were to use ``marketplace`` as a set of modules for debugging purposes.

.. code-block:: javascript

	function createProject(portalSourceFolder) {
		var initialCWD = process.cwd();

		process.chdir(portalSourceFolder);

		//var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');
		var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules/apps/marketplace');

		var moduleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath, true);

		var moduleIncludeFolders = moduleFolders.map(getModuleIncludeFolders);

		console.dir(moduleIncludeFolders, {depth: null});

		process.chdir(initialCWD);
	};

Aggregate Module Information
----------------------------

``reduce``
~~~~~~~~~~

Let's create a dummy function which returns our module dependencies.

.. code-block:: javascript

	function getModuleDependencies(folder) {
		return {
			libraryDependencies: []
		};
	};

At this point, we have ``getModuleOverview``, ``getModuleIncludeFolders``, and ``getModuleDependencies``. We also have a provided ``getModuleVersion``, which looks up information like bundle symbolic names and bundle versions. We want to pass ``folder`` to all of these functions and aggregate the return values.

How can we aggregate a bunch of separate objects into a single object? It turns out that the (undocumented) ``_extend`` function from the ``util`` module does exactly that, but it does it with two objects at a time. A naive way of doing this is to simply nest the function calls to ``util._extend``.

.. code-block:: javascript

	function getModuleDetails(folder) {
		var result = util._extend(
			getModuleOverview(folder),
			getModuleVersion(folder)
		);

		var result = util._extend(
			result,
			getModuleIncludeFolders(folder)
		);

		result = util._extend(
			result,
			getModuleDependencies(folder));

		return result;
	};

While we could do this a little differently and nest everything rather than have everything in a flat loop, it would start resembling callback hell once the number of functions chained together increases beyond 4 or 5. This leads one to ask, "Isn't there a better way?"

* `Callback Hell <http://callbackhell.com/>`__

It turns out that if you aggregate the results into an array, ``reduce`` uses the provided function to convert the list into a single accumulated value (though this single accumulated value could very well be another list).

* `Array.reduce <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce>`__

Reduce is actually part of a family of functions collectively known as ``fold``, similar to what you think of when you think of code folding.

* `Fold <https://en.wikipedia.org/wiki/Fold_(higher-order_function)>`__

Conceptually, this is similar to ``some`` and ``every`` (which you used earlier in this lesson), which uses a specific function to distill a list into a single boolean value. It is also similar to ``join``, which uses a specified delimiter in order to combine the array elements into a string.

Knowing that, a slightly less naive way to do this would be to use ``reduce``.

.. code-block:: javascript

	function getModuleDetails(folder) {
		var moduleOverview = getModuleOverview(folder);
		var moduleVersion = getModuleVersion(folder);
		var moduleIncludeFolders = getModuleIncludeFolders(folder);
		var moduleDependencies = getModuleDependencies(folder);

		var moduleDetailsArray = [moduleOverview, moduleVersion, moduleIncludeFolders, moduleDependencies];

		return moduleDetailsArray.reduce(util._extend, {type: 'module'});
	};

We can debug this function from ``lib/index.js`` if we export it, just like we exported our ``getModuleIncludeFolders``.

.. code-block:: javascript

	exports.getModuleDetails = getModuleDetails;

We now update our ``createProject`` function in ``lib/index.js`` to log these module details instead of the return value for ``getModuleIncludeFolders``.

.. code-block:: javascript

	var moduleDetails = moduleFolders.map(streams3.getModuleDetails);

	console.dir(moduleDetails, {depth: null});

Checkpoint
~~~~~~~~~~

In addition to having include folders, we will want to be able to gather exclude folders so that we don't accidentally open the wrong ``portal.properties`` file and to avoid having build artifacts show up when we use the Open File dialog. As it turns out, each include folder corresponds to exactly one exclude folder.

.. code-block:: javascript

	var excludeFolderMap = {
		'docroot/WEB-INF/src': 'docroot/WEB-INF/classes',
		'src': 'classes',
		'src/main/java': 'classes',
		'src/main/resources': 'classes',
		'src/test/java': 'test-classes/unit',
		'src/test/resources': 'test-classes/unit',
		'src/testIntegration/java': 'test-classes/integration',
		'src/testIntegration/resources': 'test-classes/integration',
		'test/integration': 'test-classes/integration',
		'test/unit': 'test-classes/unit'
	};

Assume we have the following function which takes in a list of exclusion folders ``excludeFolders`` and a folder that is in the include list ``includeFolder``. After receiving this, it adds the corresponding exclude to the list if it is not already present.

.. code-block:: javascript

	function updateExcludeFolders(excludeFolders, includeFolder) {
		if (!(includeFolder in excludeFolderMap)) {
			return excludeFolders;
		}

		var excludeFolder = excludeFolderMap[includeFolder];

		if (excludeFolders.indexOf(excludeFolder) == -1) {
			excludeFolders.push(excludeFolder);
		}

		return excludeFolders;
	};

Let's declare a function ``getModuleExcludeFolders`` which by default includes all the folders which will always be created by Gradle (``build``) as well as any folders that might be created by Eclipse (``.settings``, ``bin``).

.. code-block:: javascript

	function getModuleExcludeFolders(folder, moduleIncludeFolders) {
		var moduleExcludeFolders = ['.settings', 'bin', 'build', 'tmp'];

		if (isFile(getFilePath(folder, 'package.json'))) {
			moduleExcludeFolders.push('node_modules');
		}

		if (isFile(getFilePath(folder, 'liferay-theme.json'))) {
			moduleExcludeFolders.push('build_gradle');
			moduleExcludeFolders.push('dist');
		}

		for (key in moduleIncludeFolders) {
			if (moduleIncludeFolders.hasOwnProperty(key)) {
				// do something with moduleIncludeFolders[key]
			}
		}

		return {
			excludeFolders: moduleExcludeFolders
		};
	};

And update our ``getModuleDetails`` function to use it.

.. code-block:: javascript

	function getModuleDetails(folder) {
		var moduleOverview = getModuleOverview(folder);
		var moduleIncludeFolders = getModuleIncludeFolders(folder);
		var moduleExcludeFolders = getModuleExcludeFolders(folder, moduleIncludeFolders);
		var moduleDependencies = getModuleDependencies(folder);

		var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

		return moduleDetailsArray.reduce(util._extend, {});
	}

For this exercise, use ``Array.reduce`` in order to build up the proper list of module excludes.
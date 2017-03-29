Javascript Streams 8: Streams as Transformations
================================================

.. contents:: :local:

Training Objective
------------------

Perform work using the ``libraryFilesStream`` observer stream using stream functions in order to build out IntelliJ library descriptor files.

Liferay Backup
--------------

From here on out, we will potentially be clobbering all of our portal project files as we will be writing things to disk. To prevent that, let's create a copy of Liferay's folder structure using the ``find`` command from the root of the portal source. We'll create a directory ``/tmp/test`` and replicate Liferay's folder structure without its files there.

.. code-block:: bash

	mkdir /tmp/test
	cd /path/to/portal/source

	find . -type d | grep "\(src\|docroot\)" | xargs -I '{}' mkdir -p /tmp/test/'{}'
	find . -name bnd.bnd -exec cp --parents {} /tmp/test \;
	find . -name build.gradle -exec cp --parents {} /tmp/test \;

From here on out, we will test our module by pointing to this newly-created folder.

.. code-block:: bash

	node bin/run.js /tmp/test

Overview
--------

Library files exist in the ``.idea/libraries`` folder and have the file name ``group_name_version.xml``. Like everything else so far in IntelliJ, they are components. In this specific case, the component has the name ``libraryTable`` and uses the following XML for the component definition.

.. code-block:: xml

	<component name="libraryTable">
		<library name="LIBRARY_NAME" type="repository">
			<CLASSES>
				<root url="jar://$PROJECT_DIR$/JAR_PATH!/" />
			</CLASSES>
			<JAVADOC />
			<SOURCES />
		</library>
	</component>

Checkpoint
~~~~~~~~~~

Let's work backwards from the XML file towards our module details and describe the data that we need in order to reach our objective. These are the attributes we have available:

* ``moduleName``
* ``modulePath``
* ``sourceFolders``
* ``resourceFolders``
* ``testSourceFolders``
* ``testResourceFolders``
* ``webrootFolders``
* ``excludeFolders``
* ``libraryDependencies``
* ``projectDependencies``

Identify Libraries
------------------

A common stream operation is to pull an attribute from an object and only operate on that attribute value. This is made available as the ``pluck`` function.

* `highland.pluck <http://highlandjs.org/#pluck>`__

When plucking attributes, sometimes the attribute is not defined on the object we pluck from, and this results in a mapping to an ``undefined`` value. If you would like to eliminate anything that is ``undefined``, this is available as the ``compact`` function on streams.

* `highland.compact <http://highlandjs.org/#compact>`__

If you've transformed one element into another, it's not uncommon for this to result in multiple values from the transformation of a single element, and it is not uncommon for this to be returned as an array. Ideally, however, we would take a stream of arrays and convert it to a stream of individual elements. This capability is provided by ``flatten``.

* `highland.flatten <http://highlandjs.org/#flatten>`__

Finally, when you have a stream of individual elements that originated from a stream of arrays, it is not uncommon for their to be duplicates. In this case, it may be beneficial to eliminate the duplicates from the array. This requires unicity detection, which is available as the ``uniqBy`` function on streams.

* `highland.uniqBy <http://highlandjs.org/#uniqBy>`__

Checkpoint
~~~~~~~~~~

Assume we have the following unicity function.

.. code-block:: javascript

	function isSameLibraryDependency(left, right) {
		return (left.group == right.group) &&
			(left.name == right.name) &&
			(left.version == right.version);
	};

Based on what we've said above, transform ``libraryFilesStream`` from a stream of module details into a stream of library details. Slowly add the transformations based on the chain of transformations we derived during our first checkpoint and log each transformation to make sure that the result is in line with that chain of transformations.

.. code-block:: javascript

	libraryFilesStream
		.each(console.log);

Check Gradle Folders
--------------------

We now have a bunch of library descriptions, but do we even know the path to the Gradle JAR that corresponds to these library descriptions to see if it's a library file we should care about?

It turns out that if we check the ``.gradle`` folder in the Liferay source, there is a pattern to the paths for the gradle files.

* `Liferay Gradle cache <https://github.com/liferay/liferay-portal/tree/master/.gradle/caches/modules-2/files-2.1>`__

If you choose a specific dependency, you'll see that the folder path for that dependency is ``group/name/version``. Beneath that folder are two folders named with a long string of seemingly random letters, and within one of those folders is our JAR file. It turns out that this long string corresponds to a hash of the file.

Since the hash of the file contents is the folder, this can cause some problems in trying to retrieve file paths (since you append what you know as the second part of the path rather than the first). For this purpose, we can use the ``flip`` function that's provided by ``highland``, which returns a curried function with the arguments flipped.

* `highland.flip <http://highlandjs.org/#flip>`__

In an ideal world, we would be able to update our ``library`` object with an attribute pointing to the path to the expected Gradle JAR (if one existed) and we could apply some kind of filter based on the presence of that attribute.

It turns out that with a little bit of help from higher order functions, this functionality is also available, and one of them is an old friend we might remember from arrays.

* `highland.doto <http://highlandjs.org/#doto>`__
* `highland.filter <http://highlandjs.org/#filter>`__

Our familiar function ``filter`` requires a function returning a boolean value. In this case, we would like for the function to tell us whether the attribute key exists in our object.

.. code-block:: javascript

	function keyExistsInObject(key, object) {
		return object && key in object;
	};

As a side-note, finding whether a key exists at all in an object is not built into streams. However, finding out if a key is missing from an object actually is built in, because it's the same as finding a specific value (``undefined``), allowing us to use ``.where({'attributeName': undefined})`` in order to perform that filter.

* `highland.where <http://highlandjs.org/#where>`__

Checkpoint 1
~~~~~~~~~~~~

Filter the stream so that it only contains elements that contain the ``group`` attribute.

You'll know if you've managed to successfully achieve this by replacing your call to ``filter`` with a call to ``reject`` and confirming that the output yields the ``development`` library, the ``global`` library, the ``portal`` library, and a handful of libraries where Liferay has not fixed in its dependencies.

* `highland.reject <http://highlandjs.org/#reject>`__

Checkpoint 2
~~~~~~~~~~~~

There are theoretically two places that a dependency can come from: a Gradle cache (in the case of modules plugins in core) and a local Maven repository (in the case of plugins SDK modules). We can encapsulate that with a function that will eventually check for both, but for now, only checks for Gradle.

.. code-block:: javascript

	function getLibraryPaths(library) {
		var gradleLibraryPaths = getGradleLibraryPaths(library);

		if (gradleLibraryPaths.length != 0) {
			return gradleLibraryPaths;
		}

		return [];
	};

For Gradle, we will want the following function which converts a library description into a Gradle JAR if the library has a ``group`` attribute (anything without such an attribute is something like a core library which is just a folder).

.. code-block:: javascript

	function getGradleLibraryPaths(library) {
		if (!('group' in library)) {
			return [];
		}

		var gradleBasePath = '.gradle/caches/modules-2/files-2.1';

		var folderPath = [library.group, library.name, library.version].reduce(getFilePath, gradleBasePath);

		if (!isDirectory(folderPath)) {
			return [];
		}

		var jarName = library.name + '-' + library.version + '.jar';

		var jarPaths = fs.readdirSync(folderPath)
			.map(getFilePath(folderPath))
			.map(highland.flip(getFilePath, jarName))
			.filter(isFile);

		return jarPaths;
	}

Update our work on the ``libraryFilesStream`` in order to use ``getLibraryPaths`` in order to return the arrays of Gradle library paths corresponding to each library and log the result.

.. code-block:: javascript

	libraryFilesStream
		.each(console.log);

Checkpoint 3
~~~~~~~~~~~~

Dependencies come in two forms: regular JAR dependencies, and POM wrapper dependencies. Let's assume we have the following function.

.. code-block:: javascript

	function isFirstOccurrence(value, index, array) {
		return array.indexOf(value) == index;
	};

With this function, the following code can be added to our existing ``getGradleLibraryPaths`` in order to return the result of parsing such a ``pom.xml`` file.

.. code-block:: javascript

	var pomName = library.name + '-' + library.version + '.pom';

	var pomPaths = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, pomName))
		.filter(isFile);

	if (pomPaths.length > 0) {
		return jarPaths.concat(getPomDependencyPaths(pomPaths[0], library.version)).sort().filter(isFirstOccurrence);
	}

	return jarPaths;

This code contains logic which attempts to handle wrapper dependencies. A wrapper dependency is something similar to the ``shrinkwrap-depchain`` module from ``org.jboss.shrinkwrap``), where there is no JAR file and only a ``pom.xml`` file describing the library's dependencies. This leads to the following code to read in a ``pom.xml``.

.. code-block:: javascript

	function getPomDependencyPaths(pomAbsolutePath, libraryVersion) {
		var pomContents = fs.readFileSync(pomAbsolutePath);

		var dependencyTextRegex = /<dependencies>([\s\S]*?)<\/dependencies>/g;
		var dependencyTextResult = dependencyTextRegex.exec(pomContents);

		if (!dependencyTextResult) {
			return [];
		}

		var dependencyText = dependencyTextResult[1];

		var libraryDependencyRegex = /<groupId>([^>]*)<\/groupId>[^<]*<artifactId>([^>]*)<\/artifactId>[^<]*<version>([^>]*)<\/version>/g;
		var libraryDependencies = getDependenciesWithWhileLoop(dependencyText, getLibraryDependency, libraryDependencyRegex);

		return libraryDependencies
			.map(getLibraryPaths);
	};

Checkpoint 4
~~~~~~~~~~~~

You may have noticed that we now have an array of arrays whenever we have to switch to parsing a ``pom.xml``. In streams, we would collapse these arrays with a ``flatten``, but no such built-in function exists in handling arrays. Therefore, we will need to write one.

.. code-block:: javascript

	function flatten(accumulator, next) {
		if (!accumulator) {
			return next;
		}

		if (!next) {
			return accumulator;
		}

		return accumulator.concat(next);
	};

You may have also noticed that the libraries a literal ``${project.version}`` which stands for the current project's version is to be passed onto its dependencies. Assume you have the following function which can replace the version specified on the library with a version specified as an argument in the function.

.. code-block:: javascript

	function replaceProjectVersion(version, library) {
		if (library.version == '${project.version}') {
			library.version = version;
		}

		return library;
	};

Use these two functions in order to ensure that the library version is properly updated and that we have a flattened array consisting only of JAR paths.

Create Library Files
--------------------

The XML file for the library component will be stored in the ``.idea/libraries`` folder and the XML has the following structure.

.. code-block:: xml

	<library name="LIBRARY_NAME" type="repository">
		<CLASSES>
			<root url="jar://$PROJECT_DIR$/JAR_PATH!/" />
		</CLASSES>
		<JAVADOC />
		<SOURCES />
	</library>

Library names take on the format ``group:name:version``, and the gradle JAR path are the JAR files located in the folders that we just examined in Liferay source control. The XML file names are closely connected with the library name, but no special characters are allowed (they are replaced with underscores).

Checkpoint 1
~~~~~~~~~~~~

Following the pattern from before where we set attribute values, we now provide a new function which updates a library object with the ``libraryName`` attribute value.

.. code-block:: javascript

	function setLibraryName(library) {
		if ('group' in library) {
			library['libraryName'] = library.group + ':' + library.name + ':' + library.version;
		}
		else {
			library['libraryName'] = library.name;
		}

		return library;
	};

Update your ``libraryFilesStream`` transformations to add an additional transformation which adds the path to a library. Use ``console.dir`` to confirm that the transformation results in new library objects that have the desired ``libraryName`` attribute.

Checkpoint 2
~~~~~~~~~~~~

We also have a function which converts a path to a library (similar to one which we may have from the Gradle library path retrieval) into an XML element. The following code also accounts for absolute paths and variables.

.. code-block:: javascript

	function getLibraryRootElement(libraryPath) {
		if ((libraryPath.indexOf('/') == 0) || (libraryPath.indexOf('$') == 0)) {
			return '<root url="jar://' + libraryPath + '!/" />';
		}
		else {
			return '<root url="jar://$PROJECT_DIR$/' + libraryPath + '!/" />';
		}
	};

Leveraging this function, we can declare a function which generates the XML content for a library.

.. code-block:: javascript

	function getLibraryTableXML(library) {
		var libraryTableXML = [];

		libraryTableXML.push('<library name="' + library['libraryName'] + '" type="repository">');
		libraryTableXML.push('<properties maven-id="' + library['libraryName'] + '" />');

		var binaryPaths = getLibraryPaths(library);

		if (binaryPaths.length > 0) {
			libraryTableXML.push('<CLASSES>');
			Array.prototype.push.apply(libraryTableXML, binaryPaths.map(getLibraryRootElement));
			libraryTableXML.push('</CLASSES>');
		}
		else {
			libraryTableXML.push('<CLASSES />');
		}

		libraryTableXML.push('<JAVADOC />');

		var sourcePaths = [];

		if (sourcePaths.length > 0) {
			libraryTableXML.push('<SOURCES>');
			Array.prototype.push.apply(libraryTableXML, sourcePaths.map(getLibraryRootElement));
			libraryTableXML.push('</SOURCES>');
		}
		else {
			libraryTableXML.push('<SOURCES />');
		}

		libraryTableXML.push('</library>');

		return libraryTableXML.join('\n');
	};

Update your transformations so that all the XML for all modules is logged to the console.

Checkpoint 3
~~~~~~~~~~~~

Now that we have all the XML, in theory, we would be able to begin passing this through our familiar transformations to create an IntelliJ XML file. However, since this does not have the standard XML headers, and the file content will be just the component XML.

.. code-block:: javascript

	function getLibraryXML(library) {
		var fileName = library['libraryName'].replace(/\W/g, '_') + '.xml';

		var libraryTableComponent = {
			name: 'libraryTable',
			content: getLibraryTableXML(library)
		};

		return {
			name: '.idea/libraries/' + fileName,
			content: getComponentXML(libraryTableComponent)
		};
	};

Replace the previous transformation with one which retrieves the complete library XML (using the above function for the transformation) and save them to the ``.idea/libraries`` folder by replacing our ``console.log`` with ``saveContent``.

Chain the stream transformations together and confirm that running the script results in the ``.idea/libraries`` containing the required XML files.

Update Module Files
-------------------

Our last step is to take advantage of the fact that we now have library files at the project level to update each of our module files with a reference to these libraries.

Checkpoint
~~~~~~~~~~

Assume we have the following function.

.. code-block:: javascript

	var getLibraryOrderEntryElement = highland.ncurry(5, getOrderEntryElement, 'library', 'name', 'libraryName');

Since our ``setLibraryName`` function returns the object that was updated (not normally required for functions passed to ``doto``), this means that if you're working with an array rather than a stream, it can be used in ``map``.

Add our libraries to each of the XML generated by ``getNewModuleRootManagerXML``. You are encouraged to imitate the existing logic for project dependencies as well as perform the same kind of filtering logic we added to ``libraryFilesStream`` to avoid referencing non-existent Gradle JARs. Make sure that it appears below the project dependencies, because order matters and you'd much rather Control+Click into source code than a decompiled class file.

Summary
-------

We've worked with some additional functions from the ``highland`` library in order to generate our library files.

Our last step in the project will be to account for some of the libraries (``development``, ``global``, and ``portal``) and also go over what would be needed in order to incorporate Maven source JARs. And from there, we will have a valid IntelliJ project!
Javascript Streams 6: Streams as Arrays
=======================================

.. contents:: :local:

Training Objective
------------------

Receive an introduction to Highland streams concepts and its relationship to arrays. Use that understanding in order to build out module files based on the module details gathered in previous sessions.

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

As you explore the Node.js universe, you will encounter a wide variety of productivity libraries for handling the common operations involving arrays (all data known in advance) and event emitters (data emitted asynchronously over time) in Javascript, such as `lodash <https://lodash.com/#features>`__, `Underscore.js <http://underscorejs.org/>`__, and `bluebird <http://bluebirdjs.com/docs/getting-started.html>`__.

However, when you work with them, you are constantly asked to remember whether you are dealing with a data source where you know all the data in advance or if the data will be emitted asynchronously over time, as different approaches are used to deal with each data type.

As the `highland <http://highlandjs.org/>`__ library points out, a stream is an abstraction that asks that you forget about the predictability of the data's appearance (synchronous vs. asynchronous) and instead focus on the operations that you wish to perform on that data.

Stream Basics
-------------

Stream Creation
~~~~~~~~~~~~~~~

Like syntax you may already be familiar with in libraries like ``jQuery``, ``highland`` is exported as a function, and you can pass arguments to it in order to construct a stream. One common example is to pass an array and treat the elements of the array as the elements in a stream.

At this point, we remember that we have two arrays of module details from our past exercises (one for OSGi modules and another for standard portal modules), so we could simply pass each of our array to the ``highland`` function, and we would have two streams. Once we do this in ``lib/streams6.js``, we would have the following in our ``createProjectWorkspace`` function.

.. code-block:: javascript

	function createProjectWorkspace(coreDetails, moduleDetails) {
		var moduleStream = highland(moduleDetails);
		var coreStream = highland(coreDetails);
	};

If you're familiar with the concept of a generator (from languages like Python) that use the notion of a ``yield`` or a ``push`` mechanism, you can also create streams using generator-like functions.

* `highland async <http://highlandjs.org/#async>`__

Merged Streams
~~~~~~~~~~~~~~

Next up, we will want to merge the two streams together, because we'd like to operate on everything in exactly the same way.

* `highland.merge <http://highlandjs.org/#merge>`__

The resulting source code that we would add to ``lib/streams6.js`` appears as follows.

.. code-block:: javascript

	var detailsStream = highland.merge([moduleStream, coreStream]);

Concatenated Streams
~~~~~~~~~~~~~~~~~~~~

Note that it is temptating to consider concatenating the two streams together, as there is a method for that:

* `highland.concat <http://highlandjs.org/#concat>`__

However, even though intuitively a concatenated stream is similar to a merged stream except with deterministic ordering, it actually flags the stream as having been consumed because you have to essentially assume that the first stream was finite (otherwise concatenation has no meaning).

This can be a bad thing as certain functions only apply to streams that have not been consumed, most notably ``fork`` and ``observe`` (which we will discuss below). To bypass this problem, you must perform an operation on the concatenated stream that emits another stream (which will no longer have the consumed flag), and you operate in this new stream instead.

Parallel Streams
~~~~~~~~~~~~~~~~

As we know from Java 8, callbacks that you pass to the functions that returns another stream will be lazily evaluated. Namely, nothing actually happens until the elements of the stream are consumed with a function that doesn't return another stream.

This lazy evaluation allows you to take each of the emitted substreams and either ``fork`` or ``observe`` them (which, as we noted when discussing ``concat``, works on any stream that has not yet been flagged as having been consumed).

* `highland.fork <http://highlandjs.org/#fork>`__
* `highland.observe <http://highlandjs.org/#observe>`__

We will be performing three distinct operations on the same stream of module details.

* generate a module file for each module
* generate a project file that tells IntelliJ to load each module file
* generate a library file for each library that tells IntelliJ where to find each library dependency

So, if we were to use ``observe`` (which is more concise, but can result in additional memory usage because it doesn't cause back-pressure), the code would look like this.

.. code-block:: javascript

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();

Conceptually, this is as though you were to have a shared log that was being read by multiple parallel processes.

* `Real Time Data's Unifying Abstraction <https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying>`__
* `Review/Summary of Real Time Data's Unifying Abstraction <http://bryanpendleton.blogspot.com/2014/01/the-log-epic-software-engineering.html>`__

Consumed Streams
~~~~~~~~~~~~~~~~

Next, we will want to make sure that ``detailsStream`` is actually consumed so that we can perform work in our observer streams (otherwise, the observer streams never receive any data). We can do this pretty trivially by calling the ``done`` function.

* `highland.done <http://highlandjs.org/#done>`__

This results in the stream elements being consumed and then, assuming that the stream is finite, invokes the callback that we provide to ``done``. For an infinite stream, the function will never get called, but the stream will be consumed forever.

.. code-block:: javascript

	detailsStream.done(function() {});

IntelliJ XML Files
------------------

With all that background information, now we're going to actually start creating files for our IntelliJ project. Nearly all IntelliJ files have the following structure:

.. code-block:: xml

	<?xml version="1.0"?>

	<module type="JAVA_MODULE" version="4">
		<component name="COMPONENT_NAME">
			CONTENT
		</component>
	</module>

Let's assume we have objects with the following JSON structure.

.. code-block:: javascript

	var sampleFileData = {
		fileName: 'hello-world.txt',
		components: [
			{ name: 'hello', content: '<foo />' },
			{ name: 'world', content: '<bar />' }
		]
	};

Knowing this data format, we can create utility methods in order to more easily generate IntelliJ XML files. You can find them in ``streams6.js`` in the attached starter code.

Checkpoint
~~~~~~~~~~

It may be more familiar to achieve the transformation of ``fileData`` into XML by looping over the components directly in loops. However, as noted in the code comments in our code sample, we will take this opportunity to use a combination of ``map`` to pre-convert items into XML and ``forEach`` to treat each loop iteration as behavior.

* `Array.map <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map>`__
* `Array.forEach <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach>`__

Update ``getIntellijXML`` to append the correct XML elements to the ``xmlContent`` array. You can create an anonymous function or you can use ``ncurry`` and ``bind`` in order to adapt existing functions such as ``Array.prototype.push`` to meet your needs.

Note that you can check whether a string is empty by using a double not operator, ``!!``, which you can emulate by composing two invocations of the ``not`` operator function.

* `highland.not <http://highlandjs.org/#not>`__

Test your changes by pasting the following into the Node.js REPL run from the root of your project folder (you may need to restart the interpreter each time if you did not setup debugging in the previous sections).

.. code-block:: javascript

	var getIntellijXML = require('./lib/streams6').getIntellijXML;

	var sampleFileData = {
		fileName: 'hello-world.txt',
		components: [
			{ name: 'hello', content: '<foo />' },
			{ name: 'world', content: '<bar />' }
		]
	};

	console.dir(getIntellijXML(sampleFileData));

Confirm that the output matches the following XML. Indentation will not match, but the indentation is added here to help you see the structure of the XML document you are creating:

.. code-block:: xml

	<?xml version="1.0"?>

	<module type="JAVA_MODULE" version="4">
		<component name="hello">
			<foo />
		</component>
		<component name="world">
			<bar />
		</component>
	</module>


Writing Module Files
--------------------

We are going to work with our ``moduleFilesStream`` in order to generate the module files. At a high level, we need to convert the module details into an XML file representing the ``.iml`` file for the module and we will need to write that XML file to disk.

To achieve this, we will be using two functions available to streams: ``map``, which is very similar to the ``Array.map`` which we have used already, and ``each``, which is very similar to the ``Array.forEach`` we used just now.

* `highland.map <http://highlandjs.org/#map>`__
* `highland.each <http://highlandjs.org/#each>`__

Checkpoint
~~~~~~~~~~

Assume that we have a function ``getModuleXML`` that will return just the file name for a module file and the components ``NewModuleRootManager`` and ``FacetManager``.

This function requires three additional functions: ``getModuleIMLPath``, which returns the path of the IML file to write, ``getNewModuleRootManagerXML`` which returns the XML content for the ``NewModuleRootManager`` component, and ``getFacetManagerXML`` which returns the XML content for the ``FacetManager`` component.

Assume we also have an implementation of ``saveContent``, which will store content that is returned in the same format as ``getIntelliJXML`` and also apply simple indentation to our XML, assuming there is no more than one element on a given line.

Work with the ``moduleFilesStream`` in order to combine these functions in order to generate mostly blank ``.iml`` files at the proper file location.

.. code-block:: javascript

	var moduleFilesStream = moduleStream.observe();
	var projectFileStream = moduleStream.observe();
	var libraryFilesStream = moduleStream.observe();

	// TODO: Replace the 'moduleFilesStream.done' below with the correct
	// function calls in order to persist the IML file to disk.

	moduleFilesStream.done(function() {});

	detailsStream.done(function() {});

It may be easiest to start from the idea of writing of the file to disk and work backwards until you are back to the module details.

You can tell your code is working by navigating to the ``modules/apps/marketplace`` folder and checking to see that a mostly-blank ``.iml`` file was generated after executing the ``run.js`` script.

.. code-block:: xml

	<?xml version="1.0"?>

	<module type="JAVA_MODULE" version="4">
	</module>

Generating Content
------------------

Having an empty block for our module is pretty useless, since IntelliJ basically wonders what in the world you're trying to do with a module that has no source folders. So for our next step, we'll create the XML content corresponding to those source folders so that IntelliJ isn't completely clueless.

Checkpoint
~~~~~~~~~~

The following is what is contained as the component description for the ``NewModuleRootManager``.

.. code-block:: xml

	<component name="NewModuleRootManager">
		<output url="file://$MODULE_DIR$/classes" />
		<output-test url="file://$MODULE_DIR$/test-classes" />
		<content url="file://$MODULE_DIR$">
			<sourceFolder url="file://$MODULE_DIR$/SOURCE_FOLDER" isTestSource="false" />
			<sourceFolder url="file://$MODULE_DIR$/RESOURCE_FOLDER" type="java-resource" />
			<sourceFolder url="file://$MODULE_DIR$/TEST_SOURCE_FOLDER" isTestSource="true" />
			<sourceFolder url="file://$MODULE_DIR$/TEST_RESOURCE_FOLDER" type="java-test-resource" />
		</content>
		<orderEntry type="inheritedJdk" />
		<orderEntry type="sourceFolder" forTests="false" />
	</component>

Add the following functions to ``streams6.js``.

.. code-block:: javascript

	function getSourceFolderElement(attributeName, attributeValue, folder) {
		return '<sourceFolder url="file://$MODULE_DIR$/' + folder + '" ' +
			attributeName + '="' + attributeValue + '" />';
	};

	function getExcludeFolderElement(folder) {
		return '<excludeFolder url="file://$MODULE_DIR$/' + folder + '" />';
	};

For this exercise, update ``getNewModuleRootManagerXML`` to use a subset of the attributes of our module (in particular, ``sourceFolders``, ``resourceFolders``, ``testSourceFolders``, ``testResourceFolders``, ``excludeFolders``) to generate the proper XML.

For simplicity, you will want need to use ``highland.partial`` in order to pre-apply arguments and ``concat`` in order to append the different XML elements together. Note that ``concat`` accepts a variable number of arguments.

Verify that your code is working by navigating to ``modules/apps/marketplace/marketplace-store-web`` and confirming that the ``marketplace-store-web.iml`` contains the following XML:

.. code-block:: xml

	<?xml version="1.0"?>

	<module type="JAVA_MODULE" version="4">
		<component name="NewModuleRootManager">
			<content url="file://$MODULE_DIR$">
				<sourceFolder url="file://$MODULE_DIR$/src/main/java" isTestSource="false" />
				<sourceFolder url="file://$MODULE_DIR$/src/main/resources" type="java-resource" />
				<excludeFolder url="file://$MODULE_DIR$/classes" />
			</content>
			<orderEntry type="inheritedJdk" />
			<orderEntry type="sourceFolder" forTests="false" />
		</component>
	</module>

Adding Web Facets
-----------------

If we just wanted source folders, the Bash scripts we had previously written already contained all the required wiring for the source folders. Instead, our real goal for this project was to ensure we had a ``FacetManager`` defined for each of our many module files.

.. code-block:: xml

	<component name="FacetManager">
		<facet type="web" name="MODULE_NAME">
			<configuration>
				<webroots>
					<root url="file://$MODULE_DIR$/WEBROOT_FOLDER" relative="/" />
				</webroots>
			</configuration>
		</facet>
	</component>

Checkpoint
~~~~~~~~~~

For this exercise, update ``getFacetManagerXML`` to use a subset of the attributes of our module (in particular, ``webrootFolders``) to generate the proper XML.

Note that there are either 0 webroot folders or 1 webroot folder, and you can make this simplifying assumption when creating your code.

Verify that your code is working by navigating to ``modules/apps/marketplace/marketplace-store-web`` and confirming that the ``marketplace-store-web.iml`` contains the following XML:

.. code-block:: xml

	<?xml version="1.0"?>

	<module type="JAVA_MODULE" version="4">
		<component name="NewModuleRootManager">
			<content url="file://$MODULE_DIR$">
				<sourceFolder url="file://$MODULE_DIR$/src/main/java" isTestSource="false" />
				<sourceFolder url="file://$MODULE_DIR$/src/main/resources" type="java-resource" />
				<excludeFolder url="file://$MODULE_DIR$/classes" />
			</content>
			<orderEntry type="inheritedJdk" />
			<orderEntry type="sourceFolder" forTests="false" />
		</component>
		<component name="FacetManager">
			<facet type="web" name="marketplace-store-web">
				<configuration>
					<webroots>
						<root url="file://$MODULE_DIR$/src/main/resources/META-INF/resources" relative="/" />
					</webroots>
				</configuration>
			</facet>
		</component>
	</module>

Summary
-------

We've worked with some very basic functions from the ``highland`` library in order to generate our module files and noticed the strong similarities that these functions have with the ones provided by arrays.

Unfortunately, our module files are still not usable, because there are no libraries (therefore, everything will have compile errors in IntelliJ). Making our module files usable will be our goal in later sessions.
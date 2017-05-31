Javascript Streams 7: Streams as Collections
============================================

.. contents:: :local:

Training Objective
------------------

Perform work using the ``projectFileStream`` observer stream using array-like functions in order to build out an IntelliJ project file. We will also re-visit array like functions and update our modules to recognize inter-module dependencies.

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

Root Modules
------------

We now have the starting point which handles everything in the ``modules`` folder, but this still leaves us with work to do for everything outside the modules folder (such as ``portal-impl``, ``portal-service``, and ``portal-web``.

The build path for root modules is dynamically built within the different ``build-*.xml`` files from the ``lib/development``, ``lib/global`` and ``lib/portal`` folders as well as project dependencies.

While we could parse the ``build-*.xml`` files to figure out what libraries are included for the ``javac`` task, since there are so few of them, we should instead hard-code the values for these modules.

Overview
--------

We are now going to with our ``projectFileStream`` in order to generate the project file. At a high level, we will need to aggregate the path to all the module files and we will need to write the final XML to ``.idea/modules.xml``.

This is the structure of the component for an IntelliJ ``modules.xml`` file.

.. code-block:: xml

	<component name="ProjectModuleManager">
		<modules>
			<module
				fileurl="file://$PROJECT_DIR$/path/to/module.iml"
				filepath="$PROJECT_DIR$/path/to/module.iml"
				group="useful/group/name" />
			...
		</modules>
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

Creating a Project File
-----------------------

Ordered Collection
~~~~~~~~~~~~~~~~~~

We will want our modules to be sorted, because IntelliJ actually likes it better this way. If we want to take a stream and return another stream with the elements in sorted order, this functionality is provided by the ``sortBy`` function exported by the ``highland`` module. We will also introduce a new module ``comparators`` which allows us to easily create comparators that compare based on an attribute value.

* `highland.sortBy <http://highlandjs.org/#sortBy>`__
* `comparators <https://www.npmjs.com/package/comparators>`__

Let's add the ``comparators`` module to our ``package.json`` and making sure the module is installed and available via ``npm install``.

.. code-block:: javascript

	"dependencies": {
		"comparators": "2.0.x",
		...
	}

From here, we can make it available using ``require``. Note that the exported API is actually available through the ``default`` attribute, so that's what we'll store to our ``comparators`` variable.

.. code-block:: javascript

	var comparators = require('comparators').default;

Once we've made it usable in our module via ``require``, this will be the resulting code.

.. code-block:: javascript

	projectFileStream
		.sortBy(comparators.comparing('moduleName'));

Checkpoint 1
~~~~~~~~~~~~

We now have enough information to generate the innermost part of our XML.

.. code-block:: xml

	<module
		fileurl="file://$PROJECT_DIR$/path/to/module.iml"
		filepath="$PROJECT_DIR$/path/to/module.iml"
		group="useful/group/name" />

Assume that we have the function ``getModuleGroupName`` which returns the group name for a module given its path. Note that this will attempt to differentiate between Liferay 7 modules folder entries, plugins SDK folder modules (which we aren't generating IML files for just yet), and root folder level modules.

Add the following function to ``streams7.js`` which constructs a module element.

.. code-block:: javascript

	function getModuleElement(module) {
		var moduleIMLPath = getModuleIMLPath(module);

		return '<module ' +
			'fileurl="file://$PROJECT_DIR$/' + moduleIMLPath + '" ' +
			'filepath="$PROJECT_DIR$/' + moduleIMLPath + '" ' +
			'group="' + getModuleGroupName(module) + '" />'
	};

Combine these functions together in order to transform our stream of modules into a stream of XMl elements. Log the individual module elements you are generating by applying ``console.log`` to each of the elements.

.. code-block:: javascript

	projectFileStream
		.sortBy(comparators.comparing('modulePath'))
		// additional work here
		.each(console.log);

Collection to Array
~~~~~~~~~~~~~~~~~~~

Streams have a function ``collect`` that will take all the elements of a stream and condense them into a stream consisting of a single element where that element is an array. This single element can then be passed on to later mappers, filters, and reducers in the stream.

* `highland.collect <http://highlandjs.org/#collect>`__

Checkpoint 2
~~~~~~~~~~~~

Assume that you have the following function that converts an array of XML elements into a single XML element.

.. code-block:: javascript

	function getModulesElement(moduleElements) {
		return '<modules>\n' + moduleElements.join('\n') + '\n</modules>';
	};

Use this function to convert our stream of single XML elements into a one-element stream containing a single XML element.

.. code-block:: xml

	<modules>
		<module
			fileurl="file://$PROJECT_DIR$/path/to/module.iml"
			filepath="$PROJECT_DIR$/path/to/module.iml"
			group="useful/group/name" />
		...
	</modules>

Checkpoint 3
~~~~~~~~~~~~

As noted at the beginning, the XML we generated is part of a component with the name ``ProjectModuleManager``.

.. code-block:: xml

	<component name="ProjectModuleManager">
		<modules>
			<module
				fileurl="file://$PROJECT_DIR$/path/to/module.iml"
				filepath="$PROJECT_DIR$/path/to/module.iml"
				group="useful/group/name" />
			...
		</modules>
	</component>

Create a new function ``getWorkspaceModulesXML`` which converts the content returned by ``getModulesElement`` into a JSON object where the ``fileName`` is ``.idea/modules.xml`` and the ``components`` is a single element array matching ``getModuleXML`` from ``lib/streams6.js``.

.. code-block:: javascript

	function getWorkspaceModulesXML(modulesElement) {
		// TODO: Convert the XML into a JSON object matching the return value of
		// the function streams6.getModuleXML
	};

Update our calls on ``projectFileStream`` to include the transformation provided by ``getWorkspaceModulesXML``. The console should log a JSON object.

Checkpoint 4
~~~~~~~~~~~~

Add the ``getIntellijXML`` transformation to our stream so far and replace ``console.log`` with ``saveContent`` and confirm that the created file is correct.

Adding Project Dependencies
---------------------------

We now have a set of modules and we have a workspace that knows that they should all be contained within our project. The next step is to actually update each module to recognize its project dependencies.

It turns out that project dependencies are fairly simple if you know the name of the module you depend on, because it is added as a child element of the ``NewModuleRootManager`` component we had declared when we were setting up our initial module settings.

.. code-block:: xml

	<orderEntry type="module" module-name="project-name" />

Checkpoint
~~~~~~~~~~

If we had a project dependency (one of the array elements contained in the ``projectDependency`` attribute), we could generate a single ``orderEntry`` element using the following function.

.. code-block:: javascript

	function getModuleOrderEntryElement(module, dependency) {
		var extraAttributes = '';

		if (isTestDependency(module, dependency)) {
			extraAttributes = 'scope="TEST" ';
		}
		else if (dependency.exported) {
			extraAttributes = 'exported="" ';
		}

		return '<orderEntry type="module" module-name="' + dependency.name + '" ' + extraAttributes + '/>';
	};

	function isTestDependency(module, dependency) {
		if (dependency.testScope) {
			return true;
		}

		if ((module.testSourceFolders) && (module.testSourceFolders.length > 0) && (module.modulePath.indexOf('modules/sdk/') == -1)) {
			return (module.sourceFolders.length == 0) || (dependency.name.indexOf('-test') != -1);
		}

		return false;
	};

Update the ``getNewModuleRootManagerXML`` function to add the appropriate XML elements by using the ``projectDependencies`` attribute of the provided ``module`` parameter.

You may use existing ``concat`` code as a template for what your solution should look like. If you want additional practice with ``reduce`` or ``forEach``, you are also encouraged to consider those as options, though they don't really simplify the code due to the fact that ``projectDependencies`` is an array rather than a stream (thus requiring currying or arying the function).

To confirm that your code is working, check ``portal-impl/portal-impl.iml`` and confirm that it contains the following:

.. code-block:: xml

	<?xml version="1.0" encoding="UTF-8"?>
	<module type="JAVA_MODULE" version="4">
		<component name="NewModuleRootManager">
			<content url="file://$MODULE_DIR$">
				<sourceFolder url="file://$MODULE_DIR$/src" isTestSource="false" />
				<sourceFolder url="file://$MODULE_DIR$/test/unit" isTestSource="true" />
				<sourceFolder url="file://$MODULE_DIR$/test/integration" isTestSource="true" />
				<excludeFolder url="file://$MODULE_DIR$/classes" />
				<excludeFolder url="file://$MODULE_DIR$/test-classes" />
			</content>
			<orderEntry type="inheritedJdk" />
			<orderEntry type="sourceFolder" forTests="false" />
			<orderEntry type="module" module-name="portal-kernel" />
			<orderEntry type="module" module-name="registry-api" />
			<orderEntry type="module" module-name="util-bridges" />
			<orderEntry type="module" module-name="util-java" />
			<orderEntry type="module" module-name="util-taglib" />
		</component>
	</module>

**Note**: the ``projectDependencies`` attribute is not always defined, because ``modules`` projects may have no dependencies, so you will have to wrap your code with the following.

.. code-block:: javascript

	if (module.projectDependencies) {
		// TODO: Perform work on module.projectDependencies here
	}

Summary
-------

We've worked with some very basic functions from the ``highland`` library in order to generate our project file and we've also updated our modules files with project dependencies.

Our last steps in the project will be to create library files and then incorporate them into our module files. And from there, we will have a valid IntelliJ project!
Javascript Streams 9: Project Wrap-Up
=====================================

.. contents:: :local:

Training Objective
------------------

Finalize our project by adding the missing libraries (``development``, ``global``, ``portal``) to our set of libraries. Also acquire the source code for dependencies through Maven so that it is easier for us to debug third party libraries outside of the ``lib`` folder.

Overview
--------

Before we can effectively use our project, we need to make sure that the portal modules (which do not follow the OSGi structure for dependencies) are able to properly resolve their library dependencies. In order to do that, we need to configure IntelliJ to recognize the ``development``, ``global``, and ``portal folders``.

Additionally, we would like to be able to take advantage of metadata associated with each dependency's ``pom.xml`` in order to also download the source code for the specific versions of libraries we are using. This will make it easier to debug third party code using the built-in tools provided by our IntelliJ IDE (rather than having to checkout Git or Subversion projects and finding the correct tags or branches).

Create Library Files
--------------------

Since the ``development``, ``global``, ``portal`` libraries are essentially still libraries, we are able to get IntelliJ to recognize them as long as we provide the XML file for them. The structure for these XML files is similar to all of our regular libraries, but they have an extra XML element for ``jarDirectory``. This is what an XML file looks like.

.. code-block:: xml

	<component name="libraryTable">
		<library name="LIBRARY_NAME">
			<CLASSES>
				<root url="file://$PROJECT_DIR$/lib/LIBRARY_NAME!/" />
			</CLASSES>
			<JAVADOC />
			<SOURCES />
			<jarDirectory url="file://$PROJECT_DIR$/lib/LIBRARY_NAME" recursive="false" />
		</library>
	</component>

Since this only requires a library name (and we already have the library name as part of the hard-coded values we created in ``lib/streams5.js``), we can generate the component content by providing a new function ``getJarLibraryTableXML`` which is essentially a variant of our existing function ``getLibraryTableXML``, but with explicit special handling for the different library types.

.. code-block:: javascript

	function getJarLibraryTableXML(library) {
		var libraryTableXML = [
			'<library name="' + library.name + '">',
			'<CLASSES>'
		];

		if (library.name == 'development') {
			var libraryPath = getFilePath('lib', 'development');
			var jarFiles = fs.readdirSync(libraryPath);

			Array.prototype.push.apply(
				libraryTableXML,
				jarFiles.filter(isDevelopmentLibrary)
					.map(highland.partial(getFilePath, libraryPath))
					.map(getLibraryRootElement));

			if (isFile('lib/portal/bnd.jar')) {
				libraryTableXML.push(getLibraryRootElement('lib/portal/bnd.jar'));
			}
		}
		else {
			libraryTableXML.push(
				'<root url="file://$PROJECT_DIR$/lib/' + library.name + '" />');
		}

		libraryTableXML.push(
			'</CLASSES>',
			'<JAVADOC />',
			'<SOURCES />');

		if (library.name == 'gradlew') {
			libraryTableXML.push('<jarDirectory url="file://$PROJECT_DIR$/.gradle/wrapper/dists" recursive="true" />');
		}
		else if (library.name != 'development') {
			libraryTableXML.push('<jarDirectory url="file://$PROJECT_DIR$/lib/' + library.name + '" recursive="false" />');
		}

		libraryTableXML.push('</library>');

		return libraryTableXML.join('\n');
	};

Checkpoint
~~~~~~~~~~

As noted in the previous section, finding out if a key is missing from an object is built in, because it's the same as finding a specific value (``undefined``), allowing us to use ``.where({'attributeName': undefined})`` in order to perform that filter.

* `highland.where <http://highlandjs.org/#where>`__

We then add a new function which uses ``getJarLibraryTableXML`` that mirrors ``getLibraryTableXML`` in order to generate the proper XML file content.

.. code-block:: javascript

	function getJarLibraryXML(library) {
		var fileName = library.name + '.xml';

		var libraryTableComponent = {
			name: 'libraryTable',
			content: getJarLibraryTableXML(library)
		};

		return {
			name: '.idea/libraries/' + fileName,
			content: getComponentXML(libraryTableComponent)
		};
	};

Use ``where`` in order to filter our ``coreLibraryFilesStream`` and identify the library files that are missing the ``group`` attribute. Use ``getJarLibraryXML`` in order to transform this filtered stream into ``development.xml``, ``global.xml``, and ``portal.xml`` files in our ``.idea/libraries`` folder.

Confirm you have completed the exercise by checking for the existence of these files.

Update Module Files
-------------------

We will also want to add the appropriate ``orderEntry`` elements to each module that uses these libraries. To do that, we can simply add new entries to the end of the existing module XML.

Unfortunately, we do not have anything similar to ``where`` when working with arrays, so we will need to instead figure out how to work with ``filter``. In this case, we will want to limit our creating of ``orderEntry`` elements to those libraries that do not have the ``group`` attribute. We already have ``keyExistsInObject``, so all we actually need to do is negate it.

Intuitively, we could simply create a new function that specifically negates the return value, but another way to achieve this is through function composition and reusing a function that already exists for performing the negation of a value.

* `highland.not <http://highlandjs.org/#not>`__

Checkpoint
~~~~~~~~~~

Update the ``getNewModuleRootManagerXML`` function to add additional ``orderEntry`` elements for libraries that do not have the ``group`` attribute. The functions you may need to use from ``lib/streams8.js`` include ``keyExistsInObject``, ``setLibraryName``, and ``getLibraryOrderEntryElement``, which have already been included as variables in ``lib/streams9.js``. Confirm that ``portal-impl.iml`` contains the following:

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
			<orderEntry type="library" name="development" level="project"/>
			<orderEntry type="library" name="global" level="project"/>
			<orderEntry type="library" name="portal" level="project"/>
		</component>
	</module>

Linking Portal Projects
-----------------------

While we created code in ``lib/streams4.js`` to recognize projects that included each other, one of the things Liferay did as part of its release is that we stopped using project includes between module folders (for example, between ``blogs``, ``document-library``, and ``wiki``).

This means that even though they correspond to Liferay projects, the IDE recognizes it as a library, meaning that when you control-click on a class, you are brought to read-only source code rather than the actual portal project.

However, what if we actually have a version compatible with what we've currently loaded in our IDE? Wouldn't it be better to link directly to the source code? To do that, we would need to identify anything that is currently declared as a library but is actually present as a Liferay project. Once we've found the matches, what we'll need to do is move the elements from one array and append them to another array. The removal is achieved using array splicing.

* `Array.prototype.splice <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice>`__

When you splice an array, you essentially take the array, split it into three pieces, splice the two outside end pieces together and then receive the middle piece as a return value. In many senses, this is equivalent to an in-place filter, where the function uses the indices parameters that we've been ignoring up until now.

First, we'll need to add functions which aggregate the current version of each Liferay module. These are provided as ``setCoreBundleVersions`` and ``setModuleBundleVersions``. Using these functions, we can then update our existing ``createProject`` function to accumulate the module versions.

.. code-block:: javascript

	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

Coincidentally, as we're fixing these problems, there is an IntelliJ bug (which will be fixed in a later release) related to resolving web facets where projects containing web sites can cause issues in JSP resolution when including dependencies. Therefore, we will want to make sure that project dependencies are converted into library dependencies whenever a tag library is involved. Both are provided via ``fixLibraryDependencies`` and ``fixProjectDependencies``. Both use array splicing in order to update the ``libraryDependencies`` and ``projectDependencies`` arrays and you are encouraged to review the code.

With these functions, we can switch library dependencies to project dependencies wherever applicable.

.. code-block:: javascript

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions));

Generate Maven Modules
----------------------

Every now and then, you need to debug a third party library's source code. The standard method for doing this is to go searching the internet for the source code for the specific version of the third party library we are using and then manually add it to our IDE as a new project.

It turns out that this is actually a common thing, and most dependency management frameworks provide you with the ability to automatically download the source code. For example, Gradle provides us with the ability to download source as part of the build process by setting a property during build:

* `IdeaModule.downloadSources <https://docs.gradle.org/current/dsl/org.gradle.plugins.ide.idea.model.IdeaModule.html#org.gradle.plugins.ide.idea.model.IdeaModule:downloadSources>`__

Sadly, this isn't a standard part of the Liferay build process, probably because it would make the Gradle cache grow even bigger and it's honestly big enough for something that we store in version control. Instead, what we can do is switch to using Maven for managing our dependencies for IDE instead of relying on files inside of our Gradle cache, which would place the files in our local ``.m2`` folder.

* `Maven Settings <https://maven.apache.org/settings.html>`__

In order to acquire our dependencies, we will generate a ``pom.xml`` that can be read by Maven so that we can use the ``dependency:sources`` goal to acquire them. We will do so for each module separately, because different modules depend on different libraries and you can't aggregate things into a single ``pom.xml``.

Even though we are generating many of them, the format for ``pom.xml`` files is actually pretty straightforward, in that they have the following format with all dependencies stored within the ``dependencies`` element, and the repositories hosting these dependencies are found in the ``repositories`` element.

.. code-block:: xml

	<project
		xmlns="http://maven.apache.org/POM/4.0.0"
		xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
		xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">

		<modelVersion>4.0.0</modelVersion>
		<groupId>com.liferay.dependencies</groupId>
		<artifactId>ARTIFACT_ID</artifactId>
		<version>1.0.0-SNAPSHOT</version>
		<packaging>pom</packaging>

		<dependencies>
			<dependency>
				<groupId>GROUP</groupId>
				<artifactId>NAME</artifactId>
				<version>VERSION</version>
			</dependency>
		</dependencies>

		<repositories>
			<repository>
				<id>default</id>
				<name>Apache</name>
				<url>http://repo.maven.apache.org/maven2</url>
				<layout>default</layout>
			</repository>
			<repository>
				<id>liferay</id>
				<name>Liferay</name>
				<url>http://repository.liferay.com/nexus/content/repositories/public</url>
				<layout>default</layout>
			</repository>
			<repository>
		</repositories>
	</project>

However, even though it's straightforward to generate, it's fairly unwieldy to build an XML file with this many extra elements with string concatenation alone as there is a high risk for typos. Instead, we'll introduce ``xmlbuilder``, a Javascript library allows you to generate the string content of an XML file using Javascript objects.

* `xmlbuilder <https://github.com/oozcitak/xmlbuilder-js>`__

Checkpoint 1
~~~~~~~~~~~~

We will now be calling the ``createProjectObjectModels`` function. Make sure to apply the same transformations on module details that we applied in ``createProject``.

.. code-block:: javascript

	var moduleVersions = moduleDetails.reduce(setModuleBundleVersions, {});
	moduleDetails = moduleDetails.map(highland.partial(updateProjectDependencies, moduleVersions));

For simplicity, we will start with the following function, which generates a ``pom.xml`` with no dependencies (you do not need to update the TODO just yet, as that will be a later exercise).

.. code-block:: javascript

	function getMavenProject(module) {
		var dependencyObjects = {};

		if ('libraryDependencies' in module) {
			// TODO: Specify the actual dependencies

			var libraryDependencies = [];

			if (libraryDependencies.length > 0) {
				dependencyObjects = {
					dependency: libraryDependencies
						.map(
							// TODO: Convert the dependencies into XML elements
						)
				};
			}

		}

		var project = {
			project: {
				'@xmlns': 'http://maven.apache.org/POM/4.0.0',
				'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
				'@xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
				modelVersion: '4.0.0',
				groupId: 'com.liferay.dependencies',
				artifactId: module.moduleName,
				version: '1.0.0-SNAPSHOT',
				packaging: 'pom',
				dependencies: dependencyObjects,
				repositories: {
					repository: [
						{
							id: 'default',
							name: 'Apache',
							url: 'http://repo.maven.apache.org/maven2',
							layout: 'default'
						},
						{
							id: 'liferay',
							name: 'Liferay',
							url: 'http://repository.liferay.com/nexus/content/repositories/public',
							layout: 'default'
						}
					]
				}
			}
		};

		return {
			name: getFilePath(module.modulePath, 'pom.xml'),
			content: xmlbuilder.create(project).end({pretty: true})
		};
	};

Perform operations on ``mavenProjectStream`` in the function ``createProjectObjectModels`` and generate the ``pom.xml`` files and use ``saveContent`` to persist these ``pom.xml`` files. Confirm that you've got the correct code by checking the ``pom.xml`` for the ``portal-impl`` module and confirm that it matches the following.

.. code-block:: xml

	<?xml version="1.0"?>
	<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
		<modelVersion>4.0.0</modelVersion>
		<groupId>com.liferay.dependencies</groupId>
		<artifactId>portal-impl</artifactId>
		<version>1.0.0-SNAPSHOT</version>
		<packaging>pom</packaging>
		<dependencies />
		<repositories>
			<repository>
				<id>default</id>
				<name>Apache</name>
				<url>http://repo.maven.apache.org/maven2</url>
				<layout>default</layout>
			</repository>
			<repository>
				<id>liferay</id>
				<name>Liferay</name>
				<url>http://repository.liferay.com/nexus/content/repositories/public</url>
				<layout>default</layout>
			</repository>
			<repository>
		</repositories>
	</project>

Test your changes by running ``bin/pom.js`` instead of ``bin/run.js``.

.. code-block:: bash

	bin/pom.js /path/to/portal/source

Checkpoint 2
~~~~~~~~~~~~

Update the ``getMavenProject`` function to filter ``module.libraryDependencies`` and execute the ``getMavenDependencyElement`` function in order to transform every element in the filtered list (if it's non-empty) into the XML elements we need.

Checkpoint 3
~~~~~~~~~~~~

Now that we have a proper ``pom.xml`` file for each module, choose any module that contains a non-empty ``dependencies`` element (for example, ``util/css-builder``) and run ``mvn dependency:sources``.

Confirm that the section reading "The following files have been resolved" is not immediately followed by ``none`` (in other words, Maven has found dependencies and has attempted to resolve them).

Generate Aggregator Module
--------------------------

We now have a problem that is very similar to the one that inspired this project to begin with. Even though we have something which generates individual ``pom.xml`` files that allows us to mass download source files for our dependencies, we have no way to download them all at once. Luckily, Maven provides the idea of an aggregator module which is a ``pom.xml`` with the following format.

.. code-block:: xml

	<?xml version="1.0"?>
	<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
		<modelVersion>4.0.0</modelVersion>
		<groupId>com.liferay.dependencies</groupId>
		<artifactId>portal-impl</artifactId>
		<version>1.0.0-SNAPSHOT</version>
		<packaging>pom</packaging>
		<modules>
			<module>path/to/module1</module>
			<module>path/to/module2</module>
		</modules>
	</project>

Checkpoint 1
~~~~~~~~~~~~

Use the streams functions you've learned so far in order to update ``createProjectObjectModels`` to take the following function and generate a ``pom.xml`` at the root of the portal project path containing an aggregation of all modules.

.. code-block:: javascript

	function getMavenAggregator(modulePaths) {
		var project = {
			project: {
				'@xmlns': 'http://maven.apache.org/POM/4.0.0',
				'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
				'@xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
				modelVersion: '4.0.0',
				groupId: 'com.liferay.dependencies',
				artifactId: module.moduleName,
				version: '1.0.0-SNAPSHOT',
				packaging: 'pom',
				modules: {
					module: modulePaths
				}
			}
		};

		return {
			name: 'pom.xml',
			content: xmlbuilder.create(project).end({pretty: true})
		};
	};

Keep in mind that you want to extract the ``modulePath`` attribute from each module in the stream, transform the stream of single elements to a stream consisting of a single array, generate the XML file, and then store the XML file to disk. Confirm that this works by opening the ``pom.xml`` generated at the end.

Checkpoint 2
~~~~~~~~~~~~

Use this ``pom.xml`` to download all the sources for all submodules by running ``mvn dependency:sources`` at the root of the portal source.

Summary
-------

We've now finished creating our tool! You can compare the code you've created in ``lib/streams9.js`` with the answer key ending point, though the answer key ending point actually adds a lot more capabilities that are unrelated to the tutorial material (so it's just Javascript code without relating to streams in any way).

A script which generates the ``pom.xml`` files, runs ``mvn dependency:sources``, deletes the extra ``pom.xml`` files and then runs something to create the IntelliJ module and library files would appear as follows:

.. code-block:: bash

	bin/pom.js /path/to/portal/source

	pushd /path/to/portal/source

	mvn dependency:sources
	grep '<module>.*</module>' pom.xml | awk -F'[<>]' '{ print $3 "/pom.xml" }' | xargs rm
	rm pom.xml

	popd

	bin/run.js /path/to/portal/source
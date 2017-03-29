Javascript Streams 2: Introducing Node.js
=========================================

.. contents:: :local:

Training Objective
------------------

After this training, you will understand the basic layout of a Node.js project and where you can find additional information about its package descriptor file, ``package.json``. You will also have created the initial module files for your Node.js project and learned the motivation behind separating the ``bin`` and ``lib`` folders in a Node.js project.

You will also have an understanding of how Node.js modules are organized on disk (such as where ``install`` stores modules) as well as the lookup strategy for its module inclusion function ``require``. Based on that, you will understand how functions provided in a Node.js module are made private and public to modules that require it.

From a familiarity perspective, you will have started using some of the built-in module ``assert`` and the built-in object ``process``. You will also have had some exposure to debugging Node.js projects with some of the debugging tools that are made available through the Node.js community.

Create a Project
----------------

First, let's create a folder called ``liferay-intellij`` and use that as the base folder for our project.

.. code-block:: bash

	mkdir liferay-intellij
	cd liferay-intellij

Project Descriptor
~~~~~~~~~~~~~~~~~~

Node.js projects are described via a ``package.json`` file.

* `package.json: An Interactive Guide <http://browsenpm.org/package.json>`__

The built-in ``npm`` utility has an ``init`` option that can be used to initialize a ``package.json`` file for the project. For now, let's use the defaults and then change the values once we start creating additional project files.

.. code-block:: bash

	npm init -y

Create a Module
---------------

Every source file in Node.js is equivalent to a module.

* `Module System <https://nodejs.org/docs/latest-v0.12.x/api/modules.html>`__

For many Node.js projects, modules that compose the system are stored inside of a subfolder of your project folder rather than as a root (similar to how we store code in a ``src`` folder rather than at the root). If we were to imitate Node GH, module code would be stored in ``lib`` folder.

.. code-block:: bash

	mkdir lib

Following UNIX-style conventions, a folder is a special type of file. If you attempt to use a folder as a module, it is essentially an alias for checking the corresponding ``package.json`` file for a ``main`` attribute describing the file. If that file is missing, the folder is an alias for ``index.js``.

* `Module System <https://nodejs.org/docs/latest-v0.12.x/api/modules.html#modules_folders_as_modules>`__

After creating our ``index.js``, we will want to update the ``main`` attribute in ``package.json`` for our root folder to point to the ``lib`` folder. Node.js will implicitly try to find a file named ``index.js`` or ``index.node`` in whatever folder we specify, though there is no harm in specifying it explicitly.

.. code-block:: javascript

	"main": "lib/index.js"

Require System
~~~~~~~~~~~~~~

All modules are loaded using ``module.require``, and the shorthand alias ``require`` is provided by default.

* `module.require <https://nodejs.org/docs/latest-v0.12.x/api/modules.html>`__

In Node.js, almost all variables and functions you declare are effectively private in scope, because everything is wrapped inside of a function closure.

* `How Require Actually Works <http://thenodeway.io/posts/how-require-actually-works/>`__

You can allow certain things to be available to the outside world by declaring a value for ``module.exports``, which defaults to an empty object. Whenever you use ``module.require``, Node.js essentially returns the corresponding ``module.exports`` object.

* `Interface Design Patterns for Node.js Modules <http://bites.goodeggs.com/posts/export-this/>`__

Since ``module.exports`` is an empty object, it is common to simply add attributes to it rather than redefining it entirely. This can also be done by updating the ``exports`` variable, which is initially declared as a reference to the empty ``module.exports`` object and thus updating it will also update the ``module.exports`` object.

For demonstration, we will define a ``createProject`` function which accepts a portal source folder and makes some calls to functions provided in the ``process`` object.

* `process <https://nodejs.org/docs/latest-v0.12.x/api/process.html>`__

The source code below captures the current working directory via ``process.cwd``, changes the current working directory to the provided folder using ``process.chdir``, logs the updated current working directory using ``console.log``, and then changes it back to the original working directory using ``process.chdir``.

.. code-block:: javascript

	function createProject(workspaceFolder) {
		var initialCWD = process.cwd();

		process.chdir(workspaceFolder);

		console.log(process.cwd());

		process.chdir(initialCWD);
	};

	exports.createProject = createProject;

Add this code to ``lib/index.js``.

Add Dependencies
----------------

Native support for checking the existence of a file or directory changes between Node.js releases (it switches from the ``fs`` module and the ``path`` module depending on which version of Node.js you are using). For stability, we'll use the ``shelljs`` module.

* `ShellJS <https://github.com/shelljs/shelljs>`__

In order to install the module, we use ``package.json`` as described in the Node.js documentation.

* `Install via NPM <https://docs.npmjs.com/cli/install>`__
* `Dependencies in Package.json <https://docs.npmjs.com/files/package.json#dependencies>`__

With that in mind, we update ``package.json`` to declare our dependency on ``shelljs`` in ``package.json``. For now, it should be safe to use 0.6.x (though if you plan to publish this module for public use, you may want to choose a specific version if you want to avoid weird regressions in behavior).

.. code-block:: javascript

	"dependencies": {
		"shelljs": "0.6.x"
	}

Then our dependency will automatically be loaded into the ``node_modules`` folder when we use the ``install`` argument to ``npm``.

.. code-block:: bash

	npm install

We are also going to use this opportunity add more dependencies that we will use throughout the rest of the first part of the training, namely ``highland`` (`reference <http://highlandjs.org/>`__).

.. code-block:: javascript

	"dependencies": {
		"highland": "2.7.x",
		"shelljs": "0.6.x"
	}

Then we update our dependencies.

.. code-block:: bash

	npm install

Dependency Layout
~~~~~~~~~~~~~~~~~

When you run ``install``, you might be curious how these modules are managed and maintained by Node.js.

* `Folder Structures <https://docs.npmjs.com/files/folders>`__

First, you'll notice that after running ``install``, your project folder now contains a ``node_modules`` folder. If you look inside of this folder, you'll see that it now contains both a ``highland`` folder and a ``shelljs`` folder, and both of these folders contain a ``package.json`` file.

Next, if you check your home folder, you'll find that there is a cache folder named ``.npm`` that is a cache of all Node.js modules that have ever been installed.

* `Packages Cache <https://docs.npmjs.com/cli/cache>`__

You'll see that this folder also contains a ``highland`` folder as well as a ``shelljs`` folder (and many other modules that come with Node.js). When you open these folders, you will find that there are version folders which contain ``package`` folders with ``package.tgz`` files. These are zipped archives of the Node.js module that are ultimately unzipped when you declare the module as a dependency.

Provide an Executable
---------------------

Node.js projects commonly have a ``bin`` folder that contain scripts that focus on parameter handling. This allows developers to separate modules that they wish to expose as public API (in our case, stored in the ``lib`` folder) and code that is strictly part of running the modules as command-line scripts.

.. code-block:: bash

	mkdir bin
	touch bin/run.js

From a parameters perspective, we will want to allow for the folder containing the portal source code as a parameter. Parameters are made available via the ``process`` object, which contains an ``argv`` attribute which we can use for extracting parameter information.

* `process.argv <https://nodejs.org/docs/latest-v0.12.x/api/process.html#process_process_argv>`__

As noted in the documentation, the real list of arguments starts at ``argv[2]``. Therefore, our script will simply use ``argv[2]`` as the portal source folder if arguments are provided. We will make use of the ``assert`` module in order to ensure that an argument is provided. Note that the ``module.exports`` for ``assert`` is a function with attributes that are also functions.

* `Assertion Testing <https://nodejs.org/docs/latest-v0.12.x/api/assert.html>`__

To get the exports provided by ``assert`` and ``shelljs``, we will require them by name. To get access to the exports we provided in ``lib/index.js``, we will update ``bin/run.js`` and simply have our script require the parent folder ``..``, which contains a ``package.json`` describing what Node.js should do next.

.. code-block:: javascript

	var assert = require('assert');
	var shelljs = require('shelljs');

	var liferay_intellij = require('..');

From here, we will want to assert that we have an argument.

.. code-block:: javascript

	assert(process.argv.length > 2, 'No portal source folder specified');

Next, we will want to confirm that the path exists and is a directory via ``shelljs.test('-d', folderName)``.

.. code-block:: javascript

	var workspaceFolder = process.argv[2];

	assert(shelljs.test('-d', workspaceFolder), workspaceFolder + ' is not a valid folder');

Now that all of our assertions have passed, we can create a project.

.. code-block:: javascript

	liferay_intellij.createProject(workspaceFolder);

We can now test our script, optionally setting parameters so we can see our ``createProject`` function getting executed.

.. code-block:: bash

	node bin/run.js

Optionally, we can make the script executable directly without having to specifically call ``node`` by using a hashbang directive to the top of the file so that the shell knows to implicitly to use the Node.js interpreter on the file.

.. code-block:: bash

	#!/usr/bin/env node

With that, we can run our script once the script has the executable flag.

.. code-block:: bash

	chmod u+x bin/run.js
	bin/run.js

Walking the File System
-----------------------

In order to do anything in our project, we first need a file list or a directory list. Various utilities built into Node.js, including functions exported by the ``fs`` module and the ``path`` module, will be especially useful.

* `fs <https://nodejs.org/docs/latest-v0.12.x/api/fs.html>`__
* `path <https://nodejs.org/docs/latest-v0.12.x/api/path.html>`__

Let's create a new module, ``lib/streams2.js`` and require it from ``lib/index.js``.

.. code-block:: javascript

	var streams2 = require('./streams2');

We'll include the ``fs``, ``path``, and ``shelljs`` modules in this module by adding the following lines to ``lib/streams2.js``.

.. code-block:: javascript

	var fs = require('fs');
	var path = require('path');
	var shelljs = require('shelljs');

Using the included ``shelljs`` module, we can add the following two functions using ``bind`` to make everything a bit more readable.

.. code-block:: javascript

	var isFile = shelljs.test.bind(shelljs, '-f');
	var isDirectory = shelljs.test.bind(shelljs, '-d');

The ability to list files is provided by the ``readdirSync`` ("read directory synchronously") function in the ``fs`` module which we mentioned earlier.

* `fs.readdirSync <https://nodejs.org/docs/latest-v0.12.x/api/fs.html#fs_fs_readdirsync_path>`__

Coincidentally, the ``path`` module provides a way of building out subfolder paths using the root folder path via its ``join`` function, but unfortunately it's OS-specific, and we actually want forward slashes all the time.

* `path.join <https://nodejs.org/docs/latest-v0.12.x/api/path.html#path_path_join_path1_path2>`__

Instead, we can introduce our own simple function which performs the concatenation.

.. code-block:: javascript

	function getFilePath(folderPath, fileName) {
		if (folderPath == '.') {
			return fileName;
		}
		else {
			return folderPath + '/' + fileName;
		}
	};

If we use these function in conjunction with the ``isDirectory`` we wrote earlier, we can write a function that walks a directory tree, returning all of the located folders up to a certain depth as follows.

.. code-block:: javascript

	function isHidden(fileName) {
		var pos = fileName.indexOf('/');
		var firstPathElement = fileName.substring(0, pos);

		return (firstPathElement.indexOf('.') == 0) &&
			(firstPathElement != '.') &&
			(firstPathElement != '..');
	};

	function getFolders(folderPath, maxDepth) {
		var folders = [];

		if (!isDirectory(folderPath)) {
			return folders;
		}

		var fileNames = fs.readdirSync(folderPath);

		for (var i = 0; i < fileNames.length; i++) {
			var fileName = fileNames[i];

			var filePath = getFilePath(folderPath, fileName);

			if (isDirectory(filePath) && !isHidden(filePath)) {
				folders.push(filePath);

				if (maxDepth > 0) {
					Array.prototype.push.apply(
						folders, getFolders(filePath, maxDepth - 1));
				}
			}
		}

		return folders;
	};

Currently in the Liferay code base, something that would qualify as an IntelliJ module is any folder that has both a ``bnd.bnd`` and a ``build.gradle``, and either a ``docroot`` subfolder or a ``src`` subfolder. With the repository split, we also have to consider whether this is a sub repository and whether we should allow it to be included, which we can confirm with the presence of the ``.gitrepo`` file that contains ``mode = pull``.

We can then create a function that detects whether we have a module folder by actually using these checks.

.. code-block:: javascript

	function isModuleFolder(includeSubRepos, folder) {
		if ((folder.indexOf('/sdk/') != -1) && (folder.indexOf('-templates') != -1)) {
			return false;
		}

		if (!isFile(getFilePath(folder, 'build.gradle'))) {
			return false;
		}

		if (!isFile(getFilePath(folder, 'bnd.bnd')) && !isFile(getFilePath(folder, 'liferay-theme.json'))) {
			return false;
		}

		if (!isDirectory(getFilePath(folder, 'docroot')) && !isDirectory(getFilePath(folder, 'src'))) {
			return false;
		}

		if (!includeSubRepos && isSubRepo(folder)) {
			return false;
		}

		return true;
	};

	function isRepoModePull(gitRepoFileContents) {
		return gitRepoFileContents.indexOf('mode = pull') != -1;
	};

	function isSubRepo(folder) {
		var possibleGitRepoFileLocations = ['.gitrepo', '../.gitrepo', '../../.gitrepo'];

		for (var i = 0; i < possibleGitRepoFileLocations; i++) {
			var possibleGitRepoFileLocation = possibleGitRepoFileLocations[i];
			var gitRepoFilePath = getFilePath(folder, possibleGitRepoFileLocation);
			var gitRepoFileExists = isFile(gitRepoFilePath);

			if (!gitRepoFileExists) {
				continue;
			}

			var gitRepoFileContents = fs.readFileSync(gitRepoFilePath);

			if (isRepoModePull(gitRepoFileContents)) {
				return true;
			}
		}

		return false;
	};

From here, we will be able to get all of our module folders as follows.

.. code-block:: javascript

	function getModuleFolders(portalSourceFolder, moduleSourceFolder, includeSubRepos) {
		var moduleRootPath = path.relative(portalSourceFolder, moduleSourceFolder);
		var findResultFolders = getFolders(moduleRootPath, 5);

		var moduleFolders = [];

		for (var i = 0; i < findResultFolders.length; i++) {
			if (isModuleFolder(includeSubRepos, findResultFolders[i])) {
				moduleFolders.push(findResultFolders[i]);
			}
		}

		return moduleFolders;
	};

We can export the ``getModuleFolders`` function we've created as public API.

.. code-block:: javascript

	exports.getModuleFolders = getModuleFolders;

Then in order to actually get the function to be invoked when we call ``bin/run.js``, we will also want to call it from our ``createProject`` function defined in ``lib/index.js``. For now, we will log the return value.

.. code-block:: javascript

	function createProject(portalSourceFolder, otherSourceFolders) {
		var initialCWD = process.cwd();

		process.chdir(portalSourceFolder);

		var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');

		var moduleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath, true);

		console.dir(moduleFolders, {depth: null});

		process.chdir(initialCWD);
	};

Checkpoint
~~~~~~~~~~

If we now invoke the script.

.. code-block:: bash

	bin/run.js /path/to/portal/source

We will get a list of all the ``build.xml`` files located in the ``modules`` folder of the portal source code, as long as they occur no deeper than 5 additional levels deep.

Debugging Node.js
-----------------

With a Debugger
~~~~~~~~~~~~~~~

Since our code will be in Node.js, it's useful to know of the tooling that surrounds Node.js. In particular, if you are comforted by having a debugger rather than relying strictly on the ``console`` object, there are a few options.

One of the community members for the Atom text editor has created the package ``node-debugger`` which provides a GUI interface to the Node.js console step debugger. The package provides rudimentary support for breakpoints, but there's no way to specify arguments. If you plan to use it, you'll need to hard-code the values for arguments that you would have passed to the script on the command line.

* `Atom <https://atom.io/>`__

The community of Node.js developers have created the plugins ``iron-node`` or ``node-inspector`` that interface with the standard web developer tools available in Chromium-based browsers. This provides a fairly rich experience in debugging your application.

* `Iron Node <http://s-a.github.io/iron-node/>`__
* `Node Inspector <https://github.com/node-inspector/node-inspector>`__

In the proprietary and non-free space, it can be beneficial to purchase a product from our favorite IDE vendor that provides debugging support for Node.js projects.

* `Webstorm <https://www.jetbrains.com/webstorm/>`__

Without a Debugger
~~~~~~~~~~~~~~~~~~

Sometimes, we will want to debug the result of a single function call (such as ``createProject``) with specific return values and specific parameter values. If our function is public (it's an attribute of ``module.exports``), this can be done by entering the Node.js REPL and requiring the module and simply calling the function.

.. code-block:: javascript

	var intellij = require('./');
	intellij.createProject('/path/to/portal/source');

Private functions are a bit trickier since you will need to either temporarily make it a public function in order to debug it, or you will need to add code to the top level which will be executed when the module is reloaded.

For both public and private functions, to get your debug tests to re-run after changes, you must invalidate the require cache in Node.js.

Based on testing, most simple libraries don't actually work unless you call ``require`` with the exact file location, and the only library which does work requires that you start Node.js using a special script that starts a new ``repl`` with a ``require.reload`` function attached to the REPL context.

* `Require Reload <https://gist.github.com/gleitz/6896099>`__

Additional functions (such as an alias for ``process.exit``) can also be attached if you choose to continue running Node.js REPL using this script on a regular basis.

Checkpoint
~~~~~~~~~~

First, let's learn how to use Require Reload in order to debug Javascript. Then, let's choose a regular free Node.js debugger (Atom, Iron Node, Node Inspector) and get introduced on how to use it with the ``debugger`` statement!
IntelliJ Modules Setup Script
=============================

.. contents:: :local:

This script generates all the IML files, library descriptors, and the modules.xml file needed to have a complete Liferay project that successfully resolves imports in JSPs and Java files across the 900+ modules in Liferay.

If you're more of a visual person and would like screenshots to better understand what that actually means, check the `ABOUT <ABOUT.rst>`__ file.

Setup Instructions
------------------

To setup the script, please use the following steps.

1. Install `NodeJS <https://nodejs.org/en/download/releases/>`__ (tested with NodeJS 0.12.x, 4.x, 6.x, and 8.x)

2. Backup the ``.idea`` folder in your portal source in case you dislike the result (other than the ``.iml`` files it creates, the script writes its files here)

3. Clone this repository.

.. code-block:: bash

	git clone git@github.com:holatuwol/liferay-intellij.git

4. Add a Bash function that makes it easy for you to call it and do any other setup. Replace ``/path/to/clone/location`` with the path to the ``liferay-intellij`` folder that you created by cloning the repository in step 3.

.. code-block:: bash

	IJ_CLONE_PATH=/path/to/clone/location

	ij() {
		${IJ_CLONE_PATH}/intellij "$@"
	}

Usage Instructions
------------------

There are a few different ways to use this script, which are documented below. Once you've followed the instructions, have IntelliJ open the project rooted in the folder where you ran the ``ij`` function, and it will load your populated project!

Public Source
~~~~~~~~~~~~~

To load a project containing only the portal source for a public repository, follow these instructions.

1. Navigate to where you've cloned the `liferay-portal <https://github.com/liferay/liferay-portal>`__ repository
2. Run the ``ij`` command (no parameters) to generate the IntelliJ project

.. code-block:: bash

	cd /path/to/portal/public/source
	ij

Private Source With Public History
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you'd like to work with ``master-private`` or ``7.0.x-private`` and you need the history on the ``master`` and ``7.0.x`` branches, follow these instructions.

1. Navigate to where you've cloned the `liferay-portal <https://github.com/liferay/liferay-portal>`__ repository
2. Run the ``ij`` command, and specify the path to where you cloned the `liferay-portal-ee <https://github.com/liferay/liferay-portal-ee>`__ repository and checked out the corresponding private branch

.. code-block:: bash

	cd /path/to/portal/public/source
	ij /path/to/portal/private/source

Private Source Without Public History
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you'd like to work with ``master-private`` or ``7.0.x-private`` and you don't need the history on the ``master`` and ``7.0.x`` branches, follow these instructions.

1. Navigate to where you've cloned the `liferay-portal-ee <https://github.com/liferay/liferay-portal-ee>`__ repository
2. Run the ``ij`` command (no parameters) to generate the IntelliJ project

.. code-block:: bash

	cd /path/to/portal/private/source
	ij

Public Source With Subrepositories
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To load a project containing only the portal source for a public repository and the code for all public/private subrepositories that you've checked out, follow these instructions.

1. Navigate to where you've cloned the `liferay-portal <https://github.com/liferay/liferay-portal>`__ repository
2. Run the ``ij`` command, and specify as an argument the path to where you cloned the various subrepositories. If you have them all cloned inside of one parent folder, just specify the one parent folder and it will locate them all!

.. code-block:: bash

	cd /path/to/portal/public/source
	ij /path/to/subrepo1 /path/to/subrepo2 /path/to/subrepo3

.. code-block:: bash

	cd /path/to/portal/public/source
	ij /path/to/subrepos

Private Source With Public History and Subrepositories
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To load a project containing only the portal source for a public repository and the code for all public/private subrepositories that you've checked out, follow these instructions.

1. Navigate to where you've cloned the `liferay-portal <https://github.com/liferay/liferay-portal>`__ repository
2. Run the ``ij`` command, and specify as an argument the path to where you cloned the `liferay-portal-ee <https://github.com/liferay/liferay-portal-ee>`__ repository and checked out the corresponding private branch, and specify the various subrepositories. If you have them all cloned inside of one parent folder, just specify the one parent folder and it will locate them all!

.. code-block:: bash

	cd /path/to/portal/public/source
	ij /path/to/portal/private/source /path/to/subrepo1 /path/to/subrepo2 /path/to/subrepo3

.. code-block:: bash

	cd /path/to/portal/public/source
	ij /path/to/portal/private/source /path/to/subrepos/parent

More Complex Usage
~~~~~~~~~~~~~~~~~~

All folders that you specify as arguments will be assumed either to be an Ant-based Plugins SDK root (designated by the presence of ``build-common-plugins.xml``), a Blade workspace (designated by the presence of a ``gradle.properties``), or a folder used to store subrepositories (such as those generated by forking subrepositories OR the ``modules`` folder of the ``master-private`` and ``7.0.x-private`` branch).

.. code-block:: bash

	ij /path/to/folder1 /path/to/folder2 /path/to/folder3

Other Caveats
-------------

The script generates ``.iml`` files that are slightly different from the ones that have been committed to Liferay's version control, so the alias adds all ``.iml`` files to an ignore list. You can clear your ignore list with the following.

.. code-block:: bash

	git ls-files -v | grep '^h ' | cut -d' ' -f 2 | xargs git update-index --no-assume-unchanged

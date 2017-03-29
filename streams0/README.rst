Javascript Streams 0: Training Overview
=======================================

.. contents:: :local:

Problem Statement
-----------------

Background
~~~~~~~~~~

Throughout industry, ease of finding things in the source code is extremely important to developer productivity.

* `Indexing Google Source Code <http://piaw.blogspot.com/2015/09/indexing-googles-source-code.html>`__

As Liferay embraces modularity, the number of modules in the Liferay core source code grows every day. In technical support, we frequently encounter situations where source files we need are moved to a module and as a result not treated as "source".

As a workaround, developers have added the entire portal folder as a module and manually add source folders on an as-needed basis. This concept has been further extended with shell scripts that automatically add new source folders.

While this approach works for Java files, JSP files remain cumbersome to interact with because IntelliJ does not effectively manage multiple Web facets under a single module. This means that using Ctrl+Click in order to navigate in a JSP file often does not work.

Therefore, as a team, technical support has a desire to move to a multiple module project layout to allow for Web facets to work correctly. However, we would still like to have scripts that automatically discover new modules so that source files can always be found.

Existing Solution
~~~~~~~~~~~~~~~~~

Gradle provides a plugin which generates a single IntelliJ module file for a single Gradle project.

* `Gradle IDEA Plugin <https://docs.gradle.org/current/userguide/idea_plugin.html>`__

Liferay has included this plugin in the modules build scripts (see ``build-module.gradle``), and we have configured this plugin so that when the module ``.iml`` file is created, it will add the ``src/main/resources/META-INF/resources`` folder as a root folder for a Web facet.

The task ``ideaModule`` takes 20-30 seconds per module, and you manually import the modules to your IntelliJ project after the task completes.

Solution Gaps
~~~~~~~~~~~~~

The 20-30 seconds per module time cost is acceptable to engineering and product management because any component team only ever needs to work with the handful of modules relating to that component.

However, since there are almost 540 modules in total, this cost is less palatable for technical support where you never really know which modules you must interact with at any given time (or their module dependencies).

Training Goals
--------------

An acceptable solution begins at the starting point and reaches the ending point with no additional manual steps.

* Our starting point is a string representing where to find the portal source.
* Our ending point is a collection of ``.iml`` files (one for each module) and an IntelliJ project descriptor that includes all of these  ``.iml`` files.

The concept behind the tool is simple enough that you could build it using just about any programming language you wanted. However, we will use this opportunity and implement our solution in Node.js, a Javascript runtime used by Node GH and various other tools created and maintained by Liferay's UI team.

* `Node.js Downloads <https://nodejs.org/en/download/releases/>`__

We will also take this opportunity to better understand streams-style programming, since we're embracing streams in one of the projects we're promoting at Liferay Symposiums and other public events.

* `Launchpad <http://liferay.io/docs/java/understanding-data.html>`__


Training Itinerary
------------------

Foundations
~~~~~~~~~~~

We will begin by reviewing some Javascript fundamentals that allow us to understand and leverage functions as first-class citizens of the programming language.

From there, we will begin layout out the structure of our Node.js project to address our problem description.

* `Understanding the Node.js Event Loop <https://nodesource.com/blog/understanding-the-nodejs-event-loop/>`__

Technically, Node.js is an event-based wrapper on top of a prototype language, and normally we would want to cover event-based styles of programming. However, we will skip over this, because as we speak, Javascript programmers are writing abstractions libraries in order to avoid having to think about the code complexity introduced by coding for the event loop.

* `Async <https://github.com/caolan/async>`__
* `Promises <http://github.com/promises-aplus/promises-spec/>`__

Functional Programming
~~~~~~~~~~~~~~~~~~~~~~

From there, our focus will be on understanding the programming style that works with streams. This requires thinking of work in terms of higher order functions, which is known in general as functional programming.

We will start by working with arrays and understanding how arrays leverage higher order functions in order to perform work, which is slightly different from (but importantly different from) unraveling the arrays ourselves in order to perform the work via iterators. We will then end up with an array of module details.

Applications
~~~~~~~~~~~~

We will then leverage this knowledge in order to analyze the remainder of our project and categorize our desired end product into items that are embarassingly parallel and items that must actually wait for all computations to complete.

* `Embarassingly parallel <https://en.wikipedia.org/wiki/Embarrassingly_parallel>`__

From there, we will then complete the remainder of our project using a stream created from our array of module details. The programming paradigm that surrounds working with streams is often referred to in the literature as "reactive programming".

* `Reactive programming <https://gist.github.com/staltz/868e7e9bc2a7b8c1f754>`__

While we won't take full advantage of the features that streams offers due to the limited scope of our project, by the end of the training sequence, you should also have a basic understanding of reactive programming and how it relates to the traditionally event-driven world of Javascript.
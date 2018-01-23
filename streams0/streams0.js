var cheerio = require('cheerio');
var child_process = require('child_process');
var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var path = require('path');
var shelljs = require('shelljs');
var streams2 = require('../streams2/streams2');
var streams5 = require('../streams6/streams5');
var streams6 = require('../streams7/streams6');
var streams7 = require('../streams8/streams7');
var streams8 = require('../streams9/streams8');
var streams9 = require('./streams9');

var checkExportDependencies = streams9.checkExportDependencies;
var checkForGradleCache = streams8.checkForGradleCache;
var checkForMavenCache = streams8.checkForMavenCache;
var execFileSync = child_process.execFileSync;
var fixLibraryDependencies = streams9.fixLibraryDependencies;
var getAncestorFiles = streams7.getAncestorFiles;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getJarLibraryXML = streams9.getJarLibraryXML;
var getLibraryJarPaths = streams8.getLibraryJarPaths;
var getLibraryXML = streams9.getLibraryXML;
var getMavenAggregator = streams9.getMavenAggregator;
var getMavenProject = streams9.getMavenProject;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleXML = streams9.getModuleXML;
var getProjectRepositories = streams9.getProjectRepositories;
var getUserHome = streams8.getUserHome;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isFile = streams2.isFile;
var isDirectory = streams2.isDirectory;
var isSameLibraryDependency = streams8.isSameLibraryDependency;
var keyExistsInObject = highland.ncurry(2, streams8.keyExistsInObject);
var libraryCache = streams8.libraryCache;
var setCoreBundleVersions = streams9.setCoreBundleVersions;
var setModuleBundleVersions = streams9.setModuleBundleVersions;
var saveContent = streams6.saveContent;
var setLibraryName = streams8.setLibraryName;
var sortModuleAttributes = streams9.sortModuleAttributes;

var gitRoots = new Set();

var gradleCaches = streams9.gradleCaches;
var mavenCaches = streams9.mavenCaches;

function createProjectObjectModels(coreDetails, moduleDetails) {
	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, false));

	var moduleStream = highland(moduleDetails.concat(getLibraryModules()));

	var mavenProjectStream = moduleStream.observe();
	var mavenAggregatorStream = moduleStream.observe();

	mavenProjectStream
		.map(getMavenProject)
		.each(saveContent);

	mavenAggregatorStream
		.pluck('modulePath')
		.collect()
		.map(getMavenAggregator)
		.each(saveContent);

	moduleStream.done(function() {});
};

function createProjectWorkspace(coreDetails, moduleDetails, pluginDetails) {
	checkBreakpoints(moduleDetails);

	if (pluginDetails) {
		pluginDetails.forEach(sortModuleAttributes);
	}

	console.log('Processing dependency versions');

	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, true));

	moduleDetails.forEach(checkExportDependencies);

	coreDetails.forEach(sortModuleAttributes);
	moduleDetails.forEach(sortModuleAttributes);

	coreDetails.forEach(checkForGitRoot);
	moduleDetails.forEach(checkForGitRoot);

	moduleDetails.forEach(checkForGradleCache);
	checkForGradleCache(getUserHome());
	checkForGradleCache('../liferay-binaries-cache-2017');

	moduleDetails.forEach(checkForMavenCache);
	checkForMavenCache(getUserHome());

	console.log('Processing BOM dependencies');

	completeBomCache(moduleDetails);
	moduleDetails.forEach(fixMavenBomDependencies);

	console.log('Processing missing dependencies');

	completeGradleCache(coreDetails, moduleDetails, pluginDetails);

	console.log('Generating IntelliJ workspace');

	moduleDetails.forEach(getFileTreeDependencies);

	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);
	var pluginStream = highland(pluginDetails);

	var detailsStream = highland.merge([moduleStream, coreStream, pluginStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();
	var tagLibrariesStream = detailsStream.observe();

	moduleFilesStream
		.map(getModuleXML)
		.map(getIntellijXML)
		.each(saveContent);

	projectFileStream
		.sortBy(comparators.comparing('breakpointSort').thenComparing('moduleName'))
		.map(getModuleElement)
		.collect()
		.map(getModulesElement)
		.map(getWorkspaceModulesXML)
		.map(getIntellijXML)
		.each(saveContent);

	libraryFilesStream = libraryFilesStream
		.pluck('libraryDependencies')
		.compact()
		.flatten()
		.uniqBy(isSameLibraryDependency);

	var coreLibraryFilesStream = libraryFilesStream.observe();

	coreLibraryFilesStream
		.where({'group': undefined})
		.map(getJarLibraryXML)
		.each(saveContent);

	libraryFilesStream
		.filter(keyExistsInObject('group'))
		.doto(setLibraryName)
		.map(getLibraryXML)
		.each(saveContent);

	tagLibrariesStream
		.flatMap(getTagLibraryPaths)
		.reduce({}, getTagLibraryURIs)
		.flatMap(highland.pairs)
		.sort()
		.map(getTagLibraryResourceElement)
		.collect()
		.map(getMiscXML)
		.each(saveContent);

	detailsStream.done(function() {});

	addGitVersionControlSystem();
};

function addGitVersionControlSystem() {
	var vcsXML = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<project version="4">',
		'<component name="VcsDirectoryMappings">'
	];

	for (gitRoot of gitRoots) {
		var vcsRootPath = path.dirname(gitRoot);

		vcsRootPath = (vcsRootPath == '.') ? '$PROJECT_DIR$' : '$PROJECT_DIR$/' + vcsRootPath;

		var vcsXMLElement = '<mapping directory="' + vcsRootPath + '" vcs="Git" />';

		vcsXML.push(vcsXMLElement);
	}

	vcsXML.push('</component>');
	vcsXML.push('</project>');

	saveContent({
		name: '.idea/vcs.xml',
		content: vcsXML.join('\n')
	});
};

function checkBreakpoints(moduleDetails) {
	for (var j = 0; j < moduleDetails.length; j++) {
		moduleDetails[j].breakpointSort = 2;
	}

	if (!isFile('.idea/workspace.xml')) {
		return;
	}

	var workspaceXML = fs.readFileSync('.idea/workspace.xml');

	var workspace = cheerio.load(workspaceXML);
	var breakpoints = workspace('breakpoint-manager breakpoints url');

	for (var i = 0; i < breakpoints.length; i++) {
		var breakpointURL = workspace(breakpoints[i]).text().trim().substring('file://$PROJECT_DIR$/'.length);

		for (var j = 0; j < moduleDetails.length; j++) {
			if (breakpointURL.indexOf(moduleDetails[j].modulePath) == 0) {
				moduleDetails[j].breakpointSort = 1;
			}
		}
	}
};

function checkForGitRoot(module) {
	if (!module.modulePath) {
		return;
	}

	var candidates = getAncestorFiles(module.modulePath, '.git');

	candidates.forEach(Set.prototype.add.bind(gitRoots));
};

function completeBomCache(moduleDetails) {
	var moduleStream = highland(moduleDetails);

	moduleStream
		.tap(gatherMavenBomDependencies)
		.filter(keyExistsInObject('bomDependencies'))
		.pluck('bomDependencies')
		.compact()
		.flatten()
		.uniqBy(isSameLibraryDependency)
		.filter(keyExistsInObject('group'))
		.doto(setLibraryName)
		.filter(highland.compose(highland.not, hasLibraryPath))
		.map(getGradleEntry)
		.collect()
		.each(highland.partial(executeGradleFile, 'BOM dependencies have been downloaded'));
};

function completeGradleCache(coreDetails, moduleDetails, pluginDetails) {
	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);
	var pluginStream = highland(pluginDetails);

	var detailsStream = highland.merge([moduleStream, coreStream, pluginStream]);

	detailsStream
		.pluck('libraryDependencies')
		.compact()
		.flatten()
		.uniqBy(isSameLibraryDependency)
		.filter(keyExistsInObject('group'))
		.doto(setLibraryName)
		.filter(highland.compose(highland.not, hasLibraryPath))
		.filter(highland.compose(highland.not, isLiferayModule))
		.map(getGradleEntry)
		.collect()
		.each(highland.partial(executeGradleFile, 'Missing dependencies have been downloaded'));
};

function executeGradleFile(completionMessage, entries) {
	if (entries.length == 0) {
		return;
	}

	var gradleRepositoriesBlock = getProjectRepositories().reduce(getGradleRepositoriesBlock, []);

	var buildGradleContent = [
		'apply plugin: "java"'
	];

	buildGradleContent.push('buildscript {');
	buildGradleContent = buildGradleContent.concat(gradleRepositoriesBlock);
	buildGradleContent.push('}');

	buildGradleContent.push('dependencies {');
	buildGradleContent = buildGradleContent.concat(entries);
	buildGradleContent.push('}');

	buildGradleContent = buildGradleContent.concat(gradleRepositoriesBlock);

	buildGradleContent = buildGradleContent.concat([
		'task completeGradleCache(type: Exec) {',
		'\tconfigurations.compile.files',
		'\tcommandLine "echo", "' + completionMessage + '"',
		'}'
	]);

	var buildGradleFolder = path.join(process.cwd(), 'tmp/ijbuild');

	shelljs.mkdir('-p', buildGradleFolder);

	fs.writeFileSync(path.join(buildGradleFolder, 'build.gradle'), buildGradleContent.join('\n'));

	var executable = path.join(process.cwd(), 'gradlew');

	var args = ['completeGradleCache'];

	var options = {
		'cwd': buildGradleFolder,
		'stdio': [0,1,2]
	};

	try {
		execFileSync(executable, args, options);
	}
	catch (e) {
	}
};

function fixMavenBomDependencies(module) {
	if (!module.bomDependencies) {
		return;
	}

	for (var i = 0; i < module.bomDependencies.length; i++) {
		var dependency = module.bomDependencies[i];

		var groupId = dependency.group;
		var artifactId = dependency.name;
		var version = dependency.version;

		module.libraryDependencies.splice(0, 0, dependency);

		if (dependency.overriddenByDependencies) {
			continue;
		}

		var cacheKey = [groupId, artifactId, version].join(':');
		var library = libraryCache[cacheKey];

		if (!library) {
			console.log('Failed to resolve bom for ' + cacheKey);
			continue;
		}

		for (key in library.variables) {
			var colonIndex = key.indexOf(':');

			if (colonIndex == -1) {
				continue;
			}

			var replacementDependency = {
				type: 'library',
				group: key.substring(0, colonIndex),
				name: key.substring(colonIndex + 1),
				version: library.variables[key],
				testScope: false
			};

			for (var j = 0; j < module.libraryDependencies.length; j++) {
				var libraryDependency = module.libraryDependencies[j];

				if ((libraryDependency.group == replacementDependency.group) && (libraryDependency.name == replacementDependency.name)) {
					module.libraryDependencies[j] = replacementDependency;
					break;
				}
			}
		}
	}
};

function fixProjectDependencies(moduleVersions, addAsLibrary, module) {
	var module = streams9.fixProjectDependencies(moduleVersions, addAsLibrary, module);

	var bndPath = getFilePath(module.modulePath, 'bnd.bnd');

	if (!isFile(bndPath)) {
		return module;
	}

	module.bndContent = fs.readFileSync(bndPath).toString();

	var fragmentHostRegex = /Fragment-Host: ([^\r\n;]+)/g;
	matchResult = fragmentHostRegex.exec(module.bndContent);

	if (!matchResult) {
		return module;
	}

	var dependencyName = matchResult[1];
	var moduleVersion = moduleVersions[dependencyName];

	if (!moduleVersion) {
		return module;
	}

	var projectDependency = {
		type: 'project',
		name: moduleVersion.projectName,
		testScope: false
	};

	module.projectDependencies.push(projectDependency);

	return module;
};

function flatten(accumulator, next) {
	if (!accumulator) {
		return next;
	}

	if (!next) {
		return accumulator;
	}

	return accumulator.concat(next);
};

function gatherMavenBomDependencies(module) {
	var buildGradleContents = module.buildGradleContents;

	if (!buildGradleContents) {
		return;
	}

	var dependencyTextRegex = /dependencyManagement \{([\s\S]*?)\n\}/g;
	var mavenBomRegex = /mavenBom\s*['"]([^:]*):([^:]*):([^'"]*)['"]/g;

	while ((dependencyTextResult = dependencyTextRegex.exec(buildGradleContents)) !== null) {
		if (!module.bomDependencies) {
			module.bomDependencies = [];
		}

		var dependencyText = dependencyTextResult[1];

		while (mavenBomResult = mavenBomRegex.exec(dependencyText)) {
			var dependency = {
				type: 'library',
				group: mavenBomResult[1],
				name: mavenBomResult[2],
				version: mavenBomResult[3],
				testScope: false,
				overriddenByDependencies: dependencyText.indexOf('overriddenByDependencies = false') == -1
			};

			module.bomDependencies.push(dependency);
		}
	}
};

function getFilePaths(folder) {
	return fs.readdirSync(folder).map(getFilePath(folder));
};

function getFileTreeDependencies(module) {
	var buildGradleContents = module.buildGradleContents;

	if (!buildGradleContents) {
		return;
	}

	var dependencyTextRegex = /dependencies \{([\s\S]*?)\n\s*\}/g;
	var dependencyTextResult = null;

	while ((dependencyTextResult = dependencyTextRegex.exec(buildGradleContents)) !== null) {
		var dependencyText = dependencyTextResult[1];

		var y = 0;

		for (var x = 0; x < dependencyText.length; x += 8) {
			x = dependencyText.indexOf('fileTree(dir: "', x) + 15;

			if (x < 15) {
				break;
			}

			y = dependencyText.indexOf('"', x);

			var moduleLibFolder = dependencyText.substring(x, y);

			if (moduleLibFolder.indexOf('..') != -1) {
				continue;
			}

			var moduleLibPath = getFilePath(module.modulePath, moduleLibFolder);

			if (!isDirectory(moduleLibPath)) {
				continue;
			}

			var jarPaths = fs.readdirSync(moduleLibPath)
				.filter(function(x) { return x.endsWith('.jar') && !x.endsWith('-sources.jar') })
				.map(getFilePath(moduleLibPath));

			var dependency = {
				group: 'com.liferay',
				name: module.moduleName,
				version: moduleLibFolder,
				testScope: false,
				jarPaths: jarPaths
			};

			module.libraryDependencies.push(dependency);
		}
	}
};

function getGradleEntry(library) {
	return '\tcompile group: "' + library['group'] + '", name: "' + library['name'] + '", version: "' + library['version'] + '"';
};

function getGradleFile(entries) {
	return {
		name: path.join(process.cwd(), 'tmp/ijbuild/build.gradle'),
		content: buildGradleContent.join('\n')
	};
};

function getGradleRepositoriesBlock(currentValue, repository) {
	if (currentValue.length == 0) {
		currentValue = [
			'repositories {',
			'\tmavenLocal()',
			'}'
		];
	}

	var newGradleContent = [
		'\tmaven {',
		'\t\turl "' + repository.scheme + '://' + repository.path + '"'
	];

	if (repository.username) {
		newGradleContent.push('\t\tcredentials {');
		newGradleContent.push('\t\t\tusername ' + JSON.stringify(repository.username));
		newGradleContent.push('\t\t\tpassword ' + JSON.stringify(repository.password));
		newGradleContent.push('\t\t}');
	}

	newGradleContent.push('\t}');

	currentValue.splice(currentValue.length - 1, 1);
	currentValue = currentValue.concat(newGradleContent);
	currentValue.push('}');

	return currentValue;
};

function getLibraryModule(libraryName) {
	var libraryModule = {
		moduleName: libraryName,
		modulePath: getFilePath('lib', libraryName),
		bundleSymbolicName: libraryName,
		bundleVersion: '0.1-SNAPSHOT'
	};

	var libraryMetadataPath = getFilePath(libraryModule.modulePath, 'dependencies.properties');

	if (!isFile(libraryMetadataPath)) {
		return libraryModule;
	}

	var dependencyPropertiesContent = fs.readFileSync(libraryMetadataPath, { encoding: 'UTF-8' });

	libraryModule['libraryDependencies'] = dependencyPropertiesContent.toString()
		.split('\n')
		.map(function(x) {
			var dependencyData = x.split('=')[1].split(':');

			return {
				type: 'library',
				group: dependencyData[0],
				name: dependencyData[1],
				version: dependencyData[2],
				testScope: false
			}
		})

	return libraryModule;
};

function getLibraryModules() {
	var libraryNames = ['development', 'global', 'portal'];

	return libraryNames.map(getLibraryModule);
};

function getMiscXML(resourceElements) {
	var miscXMLContent = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<project version="4">',
		'<component name="ProjectResources">'
	];

	miscXMLContent = miscXMLContent.concat(resourceElements);

	miscXMLContent.push('</component>');

	var buildPropertiesContent = '';

	if (fs.existsSync('build.properties')) {
		buildPropertiesContent = fs.readFileSync('build.properties');
	}

	var languageLevel = '1.8';
	var languageLevelRegex = /javac.source=([0-9\.]*)/g;
	var matchResult = languageLevelRegex.exec(buildPropertiesContent);

	if (matchResult) {
		languageLevel = matchResult[1];
	}

	var languageLevelName = 'JDK_' + languageLevel.replace('.', '_');

	var projectRootManager = '<component name="ProjectRootManager" version="2" languageLevel="' +
		languageLevelName + '" default="false" assert-keyword="true" jdk-15="true" ' +
			'project-jdk-name="1.8" project-jdk-type="JavaSDK" />';

	miscXMLContent.push(projectRootManager);
	miscXMLContent.push('</project>');

	return {
		name: '.idea/misc.xml',
		content: miscXMLContent.join('\n')
	}
};

function getTagLibraryURIs(accumulator, tagLibraryPath) {
	var tagLibraryContent = fs.readFileSync(tagLibraryPath, {encoding: 'UTF8'});

	var pos1 = tagLibraryContent.indexOf('<uri>') + 5;
	var pos2 = tagLibraryContent.indexOf('</uri>', pos1);

	var tagLibraryURI = tagLibraryContent.substring(pos1, pos2);

	if (!accumulator.hasOwnProperty(tagLibraryURI) ||
		(tagLibraryPath.indexOf('portal-web') == 0)) {

		accumulator[tagLibraryURI] = tagLibraryPath;

		if (tagLibraryURI == 'http://java.sun.com/portlet') {
			accumulator['http://java.sun.com/portlet_2_0'] = tagLibraryPath;
		}
	}

	return accumulator;
};

function getTagLibraryResourceElement(pair) {
	return '<resource url="' + pair[0] + '" location="$PROJECT_DIR$/' + pair[1] + '" />';
};

function getTagLibraryPaths(module) {
	var sourceFolders = module.sourceFolders
		.map(highland.flip(getFilePath, 'META-INF'));

	var resourceFolders = module.resourceFolders
		.map(highland.flip(getFilePath, 'META-INF'));

	var webrootFolders = module.webrootFolders
		.map(highland.flip(getFilePath, 'WEB-INF/tld'));

	var searchFolders = sourceFolders
		.concat(resourceFolders)
		.concat(webrootFolders)
		.map(getFilePath(module.modulePath))
		.filter(isDirectory);

	return searchFolders
		.map(getFilePaths)
		.reduce(flatten, [])
		.filter(isTagLibraryFile);
};

function hasLibraryPath(library) {
	var libraryPaths = getLibraryJarPaths(library);

	return libraryPaths.length != 0;
};

function isLiferayModule(library) {
	return library.group != null && library.group.indexOf('com.liferay') == 0 && library.name.indexOf('com.liferay') == 0;
};

function isTagLibraryFile(fileName) {
	return fileName.indexOf('.tld') == fileName.length - 4;
};

function setWebContextPath(module) {
	if (isDirectory(getFilePath(module.modulePath, 'docroot'))) {
		module.webContextPath = '/' + module.moduleName;
		return module;
	}

	if (!module.bndContent) {
		return module;
	}

	var webContextPathRegex = /Web-ContextPath: ([^\r\n]+)/g;
	matchResult = webContextPathRegex.exec(module.bndContent);

	if (!matchResult) {
		return module;
	}

	module.webContextPath = '/o' + matchResult[1];
	return module;
};

exports.createProjectObjectModels = createProjectObjectModels;
exports.createProjectWorkspace = createProjectWorkspace;
exports.flatten = flatten;
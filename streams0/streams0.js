var child_process = require('child_process');
var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var path = require('path');
var streams2 = require('../streams2/streams2');
var streams4 = require('../streams5/streams4');
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
var generateFileListCache = streams8.generateFileListCache;
var getAncestorFiles = streams7.getAncestorFiles;
var getDependenciesWithStreams = streams4.getDependenciesWithStreams;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getJarLibraryXML = streams9.getJarLibraryXML;
var getLibraryDependency = streams4.getLibraryDependency;
var getLibraryJarPaths = streams8.getLibraryJarPaths;
var getLibraryVariableDependency = streams4.getLibraryVariableDependency;
var getLibraryXML = streams9.getLibraryXML;
var getMavenAggregator = streams9.getMavenAggregator;
var getMavenDependencyElement = streams9.getMavenDependencyElement;
var getMavenProject = streams9.getMavenProject;
var getMavenProjectXML = streams9.getMavenProjectXML;
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

function createProjectObjectModels(coreDetails, moduleDetails, pluginDetails, config) {
	console.log('[' + new Date().toLocaleTimeString() + ']', 'Checking for Git roots, Gradle caches, and Maven caches');

	coreDetails.forEach(checkForGitRoot);
	moduleDetails.forEach(checkForGitRoot);

	moduleDetails.forEach(checkForGradleCache);
	checkForGradleCache(getUserHome());
	checkForGradleCache('../liferay-binaries-cache-2020');
	checkForGradleCache('../liferay-binaries-cache-2017');
	checkForGradleCache('.');

	for (var gradleCache of gradleCaches) {
		generateFileListCache(gradleCache);
	}

	checkForMavenCache(getUserHome());

	for (var mavenCache of mavenCaches) {
		generateFileListCache(mavenCache);
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Analyzing existing IntelliJ breakpoints');

	checkBreakpoints(moduleDetails);

	if (pluginDetails) {
		pluginDetails.forEach(sortModuleAttributes);
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Processing dependency versions');

	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	var fixDetails = moduleDetails.concat(pluginDetails);

	fixDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	fixDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, true));
	fixDetails.forEach(highland.partial(checkExportDependencies, moduleVersions));

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Processing BOM dependencies');

	completeBomCache(moduleDetails);

	moduleDetails.forEach(fixMavenBomDependencies);

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Processing missing dependencies');

	completeLibraryCache(config['mvn-cache'], coreDetails, moduleDetails, pluginDetails);

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Generating Maven project');

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

function createProjectWorkspace(coreDetails, moduleDetails, pluginDetails, config) {
	console.log('[' + new Date().toLocaleTimeString() + ']', 'Checking for Git roots, Gradle caches, and Maven caches');

	coreDetails.forEach(checkForGitRoot);
	moduleDetails.forEach(checkForGitRoot);

	if (config.ic) {
		coreDetails.forEach(clearWebroots);
		moduleDetails.forEach(clearWebroots);
		pluginDetails.forEach(clearWebroots);
	}

	moduleDetails.forEach(checkForGradleCache);
	checkForGradleCache(getUserHome());
	checkForGradleCache('../liferay-binaries-cache-2020');
	checkForGradleCache('../liferay-binaries-cache-2017');
	checkForGradleCache('.');

	for (var gradleCache of gradleCaches) {
		generateFileListCache(gradleCache);
	}

	checkForMavenCache(getUserHome());

	for (var mavenCache of mavenCaches) {
		generateFileListCache(mavenCache);
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Analyzing existing IntelliJ breakpoints');

	checkBreakpoints(moduleDetails);

	if (pluginDetails) {
		pluginDetails.forEach(sortModuleAttributes);
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Processing dependency versions');

	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	var fixDetails = moduleDetails.concat(pluginDetails);

	fixDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	fixDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, true));
	fixDetails.forEach(highland.partial(checkExportDependencies, moduleVersions));

	coreDetails.forEach(sortModuleAttributes);
	moduleDetails.forEach(sortModuleAttributes);

	if (!config['no-complete-cache']) {
		console.log('[' + new Date().toLocaleTimeString() + ']', 'Processing BOM dependencies');

		var gradleCacheModuleDetails = moduleDetails;
		var gradleCachePluginDetails = pluginDetails;

		completeBomCache(gradleCacheModuleDetails);
	}

	moduleDetails.forEach(fixMavenBomDependencies);

	if (!config['no-complete-cache']) {
		console.log('[' + new Date().toLocaleTimeString() + ']', 'Processing missing dependencies');

		completeLibraryCache(config['mvn-cache'], coreDetails, gradleCacheModuleDetails, gradleCachePluginDetails);
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Generating IntelliJ workspace');

	moduleDetails.forEach(getFileTreeDependencies);
	moduleDetails.forEach(reorderLibraryDependencies);

   if (fs.existsSync('modules')) {
		moduleDetails.push({
			modulePath: 'modules',
			moduleName: 'modules',
			type: 'portal',
			webrootFolders: [],
			sourceFolders: [],
			resourceFolders: [],
			testSourceFolders: [],
			testResourceFolders: [],
			excludeFolders: [],
			projectDependencies: [],
			libraryDependencies: [],
			hasInitJsp: false,
			unload: false,
			bndContent: ''
		});
	}

	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);
	var pluginStream = highland(pluginDetails);

	var detailsStream = highland.merge([moduleStream, coreStream, pluginStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();
	var tagLibrariesStream = detailsStream.observe();

	var unloadModuleStream = (config.barebone || config.unload) ? detailsStream.observe() : highland([]);
	var unzipBinariesStream = (config.unzip) ? detailsStream.observe() : null;

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

	unloadModuleStream
		.filter(config.barebone ? isNonBareBoneModule : isUnloadModule)
		.map(getUnloadModuleElement)
		.sort()
		.collect()
		.map(getUnloadModuleXML)
		.each(saveContent);

	if (unzipBinariesStream != null) {
		var liferayHome = getLiferayHome();

		if (liferayHome.indexOf('${project.dir}/') == 0) {
			liferayHome = liferayHome.substring(15);
		}

		var catalinaHome = getCatalinaHome(liferayHome);

		unzipBinariesStream
			.each(unzipBinary.bind(null, liferayHome, catalinaHome));
	}

	detailsStream.done(function() {});

	addGitVersionControlSystem();
};

function addGitVersionControlSystem() {
	var vcsXML = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<project version="4">',
		'<component name="VcsDirectoryMappings">'
	];

	for (var gitRoot of gitRoots) {
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

	var workspaceXML = fs.readFileSync('.idea/workspace.xml').toString();

	var x = workspaceXML.indexOf('<breakpoints>');

	if (x == -1) {
		console.log('[' + new Date().toLocaleTimeString() + ']', 'No breakpoints found');
		return;
	}

	var y = workspaceXML.indexOf('</breakpoints>') + '</breakpoints>'.length;

	var breakpointsXML = workspaceXML.substring(x, y);

	x = breakpointsXML.indexOf('<url>');

	while (x != -1) {
		y = breakpointsXML.indexOf('</url>', x);

		var breakpointURL = breakpointsXML.substring(x + '<url>file://$PROJECT_DIR$/'.length, y);

		for (var j = 0; j < moduleDetails.length; j++) {
			if (breakpointURL.indexOf(moduleDetails[j].modulePath) == 0) {
				console.log('[' + new Date().toLocaleTimeString() + ']', 'Moving', moduleDetails[j].modulePath, 'up in the list of modules');

				moduleDetails[j].breakpointSort = 1;
			}
		}

		x = breakpointsXML.indexOf('<url>', y + 6);
	}
};

function checkForGitRoot(module) {
	if (!module.modulePath) {
		return;
	}

	var candidates = getAncestorFiles(module.modulePath, '.git');

	candidates.forEach(Set.prototype.add.bind(gitRoots));
};

function clearWebroots(module) {
	module.webrootFolders = [];
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
		.filter(keyExistsInObject('version'))
		.collect()
		.each(highland.partial(executeGradleFile, 'BOM dependencies have been downloaded'));
};

function completeLibraryCache(useMaven, coreDetails, moduleDetails, pluginDetails) {
	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);
	var pluginStream = highland(pluginDetails);

	var detailsStream = highland.merge([moduleStream, coreStream, pluginStream]);

	var completeCacheStream = detailsStream
		.pluck('libraryDependencies')
		.compact()
		.flatten()
		.uniqBy(isSameLibraryDependency)
		.filter(keyExistsInObject('group'))
		.doto(setLibraryName)
		.filter(keyExistsInObject('version'))
		.filter(needsCacheEntry)
		.filter(highland.compose(highland.not, hasLibraryPath));

	if (useMaven) {
		completeCacheStream.collect()
			.each(highland.partial(executeMavenFile, 'Missing dependencies have been downloaded'));
	}
	else {
		completeCacheStream.collect()
			.each(highland.partial(executeGradleFile, 'Missing dependencies have been downloaded'));
	}
};

function executeGradleFile(completionMessage, libraries) {
	if (!isFile('gradlew')) {
		return
	}

	if (libraries.length == 0) {
		return
	}

	var lastLibraryCount = 0;

	while ((libraries.length > 0) && (libraries.length != lastLibraryCount)) {
		lastLibraryCount = libraries.length;

		console.log('[' + new Date().toLocaleTimeString() + ']', 'Attempting to download', lastLibraryCount, (lastLibraryCount == 1) ? 'dependency' : 'dependencies');

		var gradleRepositoriesBlock = getProjectRepositories().reduce(getGradleRepositoriesBlock, []);

		var buildGradleContent = [
			'apply plugin: "java"'
		];

		buildGradleContent.push('buildscript {');
		buildGradleContent = buildGradleContent.concat(gradleRepositoriesBlock);
		buildGradleContent.push('}');

		buildGradleContent.push('dependencies {');
		buildGradleContent = buildGradleContent.concat(libraries.map(getGradleEntry));
		buildGradleContent.push('}');

		buildGradleContent = buildGradleContent.concat(gradleRepositoriesBlock);

		buildGradleContent = buildGradleContent.concat([
			'task completeLibraryCache(type: Exec) {',
			'\tcommandLine "echo", configurations.runtimeClasspath.files.size(), "files downloaded"',
			'}'
		]);

		var completeCacheFolder = getFilePath(process.cwd(), 'tmp/ijbuild');

		mkdirSync('tmp/ijbuild');

		fs.writeFileSync(getFilePath(completeCacheFolder, 'build.gradle'), buildGradleContent.join('\n'));

		var executable = getFilePath(process.cwd(), 'gradlew');

		var args = ['completeLibraryCache'];

		var options = {
			'cwd': completeCacheFolder,
			'stdio': [0,1,2],
		};

		try {
			execFileSync(executable, args, options);
		}
		catch (e) {
			console.error(e);
		}

		generateFileListCache('.gradle/caches/modules-2/files-2.1');

		for (var library of libraries) {
			delete library['jarPaths'];
		}

		libraries = libraries.filter(highland.compose(highland.not, hasLibraryPath));
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', completionMessage, '-', libraries.length, 'entries remaining');
};

function executeMavenFile(completionMessage, libraries) {
	if (libraries.length == 0) {
		return
	}

	var lastLibraryCount = 0;

	while ((libraries.length > 0) && (libraries.length != lastLibraryCount)) {
		console.log('[' + new Date().toLocaleTimeString() + ']', 'Attempting to download', lastLibraryCount, (lastLibraryCount == 1) ? 'dependency' : 'dependencies');

		var dependencyObjects = {
			dependency: libraries.map(getMavenDependencyElement)
		};

		var mavenCacheContent = getMavenProjectXML('complete-library-cache', '1.0.0-SNAPSHOT', dependencyObjects);

		var completeCacheFolder = getFilePath(process.cwd(), 'tmp/ijbuild');

		mkdirSync('tmp/ijbuild');

		fs.writeFileSync(getFilePath(completeCacheFolder, 'pom.xml'), mavenCacheContent);

		var args = ['--fail-at-end', 'dependency:go-offline'];

		var options = {
			'cwd': completeCacheFolder,
			'stdio': [0,1,2]
		};

		try {
			execFileSync('mvn', args, options);
		}
		catch (e) {
			console.error(e);
		}

		for (var mavenCache of mavenCaches) {
			generateFileListCache(mavenCache);
		}

		libraries = libraries.filter(highland.compose(highland.not, hasLibraryPath));
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', completionMessage);
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
			console.log('[' + new Date().toLocaleTimeString() + ']', 'Failed to resolve bom for ' + cacheKey);
			continue;
		}

		for (var key in library.variables) {
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
	module.unload = false;

	var module = streams9.fixProjectDependencies(moduleVersions, addAsLibrary, module);

	var bndPath = getFilePath(module.modulePath, 'bnd.bnd');

	if (!isFile(bndPath)) {
		module.unload = (module.modulePath.indexOf('modules/') == 0);
		return module;
	}

	module.bndContent = fs.readFileSync(bndPath).toString();

	if (module.modulePath.indexOf('/core/') != -1) {
		module.barebone = true;
	}
	else if (module.modulePath.indexOf('/post-upgrade-fix/') != -1) {
	}
	else if (isFile(getFilePath(module.modulePath, '.lfrbuild-app-server-lib'))) {
		module.barebone = true;
	}
	else if (isFile(getFilePath(module.modulePath, '.lfrbuild-portal-pre'))) {
		module.barebone = true;
	}
	else if (isFile(getFilePath(module.modulePath, '.lfrbuild-portal')) || isFile(getFilePath(module.modulePath, '.lfrbuild-portal-private'))) {
		var appBndPaths = getAncestorFiles(module.modulePath, 'app.bnd');

		if (appBndPaths.length == 1) {
			module.appBndContent = fs.readFileSync(appBndPaths[0]).toString();
			module.unload = module.appBndContent.indexOf('Liferay-Releng-Bundle: false') != -1;
		}
		else {
			module.unload = true;
		}
	}
	else {
		module.unload = true;
	}

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

	var libraryDependencyRegex1 = /dependency\sgroup *: *['"]([^'"]*)['"],[^\n]*name *: *['"]([^'"]*)['"],[^\n]*version *: *['"]([^'"]*)['"]/;
	var libraryDependencyRegex2 = /dependency\s['"]([^'"]*):([^'"]*):([^'"]*)['"]/;
	var libraryDependencyRegex3 = /dependency\sgroup *: *['"]([^'"]*)['"],[^\n]*name *: *['"]([^'"]*)['"],[^\n]*version *: ([^'"]+)/;

	var missingVersionDependencies = [];

	for (var i = 0; i < module.libraryDependencies.length; i++) {
		if (!module.libraryDependencies[i].libraryName && (module.libraryDependencies[i].version == null)) {
			missingVersionDependencies.push(module.libraryDependencies[i]);
		}
	}

	while ((dependencyTextResult = dependencyTextRegex.exec(buildGradleContents)) !== null) {
		if (!module.bomDependencies) {
			module.bomDependencies = [];
		}

		var dependencyText = dependencyTextResult[1];
		var overriddenByDependencies = dependencyText.indexOf('overriddenByDependencies = false') == -1;

		var bomDependencies = getDependenciesWithStreams(dependencyText, getBomDependency, mavenBomRegex);

		for (var i = 0; i < bomDependencies.length; i++) {
			bomDependencies[i].overriddenByDependencies = overriddenByDependencies;
		}

		Array.prototype.push.apply(module.bomDependencies, bomDependencies);

		var getLibraryDependencies = highland.partial(getDependenciesWithStreams, dependencyText, highland.partial(getLibraryDependency, module.modulePath));
		var getLibraryVariableDependencies = highland.partial(getDependenciesWithStreams, dependencyText, highland.partial(getLibraryVariableDependency, module.modulePath));

		var libraryDependencies = [];

		Array.prototype.push.apply(libraryDependencies, getLibraryDependencies(libraryDependencyRegex1));
		Array.prototype.push.apply(libraryDependencies, getLibraryDependencies(libraryDependencyRegex2));
		Array.prototype.push.apply(libraryDependencies, getLibraryVariableDependencies(libraryDependencyRegex3));

		for (var i = 0; i < missingVersionDependencies.length; i++) {
			for (var j = 0; j < libraryDependencies.length; j++) {
				if ((missingVersionDependencies[i].group == libraryDependencies[j].group) && (missingVersionDependencies[i].name == libraryDependencies[j].name)) {
					missingVersionDependencies[i].version = libraryDependencies[j].version;
					missingVersionDependencies.splice(i--, 1);
					break;
				}
			}
		}
	}

	if (missingVersionDependencies.length == 0) {
		return;
	}

	if (!module.modulePath) {
		return;
	}

	var parentBuildGradlePath = getFilePath(path.dirname(module.modulePath), 'build.gradle');

	if (!isFile(parentBuildGradlePath)) {
		return;
	}

	var parentModule = {
		buildGradleContents: fs.readFileSync(parentBuildGradlePath).toString(),
		libraryDependencies: module.libraryDependencies
	};

	gatherMavenBomDependencies(parentModule);

	if (parentModule.bomDependencies) {
		if (!module.bomDependencies) {
			module.bomDependencies = [];
		}

		Array.prototype.push.apply(module.bomDependencies, parentModule.bomDependencies);
	}
};

function getAppServerProperty(propertyName) {
	var appServerPropertiesPath = ['app', 'server', process.env.USER || process.env.USERNAME, 'properties'].join('.')

	var propertyValue = getProperty(appServerPropertiesPath, propertyName);

	if (propertyValue) {
		return propertyValue;
	}

	return getProperty('app.server.properties', propertyName);
};

function getBomDependency(matchResult) {
	if (matchResult == null) {
		return null;
	}

	var dependency = {
		type: 'library',
		group: matchResult[1],
		name: matchResult[2],
		version: matchResult[3],
		packaging: 'pom',
		testScope: false
	};

	return dependency;
};

function getCatalinaHome(liferayHome) {
	if (process.env.CATALINA_HOME) {
		return process.env.CATALINA_HOME;
	}

	var tomcatVersion = getAppServerProperty('app.server.tomcat.version');

	if (!tomcatVersion) {
		return null;
	}

	return getFilePath(liferayHome, 'tomcat-' + tomcatVersion);
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
				.filter(function(x) { return x.indexOf('.jar') != -1 && x.indexOf('-sources.jar') == -1 })
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
	return '\truntimeOnly group: "' + library['group'] + '", name: "' + library['name'] + '", version: "' + library['version'] + '"';
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
		.filter(function(x) {
			if (x.indexOf('#') == 0) {
				return false;
			}

			if (x.indexOf('=') == -1) {
				return false;
			}

			return true;
		})
		.map(function(x) {
			var propertyValue = x.split('=')[1];
			var dependencyData = propertyValue.replace(/\\/g, '').split(':');

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

	return libraryNames.filter(function(name) { return isDirectory(getFilePath('lib', name)) }).map(getLibraryModule);
};

function getLiferayHome() {
	if (process.env.LIFERAY_HOME) {
		return process.env.LIFERAY_HOME;
	}

	var liferayHome = getAppServerProperty('app.server.parent.dir');

	if (liferayHome) {
		return liferayHome;
	}

	return '${project.dir}/../bundles';
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
		languageLevelName + '" default="false" assert-keyword="true" ' +
			'project-jdk-name="' + languageLevel + '" project-jdk-type="JavaSDK" />';

	miscXMLContent.push(projectRootManager);
	miscXMLContent.push('</project>');

	return {
		name: '.idea/misc.xml',
		content: miscXMLContent.join('\n')
	}
};

function getProperty(filePath, propertyName) {
	if (!isFile(filePath)) {
		return null;
	}

	var lines = fs.readFileSync(filePath).toString().split('\n').map(trim);

	var needle = propertyName + '=';

	var propertyValue = [];

	for (var i = 0; i < lines.length; i++) {
		var currentValue = null;

		if (propertyValue.length > 0) {
			currentValue = lines[i];
		}
		else if (lines[i].indexOf(needle) == 0) {
			currentValue = lines[i].substring(needle.length);
		}
		else {
			continue;
		}

		if (currentValue.length == 0) {
			continue;
		}

		if (currentValue.charAt(currentValue.length - 1) != '\\') {
			propertyValue.push(currentValue);

			break;
		}

		propertyValue.push(currentValue.substring(0, currentValue.length - 1));
	}

	if (propertyValue.length == 0) {
		return null;
	}

	return propertyValue.join('');
}

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

	var nestedResourceFolders = module.resourceFolders
		.map(highland.flip(getFilePath, 'META-INF/resources'));

	var webrootFolders = module.webrootFolders
		.map(highland.flip(getFilePath, 'WEB-INF/tld'));

	var searchFolders = sourceFolders
		.concat(resourceFolders)
		.concat(nestedResourceFolders)
		.concat(webrootFolders)
		.map(getFilePath(module.modulePath))
		.filter(isDirectory);

	return searchFolders
		.map(getFilePaths)
		.reduce(flatten, [])
		.filter(isTagLibraryFile);
};

function getUnloadModuleElement(module) {
	return '<module name="' + module.moduleName + '" />';
};

function getUnloadModuleXML(unloadModuleElements) {
	var workspaceXML = [];

	if (fs.existsSync('.idea/workspace.xml')) {
		workspaceXML = fs.readFileSync('.idea/workspace.xml').toString()
			.split('\n')
			.map(function(x) { return x.trim(); });

		var x = -1;
		var y = -1;

		for (var i = 1; i < workspaceXML.length; i++) {
			if (x > 0) {
				if (workspaceXML[i] == '</component>') {
					y = i;
					break;
				}
			}
			else if (workspaceXML[i] == '<component name="AutomaticModuleUnloader">') {
				x = i;
			}
		}

		if (x != -1) {
			workspaceXML.splice(x, y - x + 1);
		}

		x = -1;
		y = -1;

		for (var i = 1; i < workspaceXML.length; i++) {
			if (x > 0) {
				if (workspaceXML[i] == '</component>') {
					y = i;
					break;
				}
			}
			else if (workspaceXML[i] == '<component name="UnloadedModulesList">') {
				x = i;
			}
		}


		if (x != -1) {
			workspaceXML.splice(x, y - x + 1);
		}

		workspaceXML.splice(workspaceXML.length - 1, 1);
	}
	else {
		workspaceXML.push('<?xml version="1.0" encoding="UTF-8"?>');
		workspaceXML.push('<project version="4">');
	}

	if (unloadModuleElements.length > 0) {
		workspaceXML.push('<component name="UnloadedModulesList">');
		workspaceXML = workspaceXML.concat(unloadModuleElements);
		workspaceXML.push('</component>');
	}

	workspaceXML.push('</project>');

	return {
		name: '.idea/workspace.xml',
		content: workspaceXML.join('\n')
	};
};

function hasLibraryPath(library) {
	if (streams9.isMegaJarDependency(library)) {
		return true;
	}

	var libraryPaths = getLibraryJarPaths(library);

	return libraryPaths.length != 0;
};

function hasTagLibrary(module) {
	return isDirectory(getFilePath(module.modulePath, 'src')) && getTagLibraryPaths(module).length > 0;
};

function isNonBareBoneModule(module) {
	return module.type != 'portal' && !module.barebone;
};

function isTagLibraryFile(fileName) {
	return fileName.indexOf('.tld') == fileName.length - 4;
};

function isUnloadModule(module) {
	return module.unload;
};

function mkdirSync(path) {
	var pos = path.indexOf('/');

	while (pos != -1) {
		var ancestor = path.substring(0, pos);

		if (!isDirectory(ancestor)) {
			fs.mkdirSync(ancestor, 0775);
		}

		pos = path.indexOf('/', pos + 1);
	}

	if (!isDirectory(path)) {
		fs.mkdirSync(path);
	}
};

function needsCacheEntry(library) {
	if (!library.group) {
		return false;
	}

	if (library.version == 'default') {
		return false;
	}

	if (library.group == 'com.liferay.osb.koroneiki' && library.name == 'com.liferay.osb.koroneiki.client') {
		return false;
	}

	return true;
};

function reorderLibraryDependencies(module) {
	if (!module.libraryDependencies) {
		return;
	}

	for (var i = 1; i < module.libraryDependencies.length; i++) {
		var right = module.libraryDependencies[i];

		if (!right.group) {
			continue;
		}

		var rightVariableName = [right.group, right.name].join(':');

		for (var j = 0; j < i; j++) {
			var left = module.libraryDependencies[j];

			if (!left.group) {
				continue;
			}

			var leftCacheKey = [left.group, left.name, left.version].join(':');
			var leftLibrary = libraryCache[leftCacheKey];

			if (!leftLibrary || !leftLibrary['variables'] || !leftLibrary['variables'][rightVariableName]) {
				continue;
			}

			module.libraryDependencies.splice(i, 1);
			module.libraryDependencies.splice(j, 0, right);
			break;
		}
	}
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

function trim(str) {
	return str.trim();
}

function unzipBinary(liferayHome, catalinaHome, module) {
	if (!liferayHome) {
		return;
	}

	var moduleClassesPath = getFilePath(module.modulePath, 'classes');

	if (isDirectory(moduleClassesPath)) {
		return;
	}

	var moduleBinaryPaths = [
		getFilePath(liferayHome, 'osgi/core/' + module.bundleSymbolicName + '.jar'),
		getFilePath(liferayHome, 'osgi/modules/' + module.bundleSymbolicName + '.jar'),
		getFilePath(liferayHome, 'osgi/portal/' + module.bundleSymbolicName + '.jar'),
		getFilePath(liferayHome, 'osgi/static/' + module.bundleSymbolicName + '.jar'),
		getFilePath(catalinaHome, 'lib/ext/' + module.moduleName + '.jar'),
		getFilePath(catalinaHome, 'webapps/ROOT/WEB-INF/lib/' + module.moduleName + '.jar')
	].filter(isFile);

	if (moduleBinaryPaths.length == 0) {
		return;
	}

	var moduleBinaryPath = moduleBinaryPaths[0];

	mkdirSync(moduleClassesPath);

	var args = ['-oqq', moduleBinaryPath];

	var options = {
		'cwd': moduleClassesPath,
		'stdio': [0,1,2]
	};

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Unzipping', moduleBinaryPath, 'to', moduleClassesPath);

	try {
		execFileSync('unzip', args, options);

		if (moduleBinaryPath.indexOf('osgi') == -1) {
			execFileSync('cp', [moduleBinaryPath, module.modulePath]);
		}
	}
	catch (e) {
		console.error(e);
	}
};

exports.createProjectObjectModels = createProjectObjectModels;
exports.createProjectWorkspace = createProjectWorkspace;
exports.flatten = flatten;
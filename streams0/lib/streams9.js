var child_process = require('child_process');
var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var os = require('os');
var streams2 = require('./streams2');
var streams5 = require('./streams5');
var streams6 = require('./streams6');
var streams7 = require('./streams7');
var streams8 = require('./streams8');
var xmlbuilder = require('xmlbuilder');

var flatten = streams8.flatten;
var getAncestorFiles = streams7.getAncestorFiles;
var getComponentXML = streams6.getComponentXML;
var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getLibraryOrderEntryElement = streams8.getLibraryOrderEntryElement;
var getLibraryRootElement = streams8.getLibraryRootElement;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getPomDependencyPaths = streams8.getPomDependencyPaths;
var getSourceFolderElement = streams6.getSourceFolderElement;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var isFirstOccurrence = streams8.isFirstOccurrence;
var isSameLibraryDependency = streams8.isSameLibraryDependency;
var keyExistsInObject = highland.ncurry(2, streams8.keyExistsInObject);
var saveContent = streams6.saveContent;
var setLibraryName = streams8.setLibraryName;

var gradleCaches = new Set();
var projectRepositories = [];

function checkForGradleCache(module) {
	if (!module.modulePath) {
		return;
	}

	var candidates = getAncestorFiles(module.modulePath, '.gradle/caches/modules-2/files-2.1');

	candidates.forEach(Set.prototype.add.bind(gradleCaches));
};

function createProjectObjectModels(coreDetails, moduleDetails) {
	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, false));

	var moduleStream = highland(moduleDetails);

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
	if (pluginDetails) {
		pluginDetails.forEach(sortModuleAttributes);
	}

	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, true));
	moduleDetails.forEach(checkExportDependencies);

	coreDetails.forEach(sortModuleAttributes);
	moduleDetails.forEach(sortModuleAttributes);

	moduleDetails.forEach(checkForGradleCache);

	var homeGradleCache = getFilePath(os.homedir(), '.gradle/caches/modules-2/files-2.1');

	if (isDirectory(homeGradleCache)) {
		gradleCaches.add(homeGradleCache);
	}

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
		.sortBy(comparators.comparing('moduleName'))
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

	detailsStream.done(function() {});
};

function checkExportDependencies(module) {
	var isTestModule = (module.moduleName.indexOf('test') != -1);

	if (isTestModule) {
		var isDevelopmentLibrary = function(dependency) {
			return dependency.name == 'development';
		};

		module.libraryDependencies = module.libraryDependencies || [];

		if (!module.libraryDependencies.some(isDevelopmentLibrary)) {
			var developmentDependency = {
				type: 'library',
				name: 'development',
				libraryName: 'development'
			};

			module.libraryDependencies.push(developmentDependency);
		}
	}

	if (module.moduleName.indexOf('gradle-') == 0) {
		var libraryDependency = {
			type: 'library',
			name: 'gradlew',
			libraryName: 'gradlew'
		};

		module.libraryDependencies.push(libraryDependency);
	}

	var isThirdPartyModule = (module.modulePath.indexOf('sdk') != -1) ||
		((module.modulePath.indexOf('core') != -1) && (module.moduleName.indexOf('osgi') != -1)) ||
		(module.modulePath.indexOf('third-party') != -1);

	var checkExportDependency = function(dependency) {
		if (isTestModule || isThirdPartyModule) {
			dependency.exported = true;
		}
	};

	if ('libraryDependencies' in module) {
		module.libraryDependencies.forEach(checkExportDependency);
	}

	if ('projectDependencies' in module) {
		module.projectDependencies.forEach(checkExportDependency);
	}
};

function fixLibraryDependencies(moduleVersions, module) {
	if (!('libraryDependencies' in module)) {
		module.libraryDependencies = [];
	}

	var ownVersion = moduleVersions[module.moduleName];

	for (var i = module.libraryDependencies.length - 1; i >= 0; i--) {
		var dependency = module.libraryDependencies[i];
		var dependencyGroup = dependency.group;

		if (!dependencyGroup || (dependencyGroup.indexOf('com.liferay') != 0)) {
			continue;
		}

		var dependencyName = dependency.name;

		if (!(dependencyName in moduleVersions)) {
			continue;
		}

		var moduleVersion = moduleVersions[dependencyName];

		if (module.hasInitJsp && moduleVersion.hasInitJsp) {
			dependency.hasInitJsp = true;
			continue;
		}

		module.libraryDependencies.splice(i, 1);

		var projectDependency = {
			type: 'project',
			name: moduleVersion.projectName,
			testScope: dependency.testScope
		};

		module.projectDependencies.push(projectDependency);
	}

	return module;
};

function fixProjectDependencies(moduleVersions, addAsLibrary, module) {
	if (!('projectDependencies' in module)) {
		return module;
	}

	if (!module.hasInitJsp) {
		return module;
	}

	for (var i = module.projectDependencies.length - 1; i >= 0; i--) {
		var dependency = module.projectDependencies[i];
		var dependencyName = dependency.name;

		if (!(dependencyName in moduleVersions)) {
			continue;
		}

		if (!addAsLibrary) {
			module.projectDependencies.splice(i, 1);
			continue;
		}

		var moduleVersion = moduleVersions[dependencyName];

		if (!moduleVersion.hasInitJsp) {
			continue;
		}

		module.projectDependencies.splice(i, 1);

		var libraryDependency = {
			type: 'library',
			group: 'com.liferay',
			name: moduleVersion.bundleName,
			version: dependency.version || moduleVersion.version,
			testScope: dependency.testScope,
			hasInitJsp: true
		};

		module.libraryDependencies.push(libraryDependency);
	}

	return module;
};

function getCoreLibraryOrderEntryElements(module) {
	if (!module.libraryDependencies) {
		return [];
	}

	return module.libraryDependencies
		.filter(highland.compose(highland.not, keyExistsInObject('group')))
		.map(setLibraryName)
		.map(highland.partial(getLibraryOrderEntryElement, module));
};

function getGradleLibraryPaths(gradleBasePath, library) {
	if (!('group' in library)) {
		return [];
	}

	var folderPath = [library.group, library.name, library.version].reduce(getFilePath, gradleBasePath);

	if (!isDirectory(folderPath)) {
		return [];
	}

	var jarName = library.name + '-' + library.version + '.jar';

	var jarPaths = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, jarName))
		.filter(isFile);

	if ((library.group == 'com.liferay') && library.hasInitJsp) {
		return jarPaths;
	}

	var pomName = library.name + '-' + library.version + '.pom';

	var pomPaths = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, pomName))
		.filter(isFile);

	if (pomPaths.length > 0) {
		return jarPaths.concat(getPomDependencyPaths(pomPaths[0], library.version)).filter(isFirstOccurrence);
	}

	return jarPaths;
};

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
	else if (library.name == 'gradlew') {
		libraryTableXML.push(
			'<root url="file://$PROJECT_DIR$/.gradle/wrapper/dists" />');
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

function getLibraryPaths(library) {
	if (library.libraryPaths) {
		return library.libraryPaths;
	}

	var mavenLibraryPaths = getMavenLibraryPaths(library);

	if (mavenLibraryPaths.length != 0) {
		return mavenLibraryPaths;
	}

	for (gradleCache of gradleCaches) {
		gradleLibraryPaths = getGradleLibraryPaths(gradleCache, library);

		if (gradleLibraryPaths.length != 0) {
			return gradleLibraryPaths;
		}
	}

	return [];
};

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

	var sourcePaths = binaryPaths.map(getMavenSourcePath).filter(isFile);

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

function getMavenAggregator(modulePaths) {
	var project = {
		project: {
			'@xmlns': 'http://maven.apache.org/POM/4.0.0',
			'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
			'@xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
			modelVersion: '4.0.0',
			groupId: 'com.liferay.dependencies',
			artifactId: 'parent',
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

function getMavenDependencyElement(library) {
	var dependencyElement = {
		'groupId': library.group,
		'artifactId': library.name,
		'version': library.version
	};

	if ((library.group == 'org.jboss.shrinkwrap') && (library.name == 'shrinkwrap-depchain')) {
		dependencyElement['type'] = 'pom';
	}

	return dependencyElement;
};

function getMavenLibraryPaths(library) {
	if (!('group' in library)) {
		return [];
	}

	var jarFileName = library.name + '-' + library.version + '.jar';

	var userHome = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

	var jarRelativePath = library.group.split('.').concat([library.name, library.version, jarFileName]).join('/');
	var jarAbsolutePath = ['.m2', 'repository', jarRelativePath].reduce(getFilePath, userHome);

	var jarPaths = [];

	if (isFile(jarAbsolutePath)) {
		jarPaths = [getFilePath('$MAVEN_REPOSITORY$', jarRelativePath)];
	}

	if ((library.group == 'com.liferay') && library.hasInitJsp) {
		return jarPaths;
	}

	var pomFileName = library.name + '-' + library.version + '.pom';

	var pomRelativePath = library.group.split('.').concat([library.name, library.version, pomFileName]).join('/');
	var pomAbsolutePath = ['.m2', 'repository', pomRelativePath].reduce(getFilePath, userHome);

	if (!isFile(pomAbsolutePath)) {
		return jarPaths;
	}

	return jarPaths.concat(getPomDependencyPaths(pomAbsolutePath, library.version)).filter(isFirstOccurrence);
};

function getMavenProject(module) {
	var dependencyObjects = {};

	if (module.libraryDependencies) {
		var libraryDependencies = module.libraryDependencies
			.filter(keyExistsInObject('group'))

		if (libraryDependencies.length > 0) {
			dependencyObjects = {
				dependency: libraryDependencies.map(getMavenDependencyElement)
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
				repository: getProjectRepositories()
			}
		}
	};

	return {
		name: getFilePath(module.modulePath, 'pom.xml'),
		content: xmlbuilder.create(project).end({pretty: true})
	};
};

function getMavenSourcePath(mavenBinaryPath) {
	var pos = mavenBinaryPath.lastIndexOf('.');

	return mavenBinaryPath.substring(0, pos) + '-sources' + mavenBinaryPath.substring(pos);
};

function getModuleXML(module) {
	return {
		fileName: getModuleIMLPath(module),
		components: [
			{
				name: 'NewModuleRootManager',
				content: getNewModuleRootManagerXML(module)
			},
			{
				name: 'FacetManager',
				content: getFacetManagerXML(module)
			}
		]
	};
};

function getNewModuleRootManagerXML(module) {
	var newModuleRootManagerXML = [streams6.getNewModuleRootManagerXML(module)];

	newModuleRootManagerXML = newModuleRootManagerXML.concat(streams8.getModuleLibraryOrderEntryElements(module));
	newModuleRootManagerXML = newModuleRootManagerXML.concat(streams7.getProjectOrderEntryElements(module));
	newModuleRootManagerXML = newModuleRootManagerXML.concat(getCoreLibraryOrderEntryElements(module));

	return newModuleRootManagerXML.join('\n');
};

function getProjectRepositories() {
	if (projectRepositories.length > 0) {
		return projectRepositories;
	}

	var tempProjectRepositories = [];

	tempProjectRepositories.push({
		id: 'apache',
		name: 'Apache',
		url: 'http://repo.maven.apache.org/maven2',
		layout: 'default'
	});

	tempProjectRepositories.push({
		id: 'liferay-public',
		name: 'Liferay Public',
		url: 'http://repository.liferay.com/nexus/content/repositories/public',
		layout: 'default'
	});

	var buildPropertiesContent = child_process.execSync('git show upstream/ee-7.0.x:build.properties');

	var privateRepositoryRegex = /build.repository.private.password=(\S*)\s*build.repository.private.url=https:\/\/(\S*)\s*build.repository.private.username=(\S*)/g;

	var matchResult = privateRepositoryRegex.exec(buildPropertiesContent);

	if (matchResult) {
		var repositoryURL = 'https://' +
			encodeURIComponent(matchResult[3]) + ':' + encodeURIComponent(matchResult[1]) +
				'@' + matchResult[2];

		tempProjectRepositories.push({
			id: 'liferay-private',
			name: 'Liferay Private',
			url: repositoryURL,
			layout: 'default'
		});
	}

	projectRepositories = tempProjectRepositories;

	return projectRepositories;
};

function isDevelopmentLibrary(libraryName) {
	return libraryName.indexOf('.jar') == libraryName.length - 4;
};

function setCoreBundleVersions(accumulator, module) {
	var bndPath = getFilePath(module.modulePath, 'bnd.bnd');
	var buildXmlPath = getFilePath(module.modulePath, 'build.xml');

	if (!isFile(bndPath)) {
		return accumulator;
	}

	var bndContent = fs.readFileSync(bndPath);
	var buildXmlContent = fs.readFileSync(buildXmlPath);

	var bundleNameRegex = /property name="manifest.bundle.symbolic.name" value="([^"\;]*)/g;
	var bundleVersionRegex = /Bundle-Version: ([^\n]+)/g;

	var matchResult = bundleNameRegex.exec(buildXmlContent);

	if (!matchResult) {
		return accumulator;
	}

	var bundleName = matchResult[1];

	matchResult = bundleVersionRegex.exec(bndContent);

	if (!matchResult) {
		return accumulator;
	}

	var bundleVersion = matchResult[1];

	accumulator[bundleName] = {
		projectName: module.moduleName,
		version: bundleVersion
	};

	return accumulator;
};

function setModuleBundleVersions(accumulator, module) {
	var bndPath = getFilePath(module.modulePath, 'bnd.bnd');
	var packageJsonPath = getFilePath(module.modulePath, 'package.json');

	var bundleName, bundleVersion;

	if (isFile(bndPath)) {
		var bndContent = fs.readFileSync(bndPath);

		var bundleNameRegex = /Bundle-SymbolicName: ([^\n]+)/g;
		var bundleVersionRegex = /Bundle-Version: ([^\n]+)/g;

		var bundleNameMatcher = bundleNameRegex.exec(bndContent);

		bundleName = bundleNameMatcher ? bundleNameMatcher[1] : module.moduleName;
		bundleVersion = bundleVersionRegex.exec(bndContent)[1];
	}
	else if (isFile(packageJsonPath)) {
		var packageJsonContent = fs.readFileSync(packageJsonPath);

		var packageJson = JSON.parse(packageJsonContent);

		bundleName = packageJson.name;
		bundleVersion = packageJson.version;
	}
	else {
		console.warn('Unable to find project name for ' + module.modulePath);
		return accumulator;
	}

	accumulator[bundleName] = {
		projectName: module.moduleName,
		version: bundleVersion,
		hasWebroot: module.webrootFolders.length > 0
	};

	accumulator[module.moduleName] = {
		bundleName: bundleName,
		version: bundleVersion,
		hasWebroot: module.webrootFolders.length > 0
	};

	return accumulator;
};

function sortModuleAttributes(module) {
	module.sourceFolders.sort();
	module.resourceFolders.sort();
	module.testSourceFolders.sort();
	module.testResourceFolders.sort();

	if (module.libraryDependencies) {
		module.libraryDependencies.sort(comparators.comparing('name'));
	}

	if (module.projectDependencies) {
		module.projectDependencies.sort(comparators.comparing('name'));
	}

	return module;
};

exports.checkExportDependencies = checkExportDependencies;
exports.checkForGradleCache = checkForGradleCache;
exports.createProjectObjectModels = createProjectObjectModels;
exports.createProjectWorkspace = createProjectWorkspace;
exports.fixLibraryDependencies = fixLibraryDependencies;
exports.fixProjectDependencies = fixProjectDependencies;
exports.gradleCaches = gradleCaches;
exports.getJarLibraryXML = getJarLibraryXML;
exports.getLibraryXML = getLibraryXML;
exports.getModuleXML = getModuleXML;
exports.setCoreBundleVersions = setCoreBundleVersions;
exports.setModuleBundleVersions = setModuleBundleVersions;
exports.sortModuleAttributes = sortModuleAttributes;
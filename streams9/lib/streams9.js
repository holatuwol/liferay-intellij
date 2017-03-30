var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
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

function checkForGradleCache(module) {
	if (!module.modulePath) {
		return;
	}

	var candidates = getAncestorFiles(module.modulePath, '.gradle/caches/modules-2/files-2.1');

	candidates.forEach(Set.prototype.add.bind(gradleCaches));
};

function createProjectObjectModels(coreDetails, moduleDetails) {
	var moduleStream = highland(moduleDetails);

	var mavenProjectStream = moduleStream.observe();
	var mavenAggregatorStream = moduleStream.observe();

	mavenProjectStream
		.done(function() {});

	mavenAggregatorStream
		.done(function() {});

	moduleStream.done(function() {});
};

function createProjectWorkspace(coreDetails, moduleDetails) {
	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, true));

	coreDetails.forEach(sortModuleAttributes);
	moduleDetails.forEach(sortModuleAttributes);

	moduleDetails.forEach(checkForGradleCache);

	var homeGradleCache = getFilePath(os.homedir(), '.gradle/caches/modules-2/files-2.1');

	if (isDirectory(homeGradleCache)) {
		gradleCaches.add(homeGradleCache);
	}

	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);

	var detailsStream = highland.merge([moduleStream, coreStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();
	var mavenProjectStream = detailsStream.observe();
	var mavenAggregatorStream = detailsStream.observe();

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
		.done(function() {});

	libraryFilesStream
		.filter(highland.partial(keyExistsInObject, 'group'))
		.doto(setLibraryName)
		.map(getLibraryXML)
		.each(saveContent);

	mavenProjectStream
		.done(function() {});

	mavenAggregatorStream
		.done(function() {});

	detailsStream.done(function() {});
};

function fixLibraryDependencies(moduleVersions, module) {
	if (!('libraryDependencies' in module)) {
		module.libraryDependencies = [];
	}

	var ownVersion = moduleVersions[module.moduleName];

	var moduleHasWebroot = module.webrootFolders.length > 0;

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

		if (moduleHasWebroot && moduleVersion.hasWebroot) {
			dependency.hasWebroot = true;
			continue;
		}

		var dependencyVersion = dependency.version;

		module.libraryDependencies.splice(i, 1);

		var projectDependency = {
			type: 'project',
			name: moduleVersion.projectName,
			version: dependencyVersion
		};

		module.projectDependencies.push(projectDependency);
	}

	return module;
};

function fixProjectDependencies(moduleVersions, addAsLibrary, module) {
	if (!('projectDependencies' in module)) {
		return module;
	}

	var moduleHasWebroot = module.webrootFolders.length > 0;

	if (!moduleHasWebroot) {
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

		if (!moduleVersion.hasWebroot) {
			continue;
		}

		module.projectDependencies.splice(i, 1);

		var libraryDependency = {
			type: 'library',
			group: 'com.liferay',
			name: moduleVersion.bundleName,
			version: dependency.version || moduleVersion.version,
			hasWebroot: true
		};

		module.libraryDependencies.push(libraryDependency);
	}

	return module;
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

	if ((library.group == 'com.liferay') && library.hasWebroot) {
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

	if ((library.group == 'com.liferay') && library.hasWebroot) {
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
	var newModuleRootManagerXML = [streams8.getNewModuleRootManagerXML(module)];

	if (module.libraryDependencies) {
		// TODO: Perform work on module.libraryDependencies here
	}

	return newModuleRootManagerXML.join('\n');
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
	var bndContent = fs.readFileSync(bndPath);

	var bundleNameRegex = /Bundle-SymbolicName: ([^\n]+)/g;
	var bundleVersionRegex = /Bundle-Version: ([^\n]+)/g;

	var bundleName = bundleNameMatcher ? bundleNameMatcher[1] : module.moduleName;
	var bundleVersion = bundleVersionRegex.exec(bndContent)[1];

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

exports.createProjectObjectModels = createProjectObjectModels;
exports.createProjectWorkspace = createProjectWorkspace;
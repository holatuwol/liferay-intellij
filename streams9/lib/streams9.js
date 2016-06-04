var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var semver = require('semver');
var streams2 = require('./streams2');
var streams5 = require('./streams5');
var streams6 = require('./streams6');
var streams7 = require('./streams7');
var streams8 = require('./streams8');
var xmlbuilder = require('xmlbuilder');

var getComponentXML = streams6.getComponentXML;
var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getGradleLibraryPaths = streams8.getGradleLibraryPaths;
var getIntellijXML = streams6.getIntellijXML;
var getLibraryOrderEntryElement = streams8.getLibraryOrderEntryElement;
var getLibraryRootElement = streams8.getLibraryRootElement;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getModuleOrderEntryElement = streams7.getModuleOrderEntryElement;
var getPomDependencyPaths = streams8.getPomDependencyPaths;
var getSourceFolderElement = streams6.getSourceFolderElement;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isFile = streams2.isFile;
var isSameLibraryDependency = streams8.isSameLibraryDependency;
var keyExistsInObject = highland.ncurry(2, streams8.keyExistsInObject);
var saveContent = streams6.saveContent;
var setLibraryName = streams8.setLibraryName;

function createProjectObjectModels(moduleDetails) {
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
	coreDetails = coreDetails.map(sortModuleAttributes);
	moduleDetails = moduleDetails.map(sortModuleAttributes);

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
		.sortBy(comparators.comparing('modulePath'))
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

function getLibraryPaths(library) {
	var mavenLibraryPaths = getMavenLibraryPaths(library);

	if (mavenLibraryPaths.length != 0) {
		return mavenLibraryPaths;
	}

	var gradleLibraryPaths = getGradleLibraryPaths(library);

	if (gradleLibraryPaths.length != 0) {
		return gradleLibraryPaths;
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

function getMavenLibraryPaths(library) {
	if (!('group' in library)) {
		return [];
	}

	var jarFileName = library.name + '-' + library.version + '.jar';

	var userHome = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

	var jarRelativePath = library.group.split('.').concat([library.name, library.version, jarFileName]).join('/');
	var jarAbsolutePath = ['.m2', 'repository', jarRelativePath].reduce(getFilePath, userHome);

	if (isFile(jarAbsolutePath)) {
		return [getFilePath('$MAVEN_REPOSITORY$', jarRelativePath)];
	}

	var pomFileName = library.name + '-' + library.version + '.pom';

	var pomRelativePath = library.group.split('.').concat([library.name, library.version, pomFileName]).join('/');
	var pomAbsolutePath = ['.m2', 'repository', pomRelativePath].reduce(getFilePath, userHome);

	if (!isFile(pomAbsolutePath)) {
		return [];
	}

	return getPomDependencyPaths(pomAbsolutePath, library.version);
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
	var newModuleRootManagerXML = ['<content url="file://$MODULE_DIR$">'];

	newModuleRootManagerXML = newModuleRootManagerXML.concat(
		module.sourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'false')),
		module.resourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-resource')),
		module.testSourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'true')),
		module.testResourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-test-resource')),
		module.excludeFolders.map(getExcludeFolderElement)
	);

	newModuleRootManagerXML.push('</content>');
	newModuleRootManagerXML.push('<orderEntry type="inheritedJdk" />');
	newModuleRootManagerXML.push('<orderEntry type="sourceFolder" forTests="false" />');

	if (module.libraryDependencies) {
		var libraryOrderEntryElements = module.libraryDependencies
			.map(setLibraryName)
			.map(getLibraryOrderEntryElement);

		newModuleRootManagerXML = newModuleRootManagerXML.concat(libraryOrderEntryElements);
	}

	if (module.projectDependencies) {
		var projectOrderEntryElements = module.projectDependencies
			.map(getModuleOrderEntryElement);

		newModuleRootManagerXML = newModuleRootManagerXML.concat(projectOrderEntryElements);
	}

	return newModuleRootManagerXML.join('\n');
};

function isMatchingProjectVersion(version1, version2) {
	if (version1 == 'default') {
		return true;
	}

	var pos1 = version1.indexOf('.LIFERAY-PATCHED');

	if (pos1 != -1) {
		version1 = version1.substring(0, pos1);
	}

	pos1 = version2.indexOf('.LIFERAY-PATCHED');

	if (pos1 != -1) {
		version2 = version2.substring(0, pos1);
	}

	if (version1 == version2) {
		return true;
	}

	pos1 = version1.indexOf(',');

	var startVersion, endVersion;

	if (pos1 == -1) {
		startVersion = '>=' + version1;
		endVersion = '<' + semver.inc(version1, 'major');
	}
	else {
		if (version1.charAt(0) == '[') {
			startVersion = '>=' + version1.substring(1, pos1);
		}
		else if (version1.charAt(0) == '(') {
			startVersion = '>' + version1.substring(1, pos1);
		}
		else {
			return false;
		}

		pos2 = version1.length - 1;

		if (pos1 == pos2) {
			return semver.satisfies(version2, startVersion);
		}
		else if (version1.charAt(pos2) == ']') {
			endVersion = '<=' + version1.substring(pos1 + 1, pos2);
		}
		else if (version1.charAt(pos2) == ')') {
			endVersion = '<' + version1.substring(pos1 + 1, pos2);
		}
		else {
			return false;
		}
	}

	try {
		return semver.satisfies(version2, startVersion + ' ' + endVersion);
	}
	catch (e) {
		return false;
	}
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

	var bundleName = bundleNameRegex.exec(buildXmlContent)[1];
	var bundleVersion = bundleVersionRegex.exec(bndContent)[1];

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

	var bundleName = bundleNameRegex.exec(bndContent)[1];
	var bundleVersion = bundleVersionRegex.exec(bndContent)[1];

	accumulator[bundleName] = {
		projectName: module.moduleName,
		version: bundleVersion
	};

	accumulator[module.moduleName] = {
		bundleName: bundleName,
		version: bundleVersion
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

exports.createProjectWorkspace = createProjectWorkspace;
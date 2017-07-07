var cheerio = require('cheerio');
var fs = require('fs');
var highland = require('highland');
var os = require('os');
var streams2 = require('../streams2/streams2');
var streams4 = require('../streams5/streams4');
var streams5 = require('../streams6/streams5');
var streams6 = require('../streams7/streams6');
var streams7 = require('../streams8/streams7');

var getAncestorFiles = streams7.getAncestorFiles;
var getComponentXML = streams6.getComponentXML;
var getDependenciesWithWhileLoop = streams4.getDependenciesWithWhileLoop;
var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getLibraryDependency = streams4.getLibraryDependency;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getOrderEntryElement = streams7.getOrderEntryElement;
var getSourceFolderElement = streams6.getSourceFolderElement;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var isTestDependency = streams7.isTestDependency;
var saveContent = streams6.saveContent;

var gradleCaches = new Set();
var mavenCaches = new Set();

var libraryCache = {};

function createProjectWorkspace(coreDetails, moduleDetails) {
	moduleDetails.forEach(checkForGradleCache);
	checkForGradleCache(os.homedir());

	moduleDetails.forEach(checkForMavenCache);
	checkForMavenCache(os.homedir());

	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);

	var detailsStream = highland.merge([moduleStream, coreStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();

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

	libraryFilesStream
		.pluck('libraryDependencies')
		.compact()
		.flatten()
		.uniqBy(isSameLibraryDependency)
		.filter(highland.partial(keyExistsInObject, 'group'))
		.doto(setLibraryName)
		.map(getLibraryXML)
		.each(saveContent);

	detailsStream.done(function() {});
};

function checkForGradleCache(obj) {
	var modulePath = typeof obj == "string" ? obj : obj.modulePath;

	if (!modulePath) {
		return;
	}

	var candidates = getAncestorFiles(modulePath, '.gradle/caches/modules-2/files-2.1');

	candidates.forEach(Set.prototype.add.bind(gradleCaches));
};

function checkForMavenCache(obj) {
	var modulePath = typeof obj == "string" ? obj : obj.modulePath;

	if (!modulePath) {
		return;
	}

	var candidates = getAncestorFiles(modulePath, '.m2/repository');

	candidates.forEach(Set.prototype.add.bind(mavenCaches));
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

function getLibraryOrderEntryElement(module, dependency) {
	var extraAttributes = '';

	if (isTestDependency(module, dependency)) {
		extraAttributes = 'scope="TEST" ';
	}
	else if (dependency.exported) {
		extraAttributes = 'exported="" ';
	}

	return '<orderEntry type="library" name="' + dependency.libraryName + '" level="project" ' + extraAttributes + '/>';
};

function getLibraryRootElement(libraryPath) {
	if ((libraryPath.indexOf('/') == 0) || (libraryPath.indexOf('$') == 0)) {
		return '<root url="jar://' + libraryPath + '!/" />';
	}
	else {
		return '<root url="jar://$PROJECT_DIR$/' + libraryPath + '!/" />';
	}
};

function getLibraryTableXML(library) {
	var libraryTableXML = [];

	libraryTableXML.push('<library name="' + library['libraryName'] + '" type="repository">');
	libraryTableXML.push('<properties maven-id="' + library['libraryName'] + '" />');

	var binaryPaths = getLibraryJarPaths(library);

	if (binaryPaths.length > 0) {
		libraryTableXML.push('<CLASSES>');
		Array.prototype.push.apply(libraryTableXML, binaryPaths.map(getLibraryRootElement));
		libraryTableXML.push('</CLASSES>');
	}
	else {
		libraryTableXML.push('<CLASSES />');
	}

	libraryTableXML.push('<JAVADOC />');

	var sourcePaths = [];

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

function getModuleLibraryOrderEntryElements(module) {
	if (!module.libraryDependencies) {
		return [];
	}

	return module.libraryDependencies
		.filter(highland.partial(keyExistsInObject, 'group'))
		.map(setLibraryName)
		.map(highland.partial(getLibraryOrderEntryElement, module));
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

	newModuleRootManagerXML = newModuleRootManagerXML.concat(getModuleLibraryOrderEntryElements(module));
	newModuleRootManagerXML = newModuleRootManagerXML.concat(streams7.getProjectOrderEntryElements(module));

	return newModuleRootManagerXML.join('\n');
};

function getLibraryJarPaths(library) {
	if (library.group == null) {
		return [];
	}

	var jarPaths = library['jarPaths'];

	if (jarPaths != null) {
		return jarPaths;
	}

	var folderPath = library['folderPath'];

	if (folderPath == null) {
		folderPath = getLibraryFolderPath(library);

		library['folderPath'] = folderPath;
	}

	if (folderPath == null) {
		return [];
	}

	var jarName = library.name + '-' + library.version + '.jar';

	var jarPaths = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, jarName))
		.filter(isFile);

	if (jarPaths.length == 0) {
		jarPaths = [getFilePath(folderPath, jarName)].filter(isFile);
	}

	library['jarPaths'] = jarPaths;

	if ((library.group != 'com.liferay') || library.hasInitJsp) {
		processPomDependencies(library);
	}

	return library['jarPaths'];
};

function getLibraryFolderPath(library) {
	if (library.group == null) {
		return null;
	}

	var mavenRelativePath = library.group.split('.').concat([library.name, library.version]).join('/');

	for (mavenCache of mavenCaches) {
		var mavenAbsolutePath = getFilePath(mavenCache, mavenRelativePath);

		if (isDirectory(mavenAbsolutePath) && (fs.readdirSync(mavenAbsolutePath).length != 0)) {
			return mavenAbsolutePath;
		}
	}

	var gradleRelativePath = [library.group, library.name, library.version].join('/');

	for (gradleCache of gradleCaches) {
		var gradleAbsolutePath = getFilePath(gradleCache, gradleRelativePath);

		if (isDirectory(gradleAbsolutePath) && (fs.readdirSync(gradleAbsolutePath).length != 0)) {
			return gradleAbsolutePath;
		}
	}

	return null;
};

function initializeLibrary(groupId, artifactId, version) {
	var libraryName = [groupId, artifactId, version].join(':');
	var newLibrary = libraryCache[libraryName];

	if (newLibrary == null) {
		newLibrary = {
			'group': groupId,
			'name': artifactId,
			'version': version,
			'libraryName' : libraryName
		}

		libraryCache[libraryName] = newLibrary;
	}

	getLibraryJarPaths(newLibrary);

	return newLibrary;
}

function isFirstOccurrence(value, index, array) {
	return array.indexOf(value) == index;
};

function isSameLibraryDependency(left, right) {
	return (left.group == right.group) &&
		(left.name == right.name) &&
		(left.version == right.version);
};

function keyExistsInObject(key, object) {
	return object && key in object;
};

function processPomDependencies(library) {
	var folderPath = library['folderPath'];

	if (folderPath == null) {
		folderPath = getLibraryFolderPath(library);

		library['folderPath'] = folderPath;
	}

	if (folderPath == null) {
		return;
	}

	// First, read the pom.xml

	var pomName = library.name + '-' + library.version + '.pom';
	var pomPaths = [];

	var pomPaths = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, pomName))
		.filter(isFile);

	if (pomPaths.length == 0) {
		pomPaths = [getFilePath(folderPath, pomName)].filter(isFile);
	}

	if (pomPaths.length == 0) {
		return;
	}

	var pomAbsolutePath = pomPaths[0];

	var pomText = fs.readFileSync(pomAbsolutePath);
	var pom = cheerio.load(pomText);

	// Next, parse all the variables

	var variables = library['variables'];

	if (variables == null) {
		variables = {};

		library['variables'] = variables;

		// If there is a parent pom.xml, parse it first

		var parent = pom('project > parent');

		if (parent.length > 0) {
			var parentGroupId = parent.children('groupId').text();
			var parentArtifactId = parent.children('artifactId').text();
			var parentVersion = parent.children('version').text();

			var parentLibrary = initializeLibrary(parentGroupId, parentArtifactId, parentVersion);
			var parentVariables = parentLibrary['variables'];

			for (variableName in parentVariables) {
				variables[variableName] = parentVariables[variableName];
			}

			variables['project.parent.groupId'] = parentLibrary.group;
			variables['project.parent.artifactId'] = parentLibrary.name;
			variables['project.parent.version'] = parentLibrary.version;
		}
		else {
			variables['project.parent.groupId'] = library.group;
			variables['project.parent.name'] = library.name;
			variables['project.parent.version'] = library.version;
		}

		// Now process our own variables

		pom('properties').children()
			.each(highland.partial(setPropertiesAsVariables, variables, library));
	}

	// Next, parse all the dependencies

	if (library['jarPaths'] == null) {
		library['jarPaths'] = [];
	}

	variables['project.groupId'] = library.group;
	variables['project.name'] = library.name;
	variables['project.version'] = library.version;

	pom('project > dependencies').children()
		.each(highland.partial(setDependenciesAsJars, variables, library));

	pom('project > dependencyManagement > dependencies').children()
		.each(highland.partial(setDependencyVariables, variables, library));

	return library['jarPaths'];
};

function replaceVariables(variables, attributeValue) {
	if (attributeValue == null) {
		return attributeValue;
	}

	var x = attributeValue.indexOf('${');

	while (x != -1) {
		y = attributeValue.indexOf('}', x + 2);

		var variableName = attributeValue.substring(x + 2, y);

		var variableValue = variables[variableName];

		if (variableValue == null) {
			variableValue = variables[variableName.toLowerCase()];
		}

		if (variableValue == null) {
			variableValue = '';
		}

		attributeValue = attributeValue.substring(0, x) + variableValue + attributeValue.substring(y + 1);

		x = attributeValue.indexOf('${');
	}

	return attributeValue;
};

function setDependenciesAsJars(variables, library, index, node) {
	var artifactInfo = setDependencyVariables(variables, library, index, node);

	var groupId = artifactInfo[0];
	var artifactId = artifactInfo[1];
	var version = artifactInfo[2];

	var dependencyLibrary = initializeLibrary(groupId, artifactId, version);

	Array.prototype.push.apply(library['jarPaths'], dependencyLibrary['jarPaths']);
};

function setDependencyVariables(variables, library, index, node) {
	var dependency = cheerio(node);

	var groupId = replaceVariables(variables, dependency.children('groupId').text());
	var artifactId = replaceVariables(variables, dependency.children('artifactId').text());
	var version = dependency.children('version').text();

	var versionVariableName = [groupId, artifactId].join(':');

	if (!version) {
		version = variables[versionVariableName];
	}

	version = replaceVariables(variables, version);

	if (version) {
		variables[versionVariableName] = version;
	}

	return [groupId, artifactId, version];
};

function setLibraryName(library) {
	var libraryName = library.name;

	if (library['group'] != null) {
		libraryName = [library.group, library.name, library.version].join(':');
	}

	libraryCache[libraryName] = library;
	library['libraryName'] = libraryName;

	return library;
};

function setPropertiesAsVariables(variables, library, index, node) {
	var variableName = node.tagName;

	variables[variableName] = cheerio(node).text();
};

exports.checkForGradleCache = checkForGradleCache;
exports.checkForMavenCache = checkForMavenCache;
exports.createProjectWorkspace = createProjectWorkspace;
exports.flatten = flatten;
exports.getLibraryJarPaths = getLibraryJarPaths;
exports.getLibraryOrderEntryElement = getLibraryOrderEntryElement;
exports.getLibraryRootElement = getLibraryRootElement;
exports.getLibraryXML = getLibraryXML;
exports.getModuleLibraryOrderEntryElements = getModuleLibraryOrderEntryElements;
exports.getModuleXML = getModuleXML;
exports.gradleCaches = gradleCaches;
exports.isFirstOccurrence = isFirstOccurrence;
exports.isSameLibraryDependency = isSameLibraryDependency;
exports.keyExistsInObject = keyExistsInObject;
exports.mavenCaches = mavenCaches;
exports.setLibraryName = setLibraryName;
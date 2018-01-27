var cheerio = require('cheerio');
var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var streams2 = require('../streams2/streams2');
var streams4 = require('../streams5/streams4');
var streams5 = require('../streams6/streams5');
var streams6 = require('../streams7/streams6');
var streams7 = require('./streams7');

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
var getModuleOrderEntryElement = streams7.getModuleOrderEntryElement;
var getOrderEntryElement = streams7.getOrderEntryElement;
var getSourceFolderElement = streams6.getSourceFolderElement;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var saveContent = streams6.saveContent;

function createProjectWorkspace(coreDetails, moduleDetails) {
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

	detailsStream.done(function() {});
};

function getLibraryFolderPath(library) {
	if (library.group == null) {
		return null;
	}

	var mavenRelativePath = library.group.split('.').concat([library.name, library.version]).join('/');

	for (mavenCache of mavenCaches) {
		var mavenAbsolutePath = getFilePath(mavenCache, mavenRelativePath);

		if (isDirectory(mavenAbsolutePath) && (getLibraryJarCount(mavenAbsolutePath) > 0)) {
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

	for (mavenCache of mavenCaches) {
		var mavenAbsolutePath = getFilePath(mavenCache, mavenRelativePath);

		if (isDirectory(mavenAbsolutePath) && (fs.readdirSync(mavenAbsolutePath).length != 0)) {
			return mavenAbsolutePath;
		}
	}

	return null;
};

function getLibraryJarCount(path) {
	var fileList = fs.readdirSync(path);
	var jarCount = fileList.filter(isJar).length;

	return fileList.filter(isDirectory).map(getLibraryJarCount).reduce(sum, jarCount);
};

function getLibraryJarPaths(library) {
	if (library.group == null) {
		return [];
	}

	var jarPaths = library['jarPaths'];

	if (jarPaths != null) {
		return getLibraryJarList(jarPaths);
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

	var jarList = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, jarName))
		.filter(isFile);

	if (jarList.length == 0) {
		jarList = [getFilePath(folderPath, jarName)].filter(isFile);
	}

	var jarPaths = {};
	jarPaths[library.group] = {};
	jarPaths[library.group][library.name] = {};
	jarPaths[library.group][library.name]['version'] = library.version;
	jarPaths[library.group][library.name]['jarList'] = jarList;

	library['jarPaths'] = jarPaths;

	processPomDependencies(library);

	return getLibraryJarList(library['jarPaths']);
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
	var newModuleRootManagerXML = [streams7.getNewModuleRootManagerXML(module)];

	if (module.libraryDependencies) {
		// TODO: Perform work on module.libraryDependencies here
	}

	return newModuleRootManagerXML.join('\n');
};

function getVariableValue(library, variables, variableName) {
	var variableValue = variables[variableName];

	if (variableValue != null) {
		return variableValue;
	}

	variableValue = variables[variableName.toLowerCase()];

	if (variableValue != null) {
		return variableValue;
	}

	var parentLibrary = library['parentLibrary'];

	if (parentLibrary) {
		return getVariableValue(parentLibrary, parentLibrary['variables'], variableName);
	}

	return null;
};

function initializeLibrary(groupId, artifactId, version) {
	var libraryName = [groupId, artifactId, version].join(':');
	var newLibrary = libraryCache[libraryName];

	if (newLibrary != null) {
		return newLibrary;
	}

	newLibrary = {
		'group': groupId,
		'name': artifactId,
		'version': version,
		'libraryName' : libraryName
	}

	libraryCache[libraryName] = newLibrary;

	getLibraryJarPaths(newLibrary);

	return newLibrary;
};

function isJar(path) {
	return isFile(path) && path.endsWith('.jar');
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
	var pom = cheerio.load(pomText, {xmlMode: true});

	// If we've relocated, parse that one instead

	var relocated = pom('distributionManagement > relocation');

	if (relocated.length > 0) {
		var newGroupId = relocated.children('groupId').text();

		var newLibrary = initializeLibrary(newGroupId, library.name, library.version);

		for (key in newLibrary) {
			library[key] = newLibrary[key];
		}

		return;
	}

	// Otherwise, parse all the variables if we haven't already

	var variables = library['variables'];

	if (variables == null) {
		processPomVariables(library, pom);
		variables = library['variables'];
	}

	// Next, parse all the dependencies

	if (library['jarPaths'] == null) {
		library['jarPaths'] = {};
	}

	variables['pom.groupId'] = library.group;
	variables['pom.name'] = library.name;
	variables['pom.version'] = library.version;

	variables['project.groupId'] = library.group;
	variables['project.name'] = library.name;
	variables['project.version'] = library.version;

	pom('project > dependencyManagement > dependencies').children()
		.each(highland.partial(setDependencyVariables, pom, variables, library));

	pom('project > dependencies').children()
		.each(highland.partial(setDependenciesAsJars, pom, variables, library));
};

function processPomVariables(library, pom) {
	variables = {};

	library['variables'] = variables;

	// If there is a parent pom.xml, parse it first

	var parent = pom('project > parent');

	if (parent.length > 0) {
		var parentGroupId = parent.children('groupId').text();
		var parentArtifactId = parent.children('artifactId').text();
		var parentVersion = parent.children('version').text();

		var parentLibrary = initializeLibrary(parentGroupId, parentArtifactId, parentVersion);

		library['parentLibrary'] = parentLibrary;

		variables['project.parent.group'] = parentLibrary.group;
		variables['project.parent.groupId'] = parentLibrary.group;
		variables['project.parent.name'] = parentLibrary.name;
		variables['project.parent.artifact'] = parentLibrary.name;
		variables['project.parent.artifactId'] = parentLibrary.name;
		variables['project.parent.version'] = parentLibrary.version;
	}
	else {
		variables['project.parent.group'] = library.group;
		variables['project.parent.groupId'] = library.group;
		variables['project.parent.name'] = library.name;
		variables['project.parent.artifact'] = library.name;
		variables['project.parent.artifactId'] = library.name;
		variables['project.parent.version'] = library.version;
	}

	// Now process our own variables

	pom('project > properties').each(function(i, node) {
		pom(node).children().each(highland.partial(setPropertiesAsVariables, variables, library));
	});
};

function replaceVariables(library, variables, attributeValue) {
	if (attributeValue == null) {
		return attributeValue;
	}

	var x = attributeValue.indexOf('${');

	while (x != -1) {
		y = attributeValue.indexOf('}', x + 2);

		var variableName = attributeValue.substring(x + 2, y);

		var variableValue = getVariableValue(library, variables, variableName);

		if (variableValue == null) {
			variableValue = '';
		}

		attributeValue = attributeValue.substring(0, x) + variableValue + attributeValue.substring(y + 1);

		x = attributeValue.indexOf('${');
	}

	return attributeValue;
};

function setDependenciesAsJars(pom, variables, library, index, node) {
	if (node.tagName != 'dependency') {
		return;
	}

	var artifactInfo = setDependencyVariables(pom, variables, library, index, node);

	var groupId = artifactInfo[0];
	var artifactId = artifactInfo[1];
	var version = artifactInfo[2];

	if (groupId.indexOf('com.liferay') == 0) {
		return;
	}

	var dependencyLibrary = initializeLibrary(groupId, artifactId, version);

	var jarPaths = library['jarPaths'];
	var dependencyJarPaths = dependencyLibrary['jarPaths'];

	for (group in dependencyJarPaths) {
		for (name in dependencyJarPaths[group]) {
			setDependencyJarList(jarPaths, group, name, dependencyJarPaths[group][name]);
		}
	}
};

function setDependencyJarList(jarPaths, group, name, dependencyInfo) {
	if (!(keyExistsInObject(group, jarPaths))) {
		jarPaths[group] = {};
	}

	if (!keyExistsInObject(name, jarPaths[group])) {
		jarPaths[group][name] = {
			version: dependencyInfo['version'],
			jarList: dependencyInfo['jarList']
		};

		return;
	}

	var oldDependencyVersion = jarPaths[group][name]['version'];
	var newDependencyVersion = dependencyInfo['version'];

	if (oldDependencyVersion < newDependencyVersion) {
		jarPaths[group][name] = {
			version: dependencyInfo['version'],
			jarList: dependencyInfo['jarList']
		};

		return;
	}
};

function setDependencyVariables(pom, variables, library, index, node) {
	var dependency = pom(node);

	var groupId = replaceVariables(library, variables, dependency.children('groupId').text());
	var artifactId = replaceVariables(library, variables, dependency.children('artifactId').text());
	var version = dependency.children('version').text();

	var versionVariableName = [groupId, artifactId].join(':');

	if (!version) {
		version = getVariableValue(library, variables, versionVariableName);
	}

	version = replaceVariables(library, variables, version);

	if (version) {
		variables[versionVariableName] = version;
	}

	var type = dependency.children('type').text();

	if (version && type && (type == 'pom')) {
		var dependencyLibrary = initializeLibrary(groupId, artifactId, version);

		for (variableName in dependencyLibrary['variables']) {
			if ((variableName.indexOf(':') != -1) && !(variableName in library['variables'])) {
				library['variables'][variableName] = dependencyLibrary['variables'][variableName];
			}
		}
	}

	return [groupId, artifactId, version];
};

function sum(accumulator, next) {
	return accumulator + next;
};

exports.createProjectWorkspace = createProjectWorkspace;
exports.getNewModuleRootManagerXML = getNewModuleRootManagerXML;
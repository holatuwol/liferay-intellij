var cheerio = require('cheerio');
var child_process = require('child_process');
var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var os = require('os');
var streams2 = require('../streams2/streams2');
var streams4 = require('../streams5/streams4');
var streams5 = require('../streams6/streams5');
var streams6 = require('../streams7/streams6');
var streams7 = require('../streams8/streams7');

var execFileSync = child_process.execFileSync;
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
var isTestDependency = streams7.isTestDependency;
var saveContent = streams6.saveContent;

var fileListCache = {};
var folderListCache = {};

var gradleCaches = new Set();
var mavenCaches = new Set();

var libraryCache = {};

function createProjectWorkspace(coreDetails, moduleDetails) {
	moduleDetails.forEach(checkForGradleCache);
	checkForGradleCache(getUserHome());
	checkForGradleCache('../liferay-binaries-cache-2017');

	for (gradleCache of gradleCaches) {
		generateFileListCache(gradleCache);
	}

	checkForMavenCache(getUserHome());

	for (mavenCache of mavenCaches) {
		generateFileListCache(mavenCache);
	}

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

function generateFileListCache(cachePath) {
	var args = ['.', '-name', '*.jar', '-o', '-name', '*.pom'];

	var options = {
		'cwd': cachePath
	};

	var fileList = [];

	try {
		fileList = execFileSync('find', args, options).toString().split('\n');
	}
	catch (e) {
	}

	fileList.sort();

	var fileSet = new Set(fileList);

	for (var i = 0; i < fileList.length; i++) {
		var fileName = fileList[i];
		var filePath = getFilePath(cachePath, fileName);

		var folderName = fileName

		var pos = folderName.lastIndexOf('/');

		while (pos != -1) {
			folderName = folderName.substring(0, pos);

			var folderPath = getFilePath(cachePath, folderName);

			if (folderListCache[folderPath]) {
				folderListCache[folderPath].push(filePath);
			}
			else {
				folderListCache[folderPath] = [filePath];
				fileSet.add(folderName);
			}

			pos = folderName.lastIndexOf('/');
		}
	}

	fileListCache[cachePath] = fileSet;
}

function getLibraryFolderPath(library) {
	if ((library.group == null) || (library.version == null)) {
		return null;
	}

	var mavenRelativePath = library.group.split('.').concat(['.', library.name, library.version]).join('/');

	for (mavenCache of mavenCaches) {
		if (!fileListCache[mavenCache].has(mavenRelativePath)) {
			continue;
		}

		var mavenAbsolutePath = getFilePath(mavenCache, mavenRelativePath);

		if (getLibraryJarCount(mavenAbsolutePath) > 0) {
			return mavenAbsolutePath;
		}
	}

	var gradleRelativePath = ['.', library.group, library.name, library.version].join('/');

	for (gradleCache of gradleCaches) {
		if (fileListCache[gradleCache].has(gradleRelativePath)) {
			return getFilePath(gradleCache, gradleRelativePath);
		}
	}

	for (mavenCache of mavenCaches) {
		if (fileListCache[mavenCache].has(mavenRelativePath)) {
			return getFilePath(mavenCache, mavenRelativePath);
		}
	}

	if (library.group != 'com.liferay') {
		return null;
	}

	// Check for a snapshot release

	var artifactNameRelativePath = ['.', library.group, library.name, library.version + '-SNAPSHOT'].join('/');

	for (gradleCache of gradleCaches) {
		if (!fileListCache[gradleCache].has(artifactNameRelativePath)) {
			continue;
		}

		return getFilePath(gradleCache, artifactNameRelativePath);
	}

	return null;
};

function getLibraryJarCount(path) {
	return folderListCache[path].filter(isJar).length;
};

function getLibraryJarList(jarPaths) {
	var jarList = [];

	for (group in jarPaths) {
		for (name in jarPaths[group]) {
			Array.prototype.push.apply(jarList, jarPaths[group][name]['jarList']);
		}
	}

	return jarList;
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
	var jarList = [];

	var candidateFiles = folderListCache[folderPath];

	for (var i = 0; i < candidateFiles.length; i++) {
		if (candidateFiles[i].indexOf(jarName) != -1) {
			jarList.push(candidateFiles[i]);
		}
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

function getLibraryOrderEntryElement(module, dependency) {
	var elementXML = [
		'<orderEntry type="library" name="',
		dependency.libraryName,
		'" level="project" scope="',
		isTestDependency(module, dependency) ? "TEST" : "PROVIDED",
		'" ',
		dependency.exported ? 'exported="" ' : '',
		'/>'
	];

	return elementXML.join('');
};

function getLibraryRootElement(libraryPath) {
	if ((libraryPath.indexOf('/') == 0) || (libraryPath.indexOf('$') == 0) || (libraryPath.indexOf(':') != -1)) {
		return '<root url="jar://' + libraryPath + '!/" />';
	}
	else {
		return '<root url="jar://$PROJECT_DIR$/' + libraryPath + '!/" />';
	}
};

function getLibraryTableXML(library) {
	var libraryTableXML = [];

	libraryTableXML.push('<library name="' + library['libraryName'] + '">');
	libraryTableXML.push('<properties />');

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

function getUserHome() {
	return os.homedir ? os.homedir() : process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
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

function isFirstOccurrence(value, index, array) {
	return array.indexOf(value) == index;
};

function isJar(path) {
	return path.substring(path.length - 4) == '.jar';
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

	var candidateFiles = folderListCache[folderPath];

	for (var i = 0; i < candidateFiles.length; i++) {
		if (candidateFiles[i].indexOf(pomName) != -1) {
			pomPaths.push(candidateFiles[i]);
		}
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

function sum(accumulator, next) {
	return accumulator + next;
};

exports.checkForGradleCache = checkForGradleCache;
exports.checkForMavenCache = checkForMavenCache;
exports.createProjectWorkspace = createProjectWorkspace;
exports.generateFileListCache = generateFileListCache;
exports.getLibraryJarPaths = getLibraryJarPaths;
exports.getLibraryOrderEntryElement = getLibraryOrderEntryElement;
exports.getLibraryRootElement = getLibraryRootElement;
exports.getLibraryXML = getLibraryXML;
exports.getModuleLibraryOrderEntryElements = getModuleLibraryOrderEntryElements;
exports.getModuleXML = getModuleXML;
exports.gradleCaches = gradleCaches;
exports.getUserHome = getUserHome;
exports.isFirstOccurrence = isFirstOccurrence;
exports.isJar = isJar;
exports.isSameLibraryDependency = isSameLibraryDependency;
exports.keyExistsInObject = keyExistsInObject;
exports.libraryCache = libraryCache;
exports.mavenCaches = mavenCaches;
exports.setLibraryName = setLibraryName;
var fs = require('fs');
var highland = require('highland');
var streams2 = require('./streams2');
var streams4 = require('./streams4');
var streams5 = require('./streams5');
var streams6 = require('./streams6');
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

function flatten(accumulator, next) {
	if (!accumulator) {
		return next;
	}

	if (!next) {
		return accumulator;
	}

	return accumulator.concat(next);
};

function getGradleLibraryPaths(library) {
	if (!('group' in library)) {
		return [];
	}

	var gradleBasePath = '.gradle/caches/modules-2/files-2.1';

	var folderPath = [library.group, library.name, library.version].reduce(getFilePath, gradleBasePath);

	if (!isDirectory(folderPath)) {
		return [];
	}

	var jarName = library.name + '-' + library.version + '.jar';

	var jarPaths = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, jarName))
		.filter(isFile);

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


function getLibraryOrderEntryElement(library) {
	if (library.exported) {
		return '<orderEntry type="library" name="' + library['libraryName'] + '" exported="" level="project"/>';
	}
	else {
		return '<orderEntry type="library" name="' + library['libraryName'] + '" level="project"/>';
	}
};

function getLibraryPaths(library) {
	var gradleLibraryPaths = getGradleLibraryPaths(library);

	if (gradleLibraryPaths.length != 0) {
		return gradleLibraryPaths;
	}

	return [];
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
		var libraryOrderEntryElements = module.libraryDependencies
			.filter(highland.partial(keyExistsInObject, 'group'))
			.map(setLibraryName)
			.map(getLibraryOrderEntryElement);

		newModuleRootManagerXML = newModuleRootManagerXML.concat(libraryOrderEntryElements);
	}

	return newModuleRootManagerXML.join('\n');
};

function getPomDependencyPaths(pomAbsolutePath, libraryVersion) {
	var pomContents = fs.readFileSync(pomAbsolutePath);

	var dependencyTextRegex = /<dependencies>([\s\S]*?)<\/dependencies>/g;
	var dependencyTextResult = dependencyTextRegex.exec(pomContents);

	if (!dependencyTextResult) {
		return [];
	}

	var dependencyText = dependencyTextResult[1];

	var libraryDependencyRegex = /<groupId>([^>]*)<\/groupId>[^<]*<artifactId>([^>]*)<\/artifactId>[^<]*<version>([^>]*)<\/version>/g;
	var libraryDependencies = getDependenciesWithWhileLoop(dependencyText, getLibraryDependency, libraryDependencyRegex);

	return libraryDependencies
		.map(highland.partial(replaceProjectVersion, libraryVersion))
		.map(getLibraryPaths)
		.reduce(flatten, [])
};

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

function replaceProjectVersion(version, library) {
	if (library.version == '${project.version}') {
		library.version = version;
	}

	return library;
};

function setLibraryName(library) {
	if ('group' in library) {
		library['libraryName'] = library.group + ':' + library.name + ':' + library.version;
	}
	else {
		library['libraryName'] = library.name;
	}

	return library;
};

exports.createProjectWorkspace = createProjectWorkspace;
exports.flatten = flatten;
exports.getGradleLibraryPaths = getGradleLibraryPaths;
exports.getLibraryOrderEntryElement = getLibraryOrderEntryElement;
exports.getLibraryRootElement = getLibraryRootElement;
exports.getLibraryXML = getLibraryXML;
exports.getModuleXML = getModuleXML;
exports.getNewModuleRootManagerXML = getNewModuleRootManagerXML;
exports.getPomDependencyPaths = getPomDependencyPaths;
exports.isFirstOccurrence = isFirstOccurrence;
exports.isSameLibraryDependency = isSameLibraryDependency;
exports.keyExistsInObject = keyExistsInObject;
exports.setLibraryName = setLibraryName;